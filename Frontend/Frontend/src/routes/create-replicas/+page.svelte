<script>
  let name = $state('');
  let email = $state('');
  let phone = $state('');
  let dob = $state('');
  let bio = $state('');
  let photoFile = $state(null);
  let voiceFile = $state(null);

  function handleSubmit(e) {
    e.preventDefault();
    // Only store locally for demo — DO NOT transmit sensitive info in production without user's consent.
    const payload = { name, email, phone, dob, bio, photoFile: photoFile?.name, voiceFile: voiceFile?.name, created: Date.now() };
    localStorage.setItem('replica_profile', JSON.stringify(payload));
    alert('Data saved locally (demo).');
  }

  function handlePhoto(e) { photoFile = e.target.files?.[0]; }
  function handleVoice(e) { voiceFile = e.target.files?.[0]; }
</script>

<div>
  <h1 class="text-2xl mb-4">Create Replicas (demo)</h1>
  <form onsubmit={handleSubmit} class="space-y-3 max-w-xl">
    <input placeholder="Full name" bind:value={name} class="w-full p-2 border rounded" />
    <input placeholder="Email" bind:value={email} class="w-full p-2 border rounded" />
    <input placeholder="Phone" bind:value={phone} class="w-full p-2 border rounded" />
    <input type="date" bind:value={dob} class="w-full p-2 border rounded" />
    <textarea placeholder="Short bio" bind:value={bio} class="w-full p-2 border rounded"></textarea>

    <div>
      <label class="block text-sm">Photo</label>
      <input type="file" accept="image/*" onchange={handlePhoto} />
      <label class="block text-sm mt-2">Voice sample</label>
      <input type="file" accept="audio/*" onchange={handleVoice} />
    </div>

    <div class="flex gap-2">
      <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded">Save (demo)</button>
      <a href="/" class="px-4 py-2 border rounded">Back</a>
    </div>
  </form>
</div>