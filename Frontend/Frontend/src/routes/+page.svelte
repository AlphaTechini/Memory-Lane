<script>
  import { onMount } from 'svelte';
  import { derived } from 'svelte/store';
  import ConversationsSidebar from '$lib/components/ConversationsSidebar.svelte';
  import ChatWindow from '$lib/components/ChatWindow.svelte';
  import MessageInput from '$lib/components/MessageInput.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import {
    conversations,
    messages,
    activeConversationId,
    webSearchActive,
    createConversation,
    addMessage,
    setActiveConversation,
    clearAllConversations,
    conversationsList,
    activeConversation,
    activeMessages
  } from '$lib/stores/chat.js';

  function handleSelectConversation(event) {
    setActiveConversation(event.detail.id);
  }

  function handleNewConversation() {
    const newId = createConversation();
    setActiveConversation(newId);
  }

  function handleClearConversations() {
    clearAllConversations();
  }

  async function handleSendMessage(event) {
    const { text } = event.detail;

    // ensure we have an active conversation
    if (!$activeConversationId) {
      handleNewConversation();
    }

    // add user message
    addMessage($activeConversationId, { 
      sender: 'user', 
      text, 
      meta: $webSearchActive ? { webSearch: true } : undefined 
    });

    // simulated bot response after 500ms
    setTimeout(() => {
      addMessage($activeConversationId, {
        sender: 'bot',
        text: `This is a simulated response: ${text}`
      });
    }, 500);
  }

  // Initial setup - moved to onMount for SSR safety
  onMount(() => {
    if (!$activeConversationId && Object.keys($conversations).length === 0) {
      handleNewConversation();
    } else if (!$activeConversationId && $conversationsList.length > 0) {
      setActiveConversation($conversationsList[0].id);
    }
  });
</script>

<main class="h-dvh w-full bg-white dark:bg-gray-900 flex font-sans overflow-hidden">
  <ConversationsSidebar
    conversationsList={$conversationsList}
    activeId={$activeConversationId}
    onselect={handleSelectConversation}
    onnew={handleNewConversation}
    onclear={handleClearConversations}
  />

  <div class="flex-1 flex flex-col h-full bg-white dark:bg-gray-800 shadow-md md:rounded-xl md:m-2 min-w-0">
    <header class="p-4 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-200">
        {$activeConversation?.title || 'Chat'}
      </h1>
      <ThemeToggle />
    </header>

    <div class="flex-1 flex flex-col overflow-hidden min-h-0">
      <ChatWindow messages={$activeMessages} />
      <MessageInput onsend={handleSendMessage} />
    </div>
  </div>
</main>