<script>
   import { onMount } from 'svelte';
   import { derived } from 'svelte/store';
   import ConversationsSidebar from './lib/components/ConversationsSidebar.svelte';
   import ChatWindow from './lib/components/ChatWindow.svelte';
   import MessageInput from './lib/components/MessageInput.svelte';
   import {
     conversations,
     messages,
     activeConversationId,
     createConversation,
     addMessage,
     setActiveConversation
   } from './lib/stores/chat.js';

   // --- Component Architecture & Data Flow ---
   // This App.svelte component acts as the main orchestrator.
   // 1. It subscribes to all Svelte stores from `chat.js` (`$conversations`, `$messages`, etc.).
   // 2. It uses `derived` stores to compute data needed by child components, like `conversationsList` and `activeMessages`.
   //    This is efficient because these derived values only re-calculate when their dependencies change.
   // 3. It passes this reactive data down to child components as props.
   // 4. It listens for events dispatched from child components (`onselect`, `onnew`, `onsend`).
   // 5. When an event is received, it calls the appropriate helper function from `chat.js` (e.g., `setActiveConversation`).
   // 6. This updates the central stores, which in turn causes the derived stores to update, and the changes flow
   //    reactively down through the component tree, updating the UI.
   // 7. The stores themselves handle the persistence to localStorage.
 
   // --- Derived Stores ---
 
   // Create a sorted list of conversations for the sidebar.
   const conversationsList = derived(conversations, ($conversations) =>
     Object.values($conversations).sort((a, b) => b.lastUpdated - a.lastUpdated)
   );
 
   // Get the currently active conversation object.
   const activeConversation = derived(
     [conversations, activeConversationId],
     ([$conversations, $activeConversationId]) =>
       $activeConversationId ? $conversations[$activeConversationId] : null
   );
 
   // Get the messages for the currently active conversation.
   const activeMessages = derived(
     [messages, activeConversation],
     ([$messages, $activeConversation]) => {
       if (!$activeConversation) return [];
       return $activeConversation.messageIds.map(id => $messages[id]).filter(Boolean);
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

     addMessage($activeConversationId, { sender: 'user', text });

     setTimeout(() => {
       addMessage($activeConversationId, {
         sender: 'bot',
         text: `This is a simulated response: ${text}.`
       });
     }, 500);
   }
 
   // --- Initial Setup - MOVED TO onMount for SSR safety ---
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
    onselect={handleSelectConversation}
    onnew={handleNewConversation}
  />

  <div class="flex-1 flex flex-col h-full bg-neutral-50 shadow-md md:rounded-xl md:m-2">
    <header class="p-4 sm:px-6 border-b border-gray-200 flex justify-between items-center">
      <h1 class="text-lg font-semibold">
        {$activeConversation?.title || 'Chat'}
      </h1>
    </header>

    <div class="flex-1 flex flex-col overflow-hidden min-h-0">
      <ChatWindow messages={$activeMessages} />
      <MessageInput on:send={handleSendMessage} />
    </div>
  </div>
</main>