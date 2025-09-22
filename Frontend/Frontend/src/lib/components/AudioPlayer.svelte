<script>
  // accept both prop names (src or audioUrl) for backwards compatibility
  let { src = '', audioUrl = '', autoplay = false } = $props();
  const url = src || audioUrl || '';

  let audioElement = $state(null);
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let totalDuration = $state(0);

  function togglePlay() {
    if (!audioElement) return;
    if (isPlaying) audioElement.pause();
    else audioElement.play();
  }

  function handleTimeUpdate() { currentTime = audioElement.currentTime; }
  function handleLoadedMetadata() { totalDuration = audioElement.duration; if (autoplay) audioElement.play(); }
  function handleEnded() { isPlaying = false; currentTime = 0; }
  function handlePlay() { isPlaying = true; }
  function handlePause() { isPlaying = false; }

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
  <button onclick={togglePlay} class="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300" aria-label={isPlaying ? 'Pause audio' : 'Play audio'}>
    {#if isPlaying}
      <!-- Pause icon -->
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
    {:else}
      <!-- Play icon -->
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
    {/if}
  </button>

  <div class="flex-1 min-w-0">
    <div class="text-sm text-gray-900 dark:text-gray-100 truncate">{url ? url.split('/').pop() : 'Audio'}</div>
    <div class="text-xs text-gray-500 dark:text-gray-300">{Math.floor(currentTime)} / {totalDuration ? Math.floor(totalDuration) : '--'}s</div>
  </div>

  <audio
    bind:this={audioElement}
    src={url}
    preload="metadata"
    {autoplay}
    on:timeupdate={handleTimeUpdate}
    on:loadedmetadata={handleLoadedMetadata}
    on:ended={handleEnded}
    on:play={handlePlay}
    on:pause={handlePause}
    class="hidden"
  ></audio>
</div>