<script>
  import { fly } from 'svelte/transition';
  import AudioPlayer from './AudioPlayer.svelte';

  let { message } = $props();
  
  let isUser = $derived(message?.sender === 'user');
  let hasWebSearch = $derived(message?.meta?.webSearch === true);
  let hasAudio = $derived(message?.audio?.url);
</script>

<div class="flex" class:justify-end={isUser} class:justify-start={!isUser}>
  <div
    in:fly={{ x: isUser ? 60 : -60, duration: 220 }}
    class="p-3 rounded-2xl max-w-[80%] shadow-sm break-words"
    class:bg-blue-500={isUser}
    class:text-white={isUser}
    class:bg-gray-100={!isUser}
    class:text-gray-900={!isUser}
  >
    <p class="whitespace-pre-wrap">{message.text}</p>

    {#if hasAudio}
      <div class="mt-3">
        <AudioPlayer 
          audioUrl={message.audio.url}
          duration={message.audio.duration}
        />
      </div>
    {/if}

    {#if hasWebSearch}
      <div class="mt-2 flex items-center">
        <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
          Web Search
        </span>
      </div>
    {/if}
  </div>
</div>