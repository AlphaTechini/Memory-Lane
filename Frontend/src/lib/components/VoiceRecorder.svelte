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
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const duration = recordingTime;
        onrecorded?.({ url, blob, duration });
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      isRecording = true;
      recordingTime = 0;
      recordingInterval = setInterval(() => (recordingTime += 1), 1000);
    } catch (err) {
      console.error("Microphone error:", err);
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
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }
</script>

<div class="flex items-center gap-2">
  <button
    type="button"
    onclick={toggleRecording}
    class="p-2 rounded-full transition-colors flex items-center justify-center text-slate-400 hover:text-primary dark:text-charcoal-400 dark:hover:text-cream-50 {isRecording
      ? 'text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-500/10'
      : 'hover:bg-slate-100 dark:hover:bg-charcoal-600'}"
    aria-label={isRecording ? "Stop recording" : "Start voice recording"}
    aria-pressed={isRecording}
    disabled={!hasPermission}
  >
    {#if isRecording}
      <span
        class="material-symbols-outlined text-xl animate-pulse text-rose-500"
        >stop_circle</span
      >
    {:else}
      <span class="material-symbols-outlined text-xl">mic</span>
    {/if}
  </button>

  {#if isRecording}
    <div
      class="flex items-center gap-1.5 px-2 py-1 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg absolute bottom-[4.5rem] right-0 mr-4 z-10 shadow-sm animate-in fade-in slide-in-from-bottom-2"
    >
      <div
        class="w-2 h-2 bg-rose-500 rounded-full animate-pulse"
        aria-hidden="true"
      ></div>
      <span
        class="text-sm font-medium text-rose-600 dark:text-rose-400 tabular-nums"
      >
        {formatTime(recordingTime)}
      </span>
    </div>
  {:else if !hasPermission}
    <div
      class="text-sm text-rose-500 dark:text-rose-400 absolute bottom-[4.5rem] right-0 mr-4 z-10 bg-white dark:bg-charcoal-800 p-2 shadow rounded-lg border border-rose-200"
    >
      Microphone blocked
    </div>
  {/if}
</div>
