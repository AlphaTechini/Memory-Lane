<script>
  let { 
    audioUrl,
    duration = 0,
    autoplay = false 
  } = $props();
  
  let audioElement = $state(null);
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let totalDuration = $state(duration);
  
  function togglePlay() {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
  }
  
  function handleTimeUpdate() {
    if (audioElement) {
      currentTime = audioElement.currentTime;
    }
  }
  
  function handleLoadedMetadata() {
    if (audioElement) {
      totalDuration = audioElement.duration;
    }
  }
  
  function handleEnded() {
    isPlaying = false;
    currentTime = 0;
  }
  
  function handlePlay() {
    isPlaying = true;
  }
  
  function handlePause() {
    isPlaying = false;
  }
  
  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  function handleSeek(event) {
    if (!audioElement) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    audioElement.currentTime = percentage * totalDuration;
  }
</script>

<div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-w-xs">
  <button
    onclick={togglePlay}
    class="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
    aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
  >
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
    <!-- Progress bar -->
    <button
      onclick={handleSeek}
      class="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-full mb-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300"
    >
      <div
        class="h-full bg-blue-500 rounded-full transition-all duration-100"
        style="width: {totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%"
      ></div>
    </button>
    
    <!-- Time display -->
    <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
      <span>{formatTime(currentTime)}</span>
      <span>{formatTime(totalDuration)}</span>
    </div>
  </div>
  
  <!-- Hidden audio element -->
  <audio
    bind:this={audioElement}
    src={audioUrl}
    preload="metadata"
    {autoplay}
    ontimeupdate={handleTimeUpdate}
    onloadedmetadata={handleLoadedMetadata}
    onended={handleEnded}
    onplay={handlePlay}
    onpause={handlePause}
  ></audio>
</div>