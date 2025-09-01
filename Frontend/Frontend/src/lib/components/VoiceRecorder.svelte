<script>
  let { 
    disabled = false,
    onrecorded 
  } = $props();
  
  let isRecording = $state(false);
  let mediaRecorder = $state(null);
  let audioChunks = $state([]);
  let recordingTime = $state(0);
  let recordingInterval = $state(null);
  
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      recordingTime = 0;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        onrecorded?.({
          blob: audioBlob,
          url: audioUrl,
          duration: recordingTime
        });
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      isRecording = true;
      
      // Start timer
      recordingInterval = setInterval(() => {
        recordingTime += 1;
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }
  
  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      clearInterval(recordingInterval);
    }
  }
  
  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
  
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<div class="flex items-center gap-2">
  <button
    onclick={toggleRecording}
    disabled={disabled}
    class="p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
    class:bg-red-500={isRecording}
    class:text-white={isRecording}
    class:hover:bg-red-600={isRecording}
    class:bg-gray-200={!isRecording && !disabled}
    class:text-gray-700={!isRecording && !disabled}
    class:hover:bg-gray-300={!isRecording && !disabled}
    class:opacity-50={disabled}
    class:cursor-not-allowed={disabled}
    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
  >
    {#if isRecording}
      <!-- Stop icon -->
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="2"/>
      </svg>
    {:else}
      <!-- Microphone icon -->
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" x2="12" y1="19" y2="22"/>
        <line x1="8" x2="16" y1="22" y2="22"/>
      </svg>
    {/if}
  </button>
  
  {#if isRecording}
    <div class="flex items-center gap-2 text-red-600">
      <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
      <span class="text-sm font-mono">{formatTime(recordingTime)}</span>
    </div>
  {/if}
</div>