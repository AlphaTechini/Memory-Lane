<script>
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
    clearAllConversations
  } from '$lib/stores/chat.js';

  import { derived } from 'svelte/store';

  const conversationsList = derived(conversations, ($conversations) =>
    Object.values($conversations).sort((a, b) => b.lastUpdated - a.lastUpdated)
  );

  const activeConversation = derived(
    [conversations, activeConversationId],
    ([$conversations, $activeConversationId]) =>
      $activeConversationId ? $conversations[$activeConversationId] : null
  );

  const activeMessages = derived(
    [messages, activeConversation],
    ([$messages, $activeConversation]) => {
      if (!$activeConversation) return [];
      return $activeConversation.messageIds.map((id) => $messages[id]).filter(Boolean);
    }
  );

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
    addMessage($activeConversationId, { sender: 'user', text, meta: $webSearchActive ? { webSearch: true } : undefined });

    // simulated bot response after 500ms
    setTimeout(() => {
      addMessage($activeConversationId, {
        sender: 'bot',
        text: `This is a simulated response: ${text}`
      });
    }, 500);
  }
</script>

<main class="h-screen w-screen bg-white dark:bg-gray-900 flex font-sans">
  <ConversationsSidebar
    conversationsList={$conversationsList}
    activeId={$activeConversationId}
    onselect={handleSelectConversation}
    onnew={handleNewConversation}
    onclear={handleClearConversations}
  />

  <div class="flex-1 flex flex-col h-full bg-white dark:bg-gray-800 shadow-md md:rounded-xl md:m-2">
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