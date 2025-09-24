<!-- Replica Chat Interface -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { requireAuthForAction, checkAuthStatus, getAuthToken, apiCall } from '$lib/auth.js';
  import MessageInput from '$lib/components/MessageInput.svelte';
  import BackNavigation from '$lib/components/BackNavigation.svelte';

  const API_BASE_URL = 'http://localhost:4000';

  import { formatTimestamp, relativeTime } from '$lib/utils/formatDate.js';

  let userReplicas = $state([]);
  let selectedReplica = $state(null);
  let isLoadingReplicas = $state(false); // Changed default to false for non-auth users
  let isFetchingAll = $state(false);
  let chatMessages = $state([]);
  let isSendingMessage = $state(false);
  let isAuthenticated = $state(false);
  let chatContainer; // Reference to chat messages container
  let currentConversationId = $state(null); // Current conversation ID for persistence
  
  // Sidebar navigation states
  let sidebarView = $state('replicas'); // 'replicas' | 'conversations'
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
  const TRAIN_SESSION_KEY = 'activeTrainingSession';
  const TRAIN_BUFFER_KEY = 'activeTrainingBuffer';

  // Auto-scroll function to scroll to bottom of chat
  function scrollToBottom() {
    if (chatContainer) {
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 10); // Small delay to ensure DOM is updated
    }
  }

  // Format elapsed time for training session
  function formatElapsedTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Auto-scroll when chat messages change
  $effect(() => {
    if (chatMessages.length > 0) {
      scrollToBottom();
    }
  });

  // Demo replicas for non-authenticated users
  const demoReplicas = [
    {
      replicaId: 'demo-1',
      name: 'Alex Chen',
      description: 'A creative software developer passionate about AI and innovation',
      profileImageUrl: null,
      coverageScore: 85,
      isActive: true,
      isDemo: true
    },
    {
      replicaId: 'demo-2', 
      name: 'Dr. Sarah Johnson',
      description: 'A research scientist specializing in machine learning and data science',
      profileImageUrl: null,
      coverageScore: 92,
      isActive: true,
      isDemo: true
    },
    {
      replicaId: 'demo-3',
      name: 'Marcus Rodriguez',
      description: 'An entrepreneur and business strategist with expertise in startups',
      profileImageUrl: null,
      coverageScore: 78,
      isActive: true,
      isDemo: true
    }
  ];

  onMount(async () => {
    isAuthenticated = checkAuthStatus();
    if (isAuthenticated) {
      await loadUserReplicas();
      // Reconcile with remote if list empty or first load
      try {
        if (!userReplicas.length) {
          const token = getAuthToken();
          console.debug('Reconcile attempt - token present:', !!token);
          // Do not set Content-Type when there's no body, Fastify rejects empty JSON bodies
          const recRes = await fetch(`${API_BASE_URL}/api/replicas/reconcile`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (recRes.ok) {
            const recData = await recRes.json();
            if (recData.added?.length || recData.updated?.length) {
              await loadUserReplicas();
            }
          }
        }
      } catch (e) {
        console.warn('Reconcile attempt failed', e);
      }

      // Check for replicaId in query params
      try {
        const params = new URLSearchParams(window.location.search);
        const newId = params.get('replicaId');
        let autoReplica = null;
        if (newId) {
          autoReplica = userReplicas.find(r => r.replicaId === newId) || null;
        }
        // Fallback to sessionStorage item if not yet in list
        if (!autoReplica) {
          const stored = sessionStorage.getItem('newReplica');
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                // Backend returns id, we store replicaId as same
                const match = userReplicas.find(r => r.replicaId === parsed.id || r.replicaId === parsed.replicaId);
                if (match) {
                  autoReplica = match;
                } else if (parsed.id) {
                  // If list still empty attempt server fetch for that replica
                  const fetched = await fetchReplicaById(parsed.id);
                  if (fetched) {
                    autoReplica = fetched;
                    if (!userReplicas.find(r => r.replicaId === fetched.replicaId)) {
                      userReplicas = [fetched, ...userReplicas];
                    }
                  } else {
                    // Create temporary placeholder from session data until proper fetch
                    autoReplica = { 
                      replicaId: parsed.id, 
                      name: parsed.name || 'New Replica', 
                      description: parsed.description || 'Recently created replica', 
                      profileImageUrl: parsed.profileImageUrl || null, 
                      coverageScore: parsed.coverageScore || 0, 
                      isActive: true,
                      lastTrained: new Date()
                    };
                    userReplicas = [autoReplica, ...userReplicas];
                    // Trigger a refresh of user replicas to get the proper data
                    setTimeout(() => loadUserReplicas(), 2000);
                  }
                }
              } catch (e) {
                console.warn('Failed to parse newReplica from session storage', e);
              }
            }
        }
        if (autoReplica) {
          selectedReplica = autoReplica;
          chatMessages = [];
          
          // Add a welcome message for new replicas
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('created') === 'true') {
            chatMessages = [{
              id: Date.now(),
              text: `🎉 Your replica "${autoReplica.name}" has been successfully created and trained! I'm ready to chat with you.`,
              sender: 'replica',
              timestamp: new Date()
            }];
          }
          
          // Clean stored newReplica so it doesn't auto-select again
          sessionStorage.removeItem('newReplica');
        }
      } catch (e) {
        console.warn('Auto-select replica failed', e);
      }
    } else {
      // No token: try to populate replicas from cached userData
      try {
        const cached = localStorage.getItem('userData');
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
      if (trainingSession && trainingSession.status === 'PROCESSING') {
        beginStatusPolling();
      }
    } catch (e) {
      console.warn('Failed to restore training session');
    }
  });

  async function loadUserReplicas() {
    if (!isAuthenticated) return;
    
    isLoadingReplicas = true;
    try {
      console.debug('chat-replicas loadUserReplicas - token present:', !!getAuthToken());
      const response = await apiCall('/api/user/replicas', { method: 'GET' });

      if (response.ok) {
        const data = await response.json();
        userReplicas = data.replicas || [];
      } else {
        console.error('Failed to load replicas');
      }
    } catch (error) {
      console.error('Error loading replicas:', error);
    } finally {
      isLoadingReplicas = false;
    }
  }

  async function fetchReplicaById(replicaId) {
    try {
      console.debug('fetchReplicaById - token present:', !!getAuthToken(), 'replicaId:', replicaId);
      const res = await apiCall(`/api/replicas/${replicaId}`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        return data.replica;
      }
    } catch (e) {
      console.warn('Failed single replica fetch', e);
    }
    return null;
  }

  async function fetchAllReplicas() {
    if (!isAuthenticated) return;
    
    isFetchingAll = true;
    try {
      const token = getAuthToken();
      
      console.log('Starting fetch all replicas...');
      
      // First call reconcile to sync with remote Sensay API
      console.log('Calling reconcile endpoint...');
      console.debug('fetchAllReplicas - token present:', !!token);
      // Do not set Content-Type for an empty POST body (Fastify throws on empty JSON body)
      const reconcileResponse = await fetch(`${API_BASE_URL}/api/replicas/reconcile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (reconcileResponse.ok) {
        const reconcileData = await reconcileResponse.json();
        console.log('Reconcile successful:', reconcileData);
        
        // Then fetch updated user replicas
        console.log('Fetching updated user replicas...');
        await loadUserReplicas();
        
        console.log('All replicas fetched successfully, total:', userReplicas.length);
        
        // Show success message briefly
        const originalButtonText = 'Fetch All Replicas';
        setTimeout(() => {
          if (!isFetchingAll) {
            // Button text will be reset when isFetchingAll becomes false
          }
        }, 2000);
        
      } else {
        const errorData = await reconcileResponse.text();
        console.error('Reconcile failed with status:', reconcileResponse.status, errorData);
        
        // Try to fetch user replicas anyway
        console.log('Attempting to fetch user replicas despite reconcile failure...');
        await loadUserReplicas();
      }
      
    } catch (error) {
      console.error('Error in fetchAllReplicas:', error);
      
      // Try to fetch user replicas as fallback
      try {
        console.log('Fallback: attempting basic replica fetch...');
        await loadUserReplicas();
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
      }
    } finally {
      isFetchingAll = false;
    }
  }

  // Sidebar navigation functions
  function expandReplicaConversations(replica) {
    if (!requireAuthForAction('view conversation history')) return;
    
    expandedReplica = replica;
    sidebarView = 'conversations';
    loadConversations(replica.replicaId);
  }

  function backToReplicasList() {
    sidebarView = 'replicas';
    expandedReplica = null;
    conversations = [];
    selectedConversation = null;
  }

  async function loadConversations(replicaId) {
    if (!isAuthenticated) return;
    
    isLoadingConversations = true;
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/replicas/${replicaId}/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        conversations = data.conversations || [];
      } else {
        console.error('Failed to load conversations');
        conversations = [];
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      conversations = [];
    } finally {
      isLoadingConversations = false;
    }
  }

  async function selectConversation(conversation) {
    selectedConversation = conversation;
    selectedReplica = expandedReplica;
    currentConversationId = conversation.id; // Set conversation ID for continued chat
    
    // Load conversation messages from API
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/conversations/${conversation.id}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        chatMessages = data.messages || [];
      } else {
        console.error('Failed to load conversation messages');
        chatMessages = [];
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      chatMessages = [];
    }
    
    // Reset training state when loading a conversation
    stopTrainingTimer();
    trainingSession = null;
    trainingBuffer = [];
    localStorage.removeItem(TRAIN_SESSION_KEY);
    localStorage.removeItem(TRAIN_BUFFER_KEY);
  }

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
    if (!requireAuthForAction('view conversations')) return;
    
    selectedReplicaForSidebar = replica;
    sidebarView = 'conversations';
    await loadConversations(replica.replicaId);
  }

  async function loadConversation(conversationId) {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        chatMessages = data.messages || [];
        selectedReplica = selectedReplicaForSidebar; // Set the active replica for chat
      } else {
        console.error('Failed to load conversation messages');
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
    }
  }

  function selectReplica(replica) {
    if (!requireAuthForAction('chat with your replicas')) return;
    
    // Set the selected replica for chat
    selectedReplica = replica;
    chatMessages = [];
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

  function startGenericChat() {
    selectedReplica = null;
    chatMessages = [];
    currentConversationId = null; // Reset conversation ID for generic chat
  }

  async function sendMessage(text) {
    if (!text.trim() || isSendingMessage) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      text,
      sender: 'user',
      timestamp: new Date()
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
        if (!requireAuthForAction('chat with your replica')) return;
        
        // Chat with specific replica
        response = await fetch(`${API_BASE_URL}/api/replicas/${selectedReplica.replicaId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: text,
            conversationId: currentConversationId, // Include current conversation ID
            context: chatMessages.slice(-10).map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }))
          })
        });
      } else {
        // Generic chat (no auth required)
        response = await fetch(`${API_BASE_URL}/api/chat/generic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({
            message: text,
            context: chatMessages.slice(-10).map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }))
          })
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
          text: data.response?.message || data.message || 'Sorry, I could not process that.',
          sender: 'bot',
          timestamp: new Date()
        };
        chatMessages = [...chatMessages, botMessage];
        
        // Collect bot response for training if session is active
        if (trainingSession && !trainingSession.status) {
          trainingBuffer.push(`Assistant: ${botMessage.text}`);
          localStorage.setItem(TRAIN_BUFFER_KEY, JSON.stringify(trainingBuffer));
        }
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };
      chatMessages = [...chatMessages, errorMessage];
    } finally {
      isSendingMessage = false;
    }
  }

  function handleSendMessage(event) {
    sendMessage(event.detail.text);
    if (trainingSession && event.detail.text?.trim()) {
      trainingBuffer = [...trainingBuffer, event.detail.text.trim()];
  localStorage.setItem(TRAIN_BUFFER_KEY, JSON.stringify(trainingBuffer));
    }
  }

  async function startTrainingSession() {
    console.log('startTrainingSession called');
    console.log('selectedReplica:', selectedReplica);
    console.log('trainingSession:', trainingSession);
    
    if (!selectedReplica || trainingSession) {
      console.log('Early return: no replica or training session exists');
      return;
    }
    if (!requireAuthForAction('start a training session')) {
      console.log('Early return: auth check failed');
      return;
    }
    
    console.log('Starting training session...');
    // Just start the training session locally - no API call needed yet
    trainingSession = {
      replicaId: selectedReplica.replicaId,
      startedAt: new Date().toISOString(),
      status: null // collecting phase
    };
    trainingBuffer = [];
    localStorage.setItem(TRAIN_SESSION_KEY, JSON.stringify(trainingSession));
    localStorage.setItem(TRAIN_BUFFER_KEY, JSON.stringify(trainingBuffer));
    
    // Start the timer
    startTrainingTimer();
    console.log('Training session started locally');
  }

  async function endTrainingSession() {
    if (!trainingSession || !selectedReplica) return;
    
    // Prevent multiple submissions
    if (isSubmittingTraining) {
      console.log('Training submission already in progress, ignoring duplicate call');
      return;
    }
    
    isSubmittingTraining = true;
    
    try {
      // Collect all chat messages as training data
      const chatText = trainingBuffer.join('\n\n');
      console.log('Submitting training data:', chatText.substring(0, 200) + '...');
      console.log('Training buffer length:', trainingBuffer.length);
      
      if (trainingBuffer.length === 0) {
        alert('No training data collected. Start a conversation first!');
        return; // Exit early
      }
      
      const token = getAuthToken();
      console.log('Token available:', !!token);
      
      // Generate a session ID based on the start time
      const sessionId = trainingSession.startedAt.replace(/[:.]/g, '-');
      
      // Submit the collected chat messages as training data
      console.log('Submitting training data to API...');
      const response = await fetch(`${API_BASE_URL}/api/replicas/${selectedReplica.replicaId}/training-sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ 
          rawText: chatText,
          title: `Chat Session ${trainingSession.startedAt}`
        })
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Training submission successful:', data);
        
        // Update training session with the results
        trainingSession = { 
          ...trainingSession, 
          entryId: data.entryId, 
          status: data.status 
        };
        localStorage.setItem(TRAIN_SESSION_KEY, JSON.stringify(trainingSession));
        
        if (data.status === 'PROCESSING') {
          beginStatusPolling();
        }
        
        console.log('Training session updated with status:', data.status);
        alert('Training data submitted successfully! Status: ' + data.status);
      } else {
        const errorText = await response.text();
        console.error('Failed to submit training data:', errorText);
        alert('Failed to submit training data. Check console for details.');
      }
    } catch (e) {
      console.error('Error in endTrainingSession:', e);
      alert('An error occurred while submitting training data. Check console for details.');
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
      const res = await fetch(`${API_BASE_URL}/api/replicas/${selectedReplica.replicaId}/kb/${trainingSession.entryId}/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status?.status) {
          trainingSession = { ...trainingSession, status: data.status.status };
          localStorage.setItem(TRAIN_SESSION_KEY, JSON.stringify(trainingSession));
          if (['READY','FAILED','ERROR'].includes(trainingSession.status)) {
            stopStatusPolling();
          }
        }
      }
    } catch (e) {
      // ignore transient errors
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
  <title>Chat with Your Replicas - Memory Lane</title>
</svelte:head>

<div class="bg-gray-50 dark:bg-gray-900">
  <BackNavigation 
    title="Chat with Your Replicas" 
    subtitle="Start conversations with AI replicas or chat with the generic Memory Lane AI"
  />
  
  <div class="h-[calc(100vh-8rem)] flex">
  <!-- Replica Selection Sidebar -->
  <div class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Replicas</h2>
      {#if selectedReplica && isAuthenticated}
        <div class="mb-3 space-y-2">
          {#if !trainingSession}
            <button onclick={startTrainingSession} class="w-full text-xs px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">Start Training Session</button>
          {:else}
            <div class="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded text-xs text-indigo-700 dark:text-indigo-300 flex flex-col gap-1">
              <div class="flex justify-between items-center">
                <span>
                  {#if trainingSession.status === 'PROCESSING'}
                    Processing...
                  {:else if trainingSession.status === 'READY'}
                    Trained ✓
                  {:else}
                    Collecting messages ({trainingBuffer.length})
                  {/if}
                </span>
                <div class="flex items-center gap-2">
                  {#if !trainingSession.status && trainingTimer}
                    <span class="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-800 px-1.5 py-0.5 rounded">
                      {formatElapsedTime(trainingElapsed)}
                    </span>
                  {/if}
                  {#if trainingSession.status === 'PROCESSING'}
                    <svg class="w-4 h-4 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="4" class="opacity-25"></circle><path d="M4 12a8 8 0 018-8" stroke-width="4" class="opacity-75"></path></svg>
                  {/if}
                    {#if ['PROCESSING','READY'].includes(trainingSession.status)}
                    <button onclick={pollStatusOnce} class="text-[10px] px-1.5 py-0.5 border border-indigo-300 dark:border-indigo-600 rounded text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition">Refresh</button>
                  {/if}
                </div>
              </div>
              {#if !trainingSession.status}
                <div class="h-1.5 bg-indigo-200 dark:bg-indigo-800 rounded overflow-hidden">
                  <div class="h-full bg-indigo-600 dark:bg-indigo-400" style="width:{Math.min(100,(trainingBuffer.join('\n\n').length/20000)*100)}%"></div>
                </div>
                <div class="flex justify-between text-[10px] text-indigo-700 dark:text-indigo-300">
                  <span>{trainingBuffer.join('\n\n').length} chars</span>
                  <span>{Math.round(Math.min(100,(trainingBuffer.join('\n\n').length/20000)*100))}%</span>
                </div>
                {#if trainingBuffer.join('\n\n').length > 18000}
                  <div class="text-[10px] text-orange-600 dark:text-orange-400">Approaching size limit. Consider submitting.</div>
                {/if}
              {/if}
            </div>
            <div class="flex gap-2">
              <button onclick={endTrainingSession} disabled={isSubmittingTraining || trainingBuffer.length===0} class="flex-1 text-xs px-3 py-2 bg-green-600 disabled:opacity-50 text-white rounded-md">{isSubmittingTraining ? 'Submitting...' : 'End & Submit'}</button>
              <button onclick={() => { trainingSession=null; trainingBuffer=[]; }} class="flex-1 text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">Cancel</button>
            </div>
          {/if}
        </div>
      {/if}
      <button
  onclick={() => {
          if (!requireAuthForAction('create a new replica')) return;
          goto('/create-replicas');
        }}
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mb-2"
      >
        Create New Replica
      </button>
      <button
  onclick={fetchAllReplicas}
        disabled={isFetchingAll}
        class="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isFetchingAll ? 'Fetching...' : 'Fetch All Replicas'}
      </button>
    </div>

    <!-- Sidebar Content -->
    <div class="flex-1 overflow-y-auto p-4">
      {#if sidebarView === 'replicas'}
        <!-- Main Replicas View -->
        {#if isLoadingReplicas}
          <div class="flex items-center justify-center py-8">
            <svg class="animate-spin w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </div>
        {:else if !isAuthenticated}
          <div class="text-center py-8">
            <div class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Demo Mode</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              You're viewing in demo mode. Log in to create and chat with your personal AI replicas.
            </p>
            <div class="space-y-2">
              <button
                onclick={() => goto('/login')}
                class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Log In
              </button>
              <button
                onclick={() => goto('/signup')}
                class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Sign Up
              </button>
            </div>
          </div>
        {:else if userReplicas.length === 0}
          <div class="text-center py-8">
            <div class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Replicas Yet</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">Create your first AI replica to get started</p>
            <button
              onclick={() => goto('/create-replicas')}
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Your First Replica
            </button>
          </div>
        {:else if isAuthenticated}
          <!-- Show user's actual replicas when authenticated -->
          <div class="space-y-4">
            {#each userReplicas as replica (replica.replicaId)}
              <div class="border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                {selectedReplica?.replicaId === replica.replicaId ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}">
                
                <!-- Replica Header -->
                <div
                  role="button"
                  tabindex="0"
                  onclick={() => selectReplica(replica)}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectReplica(replica); } }}
                  class="w-full p-4 text-left"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                      {#if replica.profileImageUrl}
                        <img 
                          src={replica.profileImageUrl} 
                          alt={replica.name}
                          class="w-full h-full object-cover"
                        />
                      {:else}
                        <div class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                          </svg>
                        </div>
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">{replica.name}
                        {#if replica.lastTrained}
                          <span class="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            Trained
                            {#if formatTimestamp(replica.lastTrained)}
                              <span class="ml-2 text-[10px] text-gray-600 dark:text-gray-300">{formatTimestamp(replica.lastTrained)}</span>
                            {/if}
                          </span>
                        {/if}
                      </h4>
                      <p class="text-sm text-gray-600 dark:text-gray-400 truncate">{replica.description}</p>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          {replica.coverageScore}% trained
                        </span>
                        {#if replica.isActive}
                          <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                        {/if}
                      </div>
                    </div>
                    <button type="button"
                      aria-label="View conversations"
                      onclick={(e) => {
                        e.stopPropagation();
                        openReplicaConversations(replica);
                      }}
                      class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                      title="View conversations"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <!-- Show demo replicas for non-authenticated users -->
          <div class="space-y-4">
            <div class="text-center py-4">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Demo Replicas - Click to see what Memory Lane can do!
              </p>
            </div>
            {#each demoReplicas as replica (replica.replicaId)}
              <button
                onclick={() => selectReplica(replica)}
                class="w-full p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left relative
                  {selectedReplica?.replicaId === replica.replicaId ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}"
              >
                <!-- Demo overlay -->
                <div class="absolute top-2 right-2">
                  <span class="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs rounded-full">
                    Demo
                  </span>
                </div>
                
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                    <div class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                    </div>
                  </div>
                  <div class="flex-1 min-w-0 pr-8">
                    <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate">{replica.name}</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400 truncate">{replica.description}</p>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                        {replica.coverageScore}% trained
                      </span>
                      <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                    </div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}

        {#if (isAuthenticated && userReplicas.length > 0) || (!isAuthenticated && demoReplicas.length > 0)}
          <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onclick={startGenericChat}
              class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left
                {!selectedReplica ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
                  <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                </div>
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-gray-100">Generic Chatbot</h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Chat with AI assistant</p>
                </div>
              </div>
            </button>
          </div>
        {/if}
      
      {:else if sidebarView === 'conversations'}
        <!-- Conversations View for Selected Replica -->
        <div class="space-y-4">
          <!-- Back Button -->
          <button
            onclick={backToReplicasList}
            class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Replicas
          </button>

          <!-- Replica Header -->
          {#if selectedReplicaForSidebar}
            <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600">
                  {#if selectedReplicaForSidebar.profileImageUrl}
                    <img 
                      src={selectedReplicaForSidebar.profileImageUrl} 
                      alt={selectedReplicaForSidebar.name}
                      class="w-full h-full object-cover"
                    />
                  {:else}
                    <div class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                    </div>
                  {/if}
                </div>
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-gray-100">{selectedReplicaForSidebar.name}</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Conversations</p>
                </div>
              </div>
            </div>
          {/if}

          <!-- New Conversation Button -->
          <button
            onclick={startNewConversation}
            class="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left
              {!selectedConversation ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
              </div>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-gray-100">New Conversation</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">Start a fresh chat</p>
              </div>
            </div>
          </button>

          <!-- Conversations List -->
          {#if isLoadingConversations}
            <div class="flex items-center justify-center py-8">
              <svg class="animate-spin w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </div>
          {:else if conversations.length === 0}
            <div class="text-center py-8">
              <div class="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Conversations Yet</h3>
              <p class="text-gray-600 dark:text-gray-400">Start your first conversation with {selectedReplicaForSidebar?.name}</p>
            </div>
          {:else}
            <div class="space-y-2">
              {#each conversations as conversation (conversation.id)}
                <button
                  onclick={() => loadConversation(conversation.id)}
                  class="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                      <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {conversation.title || `Conversation ${conversation.id.slice(-6)}`}
                      </h4>
                      <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {conversation.lastMessage || 'No messages yet'}
                      </p>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                          {conversation.messageCount || 0} messages
                        </span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimestamp(conversation.updatedAt || conversation.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Chat Area -->
  <div class="flex-1 flex flex-col">
    {#if selectedReplica}
      <!-- Replica Chat Header -->
      <div class="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600">
            {#if selectedReplica.profileImageUrl}
              <img 
                src={selectedReplica.profileImageUrl} 
                alt={selectedReplica.name}
                class="w-full h-full object-cover"
              />
            {:else}
              <div class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
            {/if}
          </div>
          <div>
            <h3 class="font-medium text-gray-900 dark:text-gray-100">{selectedReplica.name}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Your AI replica</p>
          </div>
        </div>
      </div>
    {:else if userReplicas.length > 0}
      <!-- Generic Chat Header -->
      <div class="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
          </div>
          <div>
            <h3 class="font-medium text-gray-900 dark:text-gray-100">Generic AI Assistant</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">General purpose chatbot</p>
          </div>
        </div>
      </div>
    {:else}
      <!-- Welcome Header -->
      <div class="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 class="font-medium text-gray-900 dark:text-gray-100">Welcome to Memory Lane</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">Create your first replica to get started</p>
      </div>
    {/if}

    <!-- Chat Messages -->
    <div class="flex-1 overflow-y-auto p-4" bind:this={chatContainer}>
      {#if chatMessages.length === 0}
        <div class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {selectedReplica ? `Start chatting with ${selectedReplica.name}` : 'Start a conversation'}
            </h3>
            <p class="text-gray-600 dark:text-gray-400">
              {selectedReplica 
                ? 'Ask anything and your replica will respond based on your personality and training data.' 
                : 'Type a message below to begin chatting.'}
            </p>
          </div>
        </div>
      {:else}
        <div class="space-y-4">
          {#each chatMessages as message (message.id)}
            <div class="flex {message.sender === 'user' ? 'justify-end' : 'justify-start'}">
              <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg {
                message.sender === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }">
                {message.text}
              </div>
            </div>
          {/each}
          {#if isSendingMessage}
            <div class="flex justify-start">
              <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700">
                <div class="flex space-x-1">
                  <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                  <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Message Input -->
    <div class="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
  <MessageInput on:send={handleSendMessage} disabled={isSendingMessage} />
    </div>
  </div>
  </div>
</div>
