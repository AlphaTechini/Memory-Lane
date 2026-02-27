<!-- Replica Chat Interface -->
<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import {
    requireAuthForAction,
    checkAuthStatus,
    getAuthToken,
    apiCall,
    getUserRole,
  } from "$lib/auth.js";
  import MessageInput from "$lib/components/MessageInput.svelte";
  import getApiBase from "$lib/apiBase.js";

  const API_BASE_URL = getApiBase();
  import BackNavigation from "$lib/components/BackNavigation.svelte";
  import { apiUrl } from "$lib/utils/api.js";

  import { formatTimestamp } from "$lib/utils/formatDate.js";

  let userReplicas = $state([]);
  let selectedReplica = $state(null);
  let isLoadingReplicas = $state(false); // Changed default to false for non-auth users
  let isFetchingAll = $state(false);
  let chatMessages = $state([]);
  let isSendingMessage = $state(false);
  let isAuthenticated = $state(false);
  let userRole = null;
  let chatContainer; // Reference to chat messages container
  let currentConversationId = $state(null); // Current conversation ID for persistence

  // Delete confirmation states
  let confirmingDelete = $state(null); // Replica ID being confirmed for deletion
  let isDeletingReplica = $state(false);

  // Sidebar navigation states
  let sidebarView = $state("replicas"); // 'replicas' | 'conversations'
  let selectedReplicaForSidebar = $state(null); // Replica being viewed in conversations sidebar
  let conversations = $state([]); // Previous conversations for selected replica
  let isLoadingConversations = $state(false);
  let expandedReplica = $state(null); // The replica whose conversations are being shown
  let selectedConversation = $state(null); // Currently selected conversation
  // Training session state
  let trainingSession = $state(null); // { entryId, replicaId, startedAt }
  let trainingBuffer = $state([]); // user messages collected
  let isSubmittingTraining = $state(false);
  let pollInterval = null;
  let trainingTimer = $state(null); // Timer interval for training session
  let trainingElapsed = $state(0); // Elapsed time in seconds
  const TRAIN_SESSION_KEY = "activeTrainingSession";
  const TRAIN_BUFFER_KEY = "activeTrainingBuffer";

  // Auto-scroll function to scroll to bottom of chat
  const AUTO_SCROLL_THRESHOLD = 150; // px
  function isNearBottom() {
    if (!chatContainer) return true;
    const distanceFromBottom =
      chatContainer.scrollHeight -
      (chatContainer.scrollTop + chatContainer.clientHeight);
    return distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
  }

  function scrollToBottom() {
    if (!chatContainer) return;
    requestAnimationFrame(() => {
      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: "smooth",
      });
    });
  }

  // Format elapsed time for training session
  function formatElapsedTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Start training session timer
  function startTrainingTimer() {
    trainingElapsed = 0;
    trainingTimer = setInterval(() => {
      trainingElapsed++;
    }, 1000);
  }

  // Stop training session timer
  function stopTrainingTimer() {
    if (trainingTimer) {
      clearInterval(trainingTimer);
      trainingTimer = null;
      trainingElapsed = 0;
    }
  }

  // Auto-scroll when chat messages change, but only when user is near the bottom
  $effect(() => {
    chatMessages;
    if (!chatContainer) return;
    requestAnimationFrame(() => {
      if (isNearBottom()) scrollToBottom();
    });
  });

  // Demo replicas for non-authenticated users
  const demoReplicas = [
    {
      replicaId: "demo-1",
      name: "Alex Chen",
      description:
        "A creative software developer passionate about AI and innovation",
      profileImageUrl: null,
      coverageScore: 85,
      isActive: true,
      isDemo: true,
    },
    {
      replicaId: "demo-2",
      name: "Dr. Sarah Johnson",
      description:
        "A research scientist specializing in machine learning and data science",
      profileImageUrl: null,
      coverageScore: 92,
      isActive: true,
      isDemo: true,
    },
    {
      replicaId: "demo-3",
      name: "Marcus Rodriguez",
      description:
        "An entrepreneur and business strategist with expertise in startups",
      profileImageUrl: null,
      coverageScore: 78,
      isActive: true,
      isDemo: true,
    },
  ];

  onMount(async () => {
    isAuthenticated = checkAuthStatus();

    // Get user role from cache first, then from API if authenticated
    try {
      userRole = getUserRole();
    } catch (e) {
      console.error("Failed to get user role on auth init:", e);
      userRole = null;
    }

    if (isAuthenticated) {
      // Fetch fresh user data to get current role
      try {
        const response = await apiCall("/api/auth/me", { method: "GET" });
        if (response.ok) {
          const userData = await response.json();
          if (userData.user && userData.user.role) {
            userRole = userData.user.role;
          }
        }
      } catch (error) {
        console.error("Failed to fetch user role:", error);
      }
      await loadUserReplicas();
      // Reconcile with remote if list empty or first load
      try {
        if (!userReplicas.length) {
          const token = getAuthToken();
          console.debug("Reconcile attempt - token present:", !!token);
          // Do not set Content-Type when there's no body, Fastify rejects empty JSON bodies
          const recRes = await fetch("/api/replicas/reconcile", {
            method: "POST",
            credentials: "include",
          });
          if (recRes.ok) {
            const recData = await recRes.json();
            if (recData.added?.length || recData.updated?.length) {
              await loadUserReplicas();
            }
          }
        }
      } catch (e) {
        console.error("Failed to reconcile replicas:", e);
      }

      // Check for replicaId in query params
      try {
        const params = new URLSearchParams(window.location.search);
        const newId = params.get("replicaId");
        let autoReplica = null;
        if (newId) {
          autoReplica = userReplicas.find((r) => r.replicaId === newId) || null;
        }
        // Fallback to sessionStorage item if not yet in list
        if (!autoReplica) {
          const stored = sessionStorage.getItem("newReplica");
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              // Backend returns id, we store replicaId as same
              const match = userReplicas.find(
                (r) =>
                  r.replicaId === parsed.id || r.replicaId === parsed.replicaId,
              );
              if (match) {
                autoReplica = match;
              } else if (parsed.id) {
                // If list still empty attempt server fetch for that replica
                const fetched = await fetchReplicaById(parsed.id);
                if (fetched) {
                  autoReplica = fetched;
                  if (
                    !userReplicas.find((r) => r.replicaId === fetched.replicaId)
                  ) {
                    userReplicas = [fetched, ...userReplicas];
                  }
                } else {
                  // Create temporary placeholder from session data until proper fetch
                  autoReplica = {
                    replicaId: parsed.id,
                    name: parsed.name || "New Replica",
                    description:
                      parsed.description || "Recently created replica",
                    profileImageUrl: parsed.profileImageUrl || null,
                    coverageScore: parsed.coverageScore || 0,
                    isActive: true,
                    lastTrained: new Date(),
                  };
                  userReplicas = [autoReplica, ...userReplicas];
                  // Trigger a refresh of user replicas to get the proper data
                  setTimeout(() => loadUserReplicas(), 2000);
                }
              }
            } catch (e) {
              console.warn(
                "Failed to parse newReplica from session storage:",
                e,
              );
            }
          }
        }
        if (autoReplica) {
          selectedReplica = autoReplica;
          chatMessages = [];

          // Add a welcome message for new replicas
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get("created") === "true") {
            chatMessages = [
              {
                id: Date.now(),
                text: `🎉 Your replica "${autoReplica.name}" has been successfully created and trained! I'm ready to chat with you.`,
                sender: "replica",
                timestamp: new Date(),
              },
            ];
          }

          // Clean stored newReplica so it doesn't auto-select again
          sessionStorage.removeItem("newReplica");
        }
      } catch (e) {
        console.warn("Auto-select replica failed", e);
      }
    } else {
      // No token: try to populate replicas from cached userData
      try {
        const cached = localStorage.getItem("userData");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.replicas && parsed.replicas.length) {
            userReplicas = parsed.replicas;
          }
        }
      } catch {
        // ignore
      }
    }
    // Restore any active training session
    try {
      const storedSess = localStorage.getItem(TRAIN_SESSION_KEY);
      const storedBuf = localStorage.getItem(TRAIN_BUFFER_KEY);
      if (storedSess) {
        trainingSession = JSON.parse(storedSess);
      }
      if (storedBuf) {
        trainingBuffer = JSON.parse(storedBuf);
      }
      if (trainingSession && trainingSession.status === "PROCESSING") {
        beginStatusPolling();
      }
    } catch (e) {
      console.warn("Failed to restore training session:", e);
    }
  });

  async function loadUserReplicas() {
    if (!isAuthenticated) return;

    isLoadingReplicas = true;
    try {
      console.debug(
        "chat-replicas loadUserReplicas - token present:",
        !!getAuthToken(),
      );
      const response = await apiCall("/api/user/replicas", { method: "GET" });

      if (response.ok) {
        const data = await response.json();
        userReplicas = data.replicas || [];
      } else {
        console.error("Failed to load replicas");
      }
    } catch (error) {
      console.error("Error loading replicas:", error);
    } finally {
      isLoadingReplicas = false;
    }
  }

  async function fetchReplicaById(replicaId) {
    try {
      console.debug(
        "fetchReplicaById - token present:",
        !!getAuthToken(),
        "replicaId:",
        replicaId,
      );
      const res = await apiCall(`/api/replicas/${replicaId}`, {
        method: "GET",
      });
      if (res.ok) {
        const data = await res.json();
        return data.replica;
      }
    } catch (e) {
      console.warn("Failed single replica fetch", e);
    }
    return null;
  }

  async function fetchAllReplicas() {
    if (!isAuthenticated) return;

    isFetchingAll = true;
    try {
      const token = getAuthToken();

      console.log("Starting fetch all replicas...");

      // First call reconcile to sync with remote Sensay API
      console.log("Calling reconcile endpoint...");
      console.debug("fetchAllReplicas - token present:", !!token);
      // Do not set Content-Type for an empty POST body (Fastify throws on empty JSON body)
      const reconcileResponse = await fetch("/api/replicas/reconcile", {
        method: "POST",
        credentials: "include",
      });

      if (reconcileResponse.ok) {
        const reconcileData = await reconcileResponse.json();
        console.log("Reconcile successful:", reconcileData);

        // Then fetch updated user replicas
        console.log("Fetching updated user replicas...");
        await loadUserReplicas();

        console.log(
          "All replicas fetched successfully, total:",
          userReplicas.length,
        );

        // Success - isFetchingAll will be reset to false
        console.log("All replicas fetched successfully");
      } else {
        const errorData = await reconcileResponse.text();
        console.error(
          "Reconcile failed with status:",
          reconcileResponse.status,
          errorData,
        );

        // Try to fetch user replicas anyway
        console.log(
          "Attempting to fetch user replicas despite reconcile failure...",
        );
        await loadUserReplicas();
      }
    } catch (error) {
      console.error("Error in fetchAllReplicas:", error);

      // Try to fetch user replicas as fallback
      try {
        console.log("Fallback: attempting basic replica fetch...");
        await loadUserReplicas();
      } catch (fallbackError) {
        console.error("Fallback fetch also failed:", fallbackError);
      }
    } finally {
      isFetchingAll = false;
    }
  }

  // Sidebar navigation functions - unused but keeping structure for future

  function backToReplicasList() {
    sidebarView = "replicas";
    expandedReplica = null;
    conversations = [];
    selectedConversation = null;
  }

  async function loadConversations(replicaId) {
    if (!isAuthenticated) return;

    isLoadingConversations = true;
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/replicas/${replicaId}/conversations`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        conversations = data.conversations || [];
      } else {
        console.error("Failed to load conversations");
        conversations = [];
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      conversations = [];
    } finally {
      isLoadingConversations = false;
    }
  }

  // selectConversation removed: functionality handled by loadConversation or UI selection handlers

  function startNewConversation() {
    selectedConversation = null;
    selectedReplica = expandedReplica;
    chatMessages = [];
    currentConversationId = null; // Reset conversation ID for new chat

    // Reset training state for new conversation
    stopTrainingTimer();
    trainingSession = null;
    trainingBuffer = [];
    localStorage.removeItem(TRAIN_SESSION_KEY);
    localStorage.removeItem(TRAIN_BUFFER_KEY);
  }

  // Sidebar navigation functions
  async function openReplicaConversations(replica) {
    if (!requireAuthForAction("view conversations")) return;

    selectedReplicaForSidebar = replica;
    sidebarView = "conversations";
    await loadConversations(replica.replicaId);
  }

  async function loadConversation(conversationId) {
    try {
      const token = getAuthToken();
      // Backend currently exposes GET /api/conversations/:conversationId (no /messages suffix)
      // Try canonical route first; if a future /messages sub-route appears, we can fallback.
      let response = await fetch(`/api/conversations/${conversationId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // Existing endpoint returns a conversation object with messages; adapt expected shape
        chatMessages = data.conversation?.messages || data.messages || [];
        selectedReplica = selectedReplicaForSidebar; // Set the active replica for chat
      } else {
        // Fallback: attempt legacy /messages path if present
        const alt = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (alt.ok) {
          const data = await alt.json();
          chatMessages = data.messages || [];
          selectedReplica = selectedReplicaForSidebar;
        } else {
          console.error(
            "Failed to load conversation (both canonical and /messages endpoints)",
          );
        }
      }
    } catch (error) {
      console.error("Error loading conversation messages:", error);
    }
  }

  function selectReplica(replica) {
    if (!requireAuthForAction("chat with your replicas")) return;

    // Set the selected replica for chat
    selectedReplica = replica;

    // Add initial greeting message if replica has custom greeting
    const greetingText =
      replica.greeting?.trim() ||
      `Hi! I'm ${replica.name}. ${replica.description}`;
    chatMessages = [
      {
        id: Date.now(),
        text: greetingText,
        sender: "replica",
        timestamp: new Date(),
      },
    ];

    currentConversationId = null; // Reset conversation ID for new chat

    // Reset training state when selecting a new replica
    stopTrainingTimer();
    trainingSession = null;
    trainingBuffer = [];
    localStorage.removeItem(TRAIN_SESSION_KEY);
    localStorage.removeItem(TRAIN_BUFFER_KEY);

    // Reset conversation selection
    selectedConversation = null;
  }

  function confirmDeleteReplica(replica) {
    confirmingDelete = replica.replicaId;
  }

  function cancelDeleteReplica() {
    confirmingDelete = null;
  }

  async function deleteReplica(replicaId) {
    if (!requireAuthForAction("delete replicas")) return;

    isDeletingReplica = true;
    try {
      const response = await apiCall(`/api/replicas/${replicaId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete replica");
      }

      // Remove from local state
      userReplicas = userReplicas.filter((r) => r.replicaId !== replicaId);

      // Clear selected replica if it was the deleted one
      if (selectedReplica?.replicaId === replicaId) {
        selectedReplica = null;
        chatMessages = [];
        currentConversationId = null;
      }

      // Show success message
      alert("Replica deleted successfully");
    } catch (error) {
      console.error("Error deleting replica:", error);
      alert("Failed to delete replica: " + error.message);
    } finally {
      isDeletingReplica = false;
      confirmingDelete = null;
    }
  }

  function startGenericChat() {
    selectedReplica = null;
    currentConversationId = null; // Reset conversation ID for generic chat
    // Seed a helpful assistant intro so users immediately see guidance
    chatMessages = [
      {
        id: Date.now(),
        text: `Hello — I'm Memory Lane. I can explain how our reminiscence replicas and Memory Lane features help people with dementia, amnesia, or other memory concerns. We use familiar photos, stories, and consistent, trusted voices to gently stimulate recall, reduce anxiety, and encourage meaningful engagement. Caregivers can curate content to make conversations safe and comforting. Ask me how to get started or how Memory Lane can support a loved one.`,
        sender: "bot",
        timestamp: new Date(),
      },
    ];
  }

  async function sendMessage(text) {
    if (!text.trim() || isSendingMessage) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      text,
      sender: "user",
      timestamp: new Date(),
    };
    chatMessages = [...chatMessages, userMessage];

    // Collect user message for training if session is active
    if (trainingSession && !trainingSession.status) {
      trainingBuffer.push(`User: ${text}`);
      localStorage.setItem(TRAIN_BUFFER_KEY, JSON.stringify(trainingBuffer));
    }

    isSendingMessage = true;

    try {
      const token = getAuthToken();
      let response;

      if (selectedReplica) {
        // Require auth for replica chat
        if (!requireAuthForAction("chat with your replica")) return;

        // Chat with specific replica
        response = await fetch(
          `/api/replicas/${selectedReplica.replicaId}/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              message: text,
              conversationId: currentConversationId, // Include current conversation ID
              context: chatMessages.slice(-10).map((msg) => ({
                role: msg.sender === "user" ? "user" : "assistant",
                content: msg.text,
              })),
            }),
          },
        );
      } else {
        // Generic chat (no auth required)
        response = await fetch(`${API_BASE_URL}/api/chat/generic`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            message: text,
            context: chatMessages.slice(-10).map((msg) => ({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.text,
            })),
          }),
        });
      }

      if (response.ok) {
        const data = await response.json();

        // Save conversation ID for future messages
        if (data.conversationId && selectedReplica) {
          currentConversationId = data.conversationId;
        }

        const botMessage = {
          id: Date.now() + 1,
          text:
            data.response?.message ||
            data.message ||
            "Sorry, I could not process that.",
          sender: "bot",
          timestamp: new Date(),
        };
        chatMessages = [...chatMessages, botMessage];

        // Collect bot response for training if session is active
        if (trainingSession && !trainingSession.status) {
          trainingBuffer.push(`Assistant: ${botMessage.text}`);
          localStorage.setItem(
            TRAIN_BUFFER_KEY,
            JSON.stringify(trainingBuffer),
          );
        }
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error. Please try again.",
        sender: "bot",
        timestamp: new Date(),
      };
      chatMessages = [...chatMessages, errorMessage];
    } finally {
      isSendingMessage = false;
    }
  }

  function handleSuggestedQuestion(question) {
    // Send the suggested question as if the user typed it
    sendMessage(question);
  }

  function handleSendMessage(event) {
    sendMessage(event.detail.text);
    if (trainingSession && event.detail.text?.trim()) {
      trainingBuffer = [...trainingBuffer, event.detail.text.trim()];
      localStorage.setItem(TRAIN_BUFFER_KEY, JSON.stringify(trainingBuffer));
    }
  }

  async function startTrainingSession() {
    console.log("startTrainingSession called");
    console.log("selectedReplica:", selectedReplica);
    console.log("trainingSession:", trainingSession);

    if (!selectedReplica || trainingSession) {
      console.log("Early return: no replica or training session exists");
      return;
    }
    if (!requireAuthForAction("start a training session")) {
      console.log("Early return: auth check failed");
      return;
    }

    console.log("Starting training session...");
    // Just start the training session locally - no API call needed yet
    trainingSession = {
      replicaId: selectedReplica.replicaId,
      startedAt: new Date().toISOString(),
      status: null, // collecting phase
    };
    trainingBuffer = [];
    localStorage.setItem(TRAIN_SESSION_KEY, JSON.stringify(trainingSession));
    localStorage.setItem(TRAIN_BUFFER_KEY, JSON.stringify(trainingBuffer));

    // Start the timer
    startTrainingTimer();
    console.log("Training session started locally");
  }

  async function endTrainingSession() {
    if (!trainingSession || !selectedReplica) return;

    // Prevent multiple submissions
    if (isSubmittingTraining) {
      console.log(
        "Training submission already in progress, ignoring duplicate call",
      );
      return;
    }

    isSubmittingTraining = true;

    try {
      // Collect all chat messages as training data
      const chatText = trainingBuffer.join("\n\n");
      console.log(
        "Submitting training data:",
        chatText.substring(0, 200) + "...",
      );
      console.log("Training buffer length:", trainingBuffer.length);

      if (trainingBuffer.length === 0) {
        alert("No training data collected. Start a conversation first!");
        return; // Exit early
      }

      const token = getAuthToken();
      console.log("Token available:", !!token);

      // Generate a session ID based on the start time
      const sessionId = trainingSession.startedAt.replace(/[:.]/g, "-");

      // Submit the collected chat messages as training data
      console.log("Submitting training data to API...");
      const response = await fetch(
        `${API_BASE_URL}/api/replicas/${selectedReplica.replicaId}/training-sessions/${sessionId}/complete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rawText: chatText,
            title: `Chat Session ${trainingSession.startedAt}`,
          }),
        },
      );

      console.log("Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Training submission successful:", data);

        // Update training session with the results
        trainingSession = {
          ...trainingSession,
          entryId: data.entryId,
          status: data.status,
        };
        localStorage.setItem(
          TRAIN_SESSION_KEY,
          JSON.stringify(trainingSession),
        );

        if (data.status === "PROCESSING") {
          beginStatusPolling();
        }

        console.log("Training session updated with status:", data.status);
        alert("Training data submitted successfully! Status: " + data.status);
      } else {
        const errorText = await response.text();
        console.error("Failed to submit training data:", errorText);
        alert("Failed to submit training data. Check console for details.");
      }
    } catch (e) {
      console.error("Error in endTrainingSession:", e);
      alert(
        "An error occurred while submitting training data. Check console for details.",
      );
    } finally {
      isSubmittingTraining = false;
      // Stop the timer but don't clear the session yet if it's processing
      stopTrainingTimer();
      trainingBuffer = [];
      localStorage.removeItem(TRAIN_BUFFER_KEY);
    }
  }

  async function pollStatusOnce() {
    if (!trainingSession?.entryId || !selectedReplica?.replicaId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/replicas/${selectedReplica.replicaId}/kb/${trainingSession.entryId}/status`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.status?.status) {
          trainingSession = { ...trainingSession, status: data.status.status };
          localStorage.setItem(
            TRAIN_SESSION_KEY,
            JSON.stringify(trainingSession),
          );
          if (["READY", "FAILED", "ERROR"].includes(trainingSession.status)) {
            stopStatusPolling();
          }
        }
      }
    } catch (e) {
      console.error("Failed to delete replica:", e);
    }
  }

  function beginStatusPolling() {
    stopStatusPolling();
    pollInterval = setInterval(pollStatusOnce, 5000);
    pollStatusOnce();
  }
  function stopStatusPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = null;
  }
</script>

<svelte:head>
  <title>Memory Lane Patient Portal</title>
  <!-- Material Symbols -->
  <link
    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div
  class="relative flex min-h-screen flex-col bg-background-light dark:bg-background-dark font-sans text-text-main dark:text-cream-50 overflow-hidden"
>
  <BackNavigation
    title="Your Replicas"
    subtitle="Chat with AI replicas or the Memory Lane assistant"
  />

  <div
    class="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full p-4 lg:p-6 gap-6 relative z-10"
  >
    <!-- Main Chat Workspace -->
    <main
      class="flex-1 flex flex-col bg-white dark:bg-charcoal-800 rounded-3xl shadow-sm border border-slate-200 dark:border-charcoal-700 overflow-hidden"
    >
      <!-- Chat Workspace Header -->
      <header
        class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-charcoal-700 bg-white/50 dark:bg-charcoal-800/50 backdrop-blur-sm z-10"
      >
        <div class="flex items-center gap-4">
          <div
            class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 shrink-0"
          >
            {#if selectedReplica?.profileImageUrl}
              <img
                src={selectedReplica.profileImageUrl}
                alt="Avatar"
                class="w-full h-full object-cover"
              />
            {:else}
              <span
                class="material-symbols-outlined text-primary"
                style="font-size: 28px;">psychology</span
              >
            {/if}
          </div>
          <div>
            <h2
              class="text-xl font-bold text-slate-800 dark:text-cream-100 leading-tight"
            >
              {selectedReplica ? selectedReplica.name : "Select a Replica"}
            </h2>
            <p class="text-sm text-text-sub dark:text-cream-300 font-medium">
              {#if selectedReplica}
                {selectedReplica.description}
              {:else}
                Choose an AI to begin chatting
              {/if}
            </p>
          </div>
        </div>
      </header>

      <!-- Chat Messages -->
      <div
        class="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6"
        bind:this={chatContainer}
      >
        {#if chatMessages.length === 0}
          <div class="flex items-center justify-center h-full">
            <div
              class="text-center max-w-md mx-auto p-8 rounded-2xl bg-slate-50 dark:bg-charcoal-700/30 border border-slate-100 dark:border-charcoal-600"
            >
              <div
                class="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center text-primary"
              >
                <span class="material-symbols-outlined text-3xl"
                  >waving_hand</span
                >
              </div>
              <h3
                class="text-xl font-bold text-slate-800 dark:text-cream-50 mb-3"
              >
                {selectedReplica
                  ? `Start chatting with ${selectedReplica.name}`
                  : "Start a conversation"}
              </h3>
              <p class="text-text-sub dark:text-cream-300">
                {selectedReplica
                  ? "Ask anything and your replica will respond based on your personality and training data."
                  : "Type a message below to begin chatting."}
              </p>
            </div>
          </div>
        {:else}
          <div class="space-y-6">
            {#each chatMessages as message (message.id)}
              <div
                class="flex w-full {message.sender === 'user'
                  ? 'justify-end'
                  : 'justify-start'}"
              >
                <div
                  class="flex max-w-[85%] lg:max-w-[75%] gap-3 {message.sender ===
                  'user'
                    ? 'flex-row-reverse'
                    : 'flex-row'}"
                >
                  <!-- Avatar -->
                  <div
                    class="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1 flex items-center justify-center {message.sender ===
                    'user'
                      ? 'bg-primary border border-primary/20 text-white'
                      : 'bg-slate-200 dark:bg-charcoal-600 border border-slate-300 dark:border-charcoal-500'}"
                  >
                    {#if message.sender === "user"}
                      <span class="material-symbols-outlined text-sm"
                        >person</span
                      >
                    {:else if selectedReplica?.profileImageUrl}
                      <img
                        src={selectedReplica.profileImageUrl}
                        alt="Avatar"
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <span
                        class="material-symbols-outlined text-sm text-primary"
                        >psychology</span
                      >
                    {/if}
                  </div>
                  <!-- Bubble -->
                  <div
                    class="flex flex-col gap-1 {message.sender === 'user'
                      ? 'items-end'
                      : 'items-start'}"
                  >
                    <div
                      class="px-5 py-3.5 shadow-sm {message.sender === 'user'
                        ? 'bg-primary text-white rounded-2xl rounded-tr-sm'
                        : 'bg-white dark:bg-charcoal-700 text-slate-800 dark:text-cream-100 border border-slate-200 dark:border-charcoal-600 rounded-2xl rounded-tl-sm'}"
                    >
                      <p class="leading-relaxed whitespace-pre-wrap">
                        {message.text}
                      </p>
                    </div>
                    <span
                      class="text-xs text-text-light dark:text-charcoal-400 font-medium px-1"
                    >
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            {/each}

            <!-- Show preferred question suggestion for new chats -->
            {#if selectedReplica?.preferredQuestion && chatMessages.length <= 2}
              <div
                class="mt-6 p-4 bg-cream-50 dark:bg-charcoal-700/50 rounded-xl border border-cream-200 dark:border-charcoal-600"
              >
                <h4
                  class="text-sm font-medium text-text-light dark:text-text-dark mb-3"
                >
                  Suggested question:
                </h4>
                <button
                  onclick={() =>
                    handleSuggestedQuestion(selectedReplica.preferredQuestion)}
                  class="w-full text-left px-3 py-2 text-sm bg-surface-light dark:bg-surface-dark border border-cream-300 dark:border-charcoal-500 rounded-lg hover:bg-cream-100 dark:hover:bg-charcoal-600 transition-colors duration-200 text-charcoal-700 dark:text-cream-200 hover:text-black dark:hover:text-white"
                >
                  {selectedReplica.preferredQuestion}
                </button>
              </div>
            {/if}

            {#if isSendingMessage}
              <!-- Typing Indicator -->
              <div class="flex w-full justify-start">
                <div class="flex max-w-[85%] lg:max-w-[75%] gap-3 flex-row">
                  <div
                    class="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1 flex items-center justify-center bg-slate-200 dark:bg-charcoal-600 border border-slate-300 dark:border-charcoal-500"
                  >
                    {#if selectedReplica?.profileImageUrl}
                      <img
                        src={selectedReplica.profileImageUrl}
                        alt="Avatar"
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <span
                        class="material-symbols-outlined text-sm text-primary"
                        >psychology</span
                      >
                    {/if}
                  </div>
                  <div class="flex flex-col gap-1 items-start">
                    <div
                      class="px-5 py-3.5 bg-white dark:bg-charcoal-700 border border-slate-200 dark:border-charcoal-600 rounded-2xl rounded-tl-sm flex items-center gap-1.5 min-h-[48px]"
                    >
                      <div
                        class="w-2 h-2 rounded-full bg-slate-400 dark:bg-charcoal-400 animate-bounce"
                        style="animation-delay: 0ms"
                      ></div>
                      <div
                        class="w-2 h-2 rounded-full bg-slate-400 dark:bg-charcoal-400 animate-bounce"
                        style="animation-delay: 150ms"
                      ></div>
                      <div
                        class="w-2 h-2 rounded-full bg-slate-400 dark:bg-charcoal-400 animate-bounce"
                        style="animation-delay: 300ms"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Message Input -->
      <div
        class="border-t border-slate-100 dark:border-charcoal-700 bg-white dark:bg-charcoal-800 p-4 lg:p-6"
      >
        <div
          class="max-w-4xl mx-auto flex items-end gap-3 bg-slate-50 dark:bg-charcoal-700/50 p-2 rounded-2xl border border-slate-200 dark:border-charcoal-600 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all"
        >
          <MessageInput
            on:send={handleSendMessage}
            disabled={isSendingMessage}
          />
        </div>
      </div>
    </main>
  </div>
</div>
