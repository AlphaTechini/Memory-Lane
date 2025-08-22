 <script>
   import { createEventDispatcher } from 'svelte';
 
   /** @type {boolean} */
   export let active = false;
 
   const dispatch = createEventDispatcher();
 
   function handleClick() {
     dispatch('toggle', { active: !active });
   }
 
   function handleKeydown(event) {
     if (event.key === ' ' || event.key === 'Enter') {
       event.preventDefault();
       handleClick();
     }
   }
 </script>
 
 <button
   role="button"
   aria-pressed={active}
   on:click={handleClick}
   on:keydown={handleKeydown}
   class="px-3 py-1.5 text-sm font-medium rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2"
   class:bg-blue-100={active}
   class:text-blue-800={active}
   class:ring-blue-400={active}
   class:bg-neutral-200={!active}
   class:text-neutral-700={!active}
   class:hover:bg-neutral-300={!active}
 >
   Web Search
 </button>

