Hackathons\Sensay AI\Built-with-Sensay-API\Frontend\Frontend\src\lib\components\VoiceRecorder.svelte
<script>
  let { onrecorded } = $props();
  let isRecording = $state(false);
  let mediaRecorder = $state(null);
  let audioChunks = $state([]);
  let recordingTime = $state(0);
  let recordingInterval = $state(null);

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return alert('No microphone access available');
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
        // stop tracks
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      isRecording = true;
      recordingTime = 0;
      recordingInterval = setInterval(() => recordingTime += 1, 1000);
    } catch (err) {
      console.error(err);
      alert('Microphone permission denied or error starting recording.');
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

<div class="flex items-center gap-2">
  <button
    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    onclick={toggleRecording}
    class="p-2 bg-gray-200 dark:bg-gray-700 rounded-full"
    type="button"
  >
    {#if isRecording}
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="12" height="16" rx="6"/></svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 11a1 1 0 1 0 0 2 7 7 0 0 1-14 0 1 1 0 1 0 0-2"/></svg>
    {/if}
  </button>
  <div class="text-xs text-gray-600 dark:text-gray-300">{formatTime(recordingTime)}</div>
</div>