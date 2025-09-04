<!-- Main page - redirect to chat interface -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { protectRoute } from '$lib/auth.js';

  onMount(() => {
    protectRoute();
    // Redirect to the new chat interface
    goto('/chat-replicas');
  });
</script>

<svelte:head>
  <title>Sensay AI - Loading...</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
  <div class="text-center">
    <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
    <p class="text-gray-600 dark:text-gray-400">Loading Sensay AI...</p>
  </div>
</div>
    addMessage($activeConversationId, { 
      sender: 'user', 
      text, 
      meta: $webSearchActive ? { webSearch: true } : undefined 
    });

    // Simulated bot response after 500ms
    setTimeout(() => {
      const responseText = $webSearchActive 
        ? `[Web Search Result] This is a simulated response with web search: ${text}`
        : `This is a simulated response: ${text}`;
        
      addMessage($activeConversationId, {
        sender: 'bot',
        text: responseText
      });
    }, 500);
  }

  // Initial setup
  onMount(() => {
    if (!$activeConversationId && Object.keys($conversations).length === 0) {
      handleNewConversation();
    } else if (!$activeConversationId && $conversationsList.length > 0) {
      setActiveConversation($conversationsList[0].id);
    }
  });
</script>

<svelte:head>
  <title>Chatbot - Sensay AI</title>
</svelte:head>

<main class="h-dvh w-full bg-white dark:bg-gray-900 flex font-sans overflow-hidden transition-colors duration-200">
  <!-- Navigation back to dashboard -->
  <div class="absolute top-4 left-4 z-50 md:hidden">
    <button
      onclick={() => goto('/dashboard')}
      class="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      aria-label="Back to Dashboard"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 19-7-7 7-7"/>
        <path d="M19 12H5"/>
      </svg>
    </button>
  </div>

  <ConversationsSidebar
    conversationsList={$conversationsList}
    activeId={$activeConversationId}
    onselect={handleSelectConversation}
    onnew={handleNewConversation}
    onclear={handleClearConversations}
  />

  <div class="flex-1 flex flex-col h-full bg-white dark:bg-gray-800 shadow-md md:rounded-xl md:m-2 min-w-0 transition-colors duration-200">
    <header class="p-4 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
      <div class="flex items-center gap-4">
        <!-- Desktop back to dashboard -->
        <button
          onclick={() => goto('/dashboard')}
          class="hidden md:flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 19-7-7 7-7"/>
            <path d="M19 12H5"/>
          </svg>
          <span>Dashboard</span>
        </button>
        
        <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-200">
          {$activeConversation?.title || 'Chat'}
        </h1>
      </div>
      
      <!-- Header controls -->
      <div class="flex items-center gap-2">
        <WebSearchButton 
          active={$webSearchActive} 
          ontoggle={handleWebSearchToggle}
        />
        <ThemeToggle />
      </div>
    </header>

    <div class="flex-1 flex flex-col overflow-hidden min-h-0">
      <ChatWindow messages={$activeMessages} />
      <MessageInput 
        onsend={handleSendMessage} 
        webSearchActive={$webSearchActive}
      />
    </div>
  </div>
</main>