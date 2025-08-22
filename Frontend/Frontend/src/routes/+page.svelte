<script>
  import { onMount } from 'svelte';
  import { derived } from 'svelte/store';
  import ConversationsSidebar from '$lib/components/ConversationsSidebar.svelte';
  import ChatWindow from '$lib/components/ChatWindow.svelte';
  import MessageInput from '$lib/components/MessageInput.svelte';
  import WebSearchButton from '$lib/components/WebSearchButton.svelte';
  import {
    conversations,
    messages,
    activeConversationId,
    webSearchActive,
    createConversation,
    addMessage,
    setActiveConversation,
    toggleWebSearch
  } from '$lib/stores/chat.js';

  // --- Derived Stores ---
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

  // --- Event Handlers ---
  function handleSelectConversation(event) {
    setActiveConversation(event.detail.id);
  }

  function handleNewConversation() {
    const newId = createConversation();
    setActiveConversation(newId);
  }

  function handleSendMessage(event) {
    const { text } = event.detail;
    if (!$activeConversationId) return;

    const meta = $webSearchActive ? { webSearch: true } : undefined;
    addMessage($activeConversationId, { sender: 'user', text, meta });

    // Dummy bot response
    setTimeout(() => {
      addMessage($activeConversationId, {
        sender: 'bot',
        text: `This is a simulated response to "${text}".`
      });
    }, 1000);
  }

  function handleToggleWebSearch() {
    toggleWebSearch();
  }

  // --- Initial Setup (Client-side only) ---
  onMount(() => {
    if (!$activeConversationId && Object.keys($conversations).length === 0) {
      handleNewConversation();
    } else if (!$activeConversationId && $conversationsList.length > 0) {
      setActiveConversation($conversationsList[0].id);
    }
  });
</script>

<main class="h-screen w-screen bg-gray-100 flex font-sans">
  <ConversationsSidebar
    conversationsList={$conversationsList}
    activeId={$activeConversationId}
    on:select={handleSelectConversation}
    on:new={handleNewConversation}
  />

  <div class="flex-1 flex flex-col h-full bg-neutral-50 shadow-md md:rounded-xl md:m-2">
    <header class="p-4 border-b border-gray-200 flex justify-between items-center">
      <h1 class="text-lg font-semibold">
        {$activeConversation?.title || 'ChatGPT'}
      </h1>
      <WebSearchButton active={$webSearchActive} on:toggle={handleToggleWebSearch} />
    </header>

    <div class="flex-1 flex flex-col overflow-hidden">
      <ChatWindow messages={$activeMessages} />
      <MessageInput on:send={handleSendMessage} />
    </div>
  </div>
</main>
