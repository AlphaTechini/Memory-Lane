 <script>
   import { createEventDispatcher } from 'svelte';
 
   let text = '';
   let textarea;
 
   const dispatch = createEventDispatcher();
 
   function send() {
     if (text.trim()) {
       dispatch('send', { text: text.trim() });
       text = '';
       textarea.focus();
     }
   }
 
   function handleKeydown(event) {
     if (event.key === 'Enter' && !event.shiftKey) {
       event.preventDefault();
       send();
     }
   }
 </script>
 
 <div class="p-4 bg-white/50 backdrop-blur-sm">
   <div class="relative">
     <textarea
       bind:this={textarea}
       bind:value={text}
       on:keydown={handleKeydown}
       rows="1"
       placeholder="Message ChatGPT..."
       class="w-full p-3 pr-12 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
     ></textarea>
     <button
       on:click={send}
       disabled={!text.trim()}
       class="absolute right-2 bottom-2 p-2 rounded-lg transition"
       class:bg-blue-500={text.trim()}
       class:text-white={text.trim()}
       class:bg-gray-200={!text.trim()}
       class:text-gray-400={!text.trim()}
       class:cursor-not-allowed={!text.trim()}
       class:hover:bg-blue-600={text.trim()}
       aria-label="Send message"
     >
       <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
         <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
       </svg>
     </button>
   </div>
 </div>

