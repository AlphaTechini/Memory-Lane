<script>
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';

  const stored = browser ? JSON.parse(localStorage.getItem('gallery_photos') || '[]') : [];
  const photos = writable(stored);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      photos.update((p) => {
        const item = { id: Date.now(), name: f.name, url: reader.result };
        const next = [...p, item];
        if (browser) localStorage.setItem('gallery_photos', JSON.stringify(next));
        return next;
      });
    };
    reader.readAsDataURL(f);
  }
</script>

<div>
  <h1 class="text-2xl mb-4">Gallery</h1>

  <div class="mb-4">
    <input type="file" accept="image/*" on:change={handleFile} />
  </div>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    {#each $photos as photo (photo.id)}
      <div class="border rounded overflow-hidden">
        <img src={photo.url} alt={photo.name} class="w-full h-40 object-cover" />
        <div class="p-2 text-sm">{photo.name}</div>
      </div>
    {/each}
  </div>
</div>