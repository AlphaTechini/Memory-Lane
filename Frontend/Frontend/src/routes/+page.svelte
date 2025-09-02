<script>
  import { onMount } from 'svelte';
  import ConversationsSidebar from '$lib/components/ConversationsSidebar.svelte';
  import ChatWindow from '$lib/components/ChatWindow.svelte';
  import MessageInput from '$lib/components/MessageInput.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import WebSearchButton from '$lib/components/WebSearchButton.svelte';
  import {
    conversationsState,
    activeConversationIdState,
    webSearchActiveState,
    conversationsList,
    activeConversation,
    activeMessages,
    createConversation,
    addMessage,
    setActiveConversation,
    clearAllConversations
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

  function handleWebSearchToggle(event) {
    webSearchActiveState.value = event.active;
  }

  async function handleSendMessage(event) {
    const { text } = event.detail;
    
    // Ensure we have an active conversation
    if (!activeConversationIdState.value) {
      handleNewConversation();
    }

    // Add user message with web search metadata if active
    addMessage(activeConversationIdState.value, { 
      sender: 'user', 
      text, 
      meta: webSearchActiveState.value ? { webSearch: true } : undefined 
    });

    // Simulated bot response after 500ms
    setTimeout(() => {
      const responseText = webSearchActiveState.value 
        ? `[Web Search Result] This is a simulated response with web search: ${text}`
        : `This is a simulated response: ${text}`;
        
      addMessage(activeConversationIdState.value, {
        sender: 'bot',
        text: responseText
      });
    }, 500);
  }

  // Initial setup
  onMount(() => {
    if (!activeConversationIdState.value && Object.keys(conversationsState.value).length === 0) {
      handleNewConversation();
    } else if (!activeConversationIdState.value && conversationsList.length > 0) {
      setActiveConversation(conversationsList[0].id);
    }
  });
</script>

<main class="h-dvh w-full bg-white dark:bg-gray-900 flex font-sans overflow-hidden transition-colors duration-200">
  <ConversationsSidebar
    conversationsList={conversationsList}
    activeId={activeConversationIdState.value}
    onselect={handleSelectConversation}
    onnew={handleNewConversation}
    onclear={handleClearConversations}
  />

  <div class="flex-1 flex flex-col h-full bg-white dark:bg-gray-800 shadow-md md:rounded-xl md:m-2 min-w-0 transition-colors duration-200">
    <header class="p-4 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-200">
        {activeConversation?.title || 'Chat'}
      </h1>
      
      <!-- Header controls -->
      <div class="flex items-center gap-2">
        <WebSearchButton 
          active={webSearchActiveState.value} 
          ontoggle={handleWebSearchToggle}
        />
        <ThemeToggle />
      </div>
    </header>

    <div class="flex-1 flex flex-col overflow-hidden min-h-0">
      <ChatWindow messages={activeMessages} />
      <MessageInput 
        onsend={handleSendMessage} 
        webSearchActive={webSearchActiveState.value}
      />
    </div>
  </div>
</main>