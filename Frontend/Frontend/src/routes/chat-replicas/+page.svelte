<!-- Replica Chat Interface -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { protectRoute } from '$lib/auth.js';
  import MessageInput from '$lib/components/MessageInput.svelte';

  let userReplicas = $state([]);
  let selectedReplica = $state(null);
  let isLoadingReplicas = $state(true);
  let chatMessages = $state([]);
  let isSendingMessage = $state(false);

  onMount(async () => {
    protectRoute();
    await loadUserReplicas();
  });

  async function loadUserReplicas() {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/user/replicas', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

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

  function selectReplica(replica) {
    selectedReplica = replica;
    chatMessages = [];
  }

  function startGenericChat() {
    selectedReplica = null;
    chatMessages = [];
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

    isSendingMessage = true;

    try {
      const token = localStorage.getItem('authToken');
      let response;

      if (selectedReplica) {
        // Chat with specific replica
        response = await fetch(`/api/replicas/${selectedReplica.replicaId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: text,
            context: chatMessages.slice(-10).map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }))
          })
        });
      } else {
        // Generic chat (fallback)
        response = await fetch('/api/chat/generic', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
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
        const botMessage = {
          id: Date.now() + 1,
          text: data.response?.message || data.message || 'Sorry, I could not process that.',
          sender: 'bot',
          timestamp: new Date()
        };
        chatMessages = [...chatMessages, botMessage];
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
  }
</script>

<svelte:head>
  <title>Chat with Your Replicas - Sensay AI</title>
</svelte:head>

<div class="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 flex">
  <!-- Replica Selection Sidebar -->
  <div class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Replicas</h2>
      <button
        onclick={() => goto('/create-replicas')}
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Create New Replica
      </button>
    </div>

    <!-- Replicas List -->
    <div class="flex-1 overflow-y-auto p-4">
      {#if isLoadingReplicas}
        <div class="flex items-center justify-center py-8">
          <svg class="animate-spin w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
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
      {:else}
        <div class="space-y-4">
          {#each userReplicas as replica}
            <button
              onclick={() => selectReplica(replica)}
              class="w-full p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left
                {selectedReplica?.replicaId === replica.replicaId ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}"
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
                  <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate">{replica.name}</h4>
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
              </div>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Generic Chat Option -->
      {#if userReplicas.length > 0}
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
        <h3 class="font-medium text-gray-900 dark:text-gray-100">Welcome to Sensay AI</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">Create your first replica to get started</p>
      </div>
    {/if}

    <!-- Chat Messages -->
    <div class="flex-1 overflow-y-auto p-4">
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
          {#each chatMessages as message}
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
      <MessageInput on:sendMessage={handleSendMessage} disabled={isSendingMessage} />
    </div>
  </div>
</div>
