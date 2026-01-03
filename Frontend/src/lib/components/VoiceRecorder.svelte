<script>
  let { onrecorded } = $props();
  let isRecording = $state(false);
  let mediaRecorder = $state(null);
  let audioChunks = $state([]);
  let recordingTime = $state(0);
  let recordingInterval = $state(null);
  let hasPermission = $state(true);

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      hasPermission = false;
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const duration = recordingTime;
        onrecorded?.({ url, blob, duration });
        stream.getTracks().forEach((t) => t.stop());
      };
      
      mediaRecorder.start();
      isRecording = true;
      recordingTime = 0;
      recordingInterval = setInterval(() => recordingTime += 1, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      hasPermission = false;
    }
  }

  function stopRecording() {
    if (!mediaRecorder) return;
    mediaRecorder.stop();
    clearInterval(recordingInterval);
    recordingInterval = null;
    isRecording = false;
    mediaRecorder = null;
  }

  function toggleRecording() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
</script>

<div class="flex items-center gap-3">
  <button
    type="button"
    onclick={toggleRecording}
    class="voice-btn {isRecording ? 'recording' : ''}"
    aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
    aria-pressed={isRecording}
    disabled={!hasPermission}
  >
    {#if isRecording}
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2"/>
      </svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    {/if}
  </button>
  
  {#if isRecording}
    <div class="flex items-center gap-2 px-3 py-2 bg-coral-500/10 border-2 border-coral-500/30 rounded-xl">
      <div class="w-3 h-3 bg-coral-500 rounded-full animate-pulse" aria-hidden="true"></div>
      <span class="text-lg font-semibold text-coral-600 dark:text-coral-400 tabular-nums">
        {formatTime(recordingTime)}
      </span>
      <span class="text-base text-charcoal-600 dark:text-cream-300">Recording...</span>
    </div>
  {:else if !hasPermission}
    <div class="text-base text-coral-600 dark:text-coral-400">
      Microphone not available
    </div>
  {/if}
</div>
