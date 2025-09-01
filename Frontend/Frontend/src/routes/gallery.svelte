<script>
  import { writable, derived, get } from 'svelte/store';

  // Cloudinary config — replace with your own
  const CLOUD_NAME = 'dkhkmtf3v';
  const UPLOAD_PRESET = 'testSensay';

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  const STORAGE_ALBUMS_KEY = 'gallery_albums';
  const STORAGE_PHOTOS_KEY = 'gallery_photos';

  function genId() {
    return '_' + Math.random().toString(36).slice(2, 11);
  }

  function persistedStore(key, initialValue) {
    try {
      const stored = localStorage.getItem(key);
      const parsed = stored ? JSON.parse(stored) : initialValue;
      const store = writable(parsed);
      store.subscribe(value => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch {}
      });
      return store;
    } catch {
      return writable(initialValue);
    }
  }

  const albums = persistedStore(STORAGE_ALBUMS_KEY, []);
  const photos = persistedStore(STORAGE_PHOTOS_KEY, []);

  const selectedAlbumId = writable(null);
  const selectedPhotoId = writable(null);

  let newAlbumTitle = '';
  let newAlbumDesc = '';
  let editingAlbumId = null;

  let newPhotoFile;
  let newPhotoDesc = '';
  let newPhotoAlbumId = null;
  let newPhotoDate = '';
  let editingPhotoId = null;
  let editingPhotoNewDesc = '';
  let editingPhotoNewAlbumId = null;
  let editingPhotoNewDate = '';

  let showingAddAlbum = false;
  let showingAddPhoto = false;

  let uploadInProgress = false;
  let uploadError = '';
  let validationError = '';

  let confirmDeleteAlbumId = null;
  let confirmDeletePhotoId = null;

  const photosInSelectedAlbum = derived(
    [photos, selectedAlbumId],
    ([$photos, $selectedAlbumId]) => {
      if (!$selectedAlbumId) return $photos.filter(p => !p.albumId);
      return $photos.filter(p => p.albumId === $selectedAlbumId);
    }
  );

  $: selectedAlbum = get(albums).find(a => a.id === get(selectedAlbumId));
  $: selectedPhoto = get(photos).find(p => p.id === get(selectedPhotoId));

  function resetAlbumForm() {
    newAlbumTitle = '';
    newAlbumDesc = '';
    editingAlbumId = null;
    validationError = '';
  }

  function resetPhotoForm() {
    newPhotoFile = null;
    newPhotoDesc = '';
    newPhotoAlbumId = null;
    newPhotoDate = '';
    editingPhotoId = null;
    editingPhotoNewDesc = '';
    editingPhotoNewAlbumId = null;
    editingPhotoNewDate = '';
    validationError = '';
    uploadError = '';
    const fileInput = document.getElementById('photoFileInput');
    if (fileInput) fileInput.value = '';
  }

  function openAddAlbumForm() {
    resetAlbumForm();
    showingAddAlbum = true;
    showingAddPhoto = false;
  }
  function openAddPhotoForm(albumId = null) {
    resetPhotoForm();
    newPhotoAlbumId = albumId;
    showingAddPhoto = true;
    showingAddAlbum = false;
  }

  function validateFile(file) {
    validationError = '';
    if (!file) {
      validationError = 'No file selected';
      return false;
    }
    if (!file.type.startsWith('image/')) {
      validationError = 'Invalid file type: only images are allowed';
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      validationError = 'File size exceeds 20MB limit';
      return false;
    }
    return true;
  }

  async function uploadToCloudinary(file) {
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);

    const data = await res.json();
    return data.secure_url;
  }

  function saveAlbum() {
    if (!newAlbumTitle.trim()) {
      validationError = 'Album title is required';
      return;
    }
    if (editingAlbumId) {
      albums.update(a =>
        a.map(album => album.id === editingAlbumId ? { ...album, title: newAlbumTitle.trim(), description: newAlbumDesc.trim() } : album)
      );
    } else {
      albums.update(a => [...a, { id: genId(), title: newAlbumTitle.trim(), description: newAlbumDesc.trim() }]);
    }
    resetAlbumForm();
    showingAddAlbum = false;
  }
  function startEditAlbum(album) {
    editingAlbumId = album.id;
    newAlbumTitle = album.title;
    newAlbumDesc = album.description;
    showingAddAlbum = true;
    showingAddPhoto = false;
    validationError = '';
  }
  function cancelEditAlbum() {
    resetAlbumForm();
    showingAddAlbum = false;
  }
  function deleteAlbum(id) {
    albums.update(a => a.filter(album => album.id !== id));
    photos.update(p => p.filter(photo => photo.albumId !== id));
    confirmDeleteAlbumId = null;
    if (get(selectedAlbumId) === id) closeAlbum();
  }
  async function addPhoto() {
    validationError = '';
    uploadError = '';
    if (!validateFile(newPhotoFile)) return;
    uploadInProgress = true;
    try {
      const uploadedUrl = await uploadToCloudinary(newPhotoFile);
      photos.update(ps => [...ps, { id: genId(), albumId: newPhotoAlbumId, src: uploadedUrl, description: newPhotoDesc.trim(), date: newPhotoDate }]);
      resetPhotoForm();
      showingAddPhoto = false;
    } catch (e) {
      uploadError = e.message;
    } finally {
      uploadInProgress = false;
    }
  }
  function startEditPhoto(photo) {
    editingPhotoId = photo.id;
    editingPhotoNewDesc = photo.description || '';
    editingPhotoNewAlbumId = photo.albumId || null;
    editingPhotoNewDate = photo.date || '';
    showingAddPhoto = false;
    showingAddAlbum = false;
    validationError = '';
  }
  function saveEditedPhoto() {
    if (!editingPhotoId) return;
    photos.update(ps =>
      ps.map(photo => photo.id === editingPhotoId ? { ...photo, description: editingPhotoNewDesc.trim(), albumId: editingPhotoNewAlbumId, date: editingPhotoNewDate } : photo)
    );
    editingPhotoId = null;
  }
  function cancelEditPhoto() {
    editingPhotoId = null;
  }
  function deletePhoto(id) {
    photos.update(p => p.filter(photo => photo.id !== id));
    confirmDeletePhotoId = null;
    if (get(selectedPhotoId) === id) selectedPhotoId.set(null);
  }
  function openAlbum(id) {
    selectedAlbumId.set(id);
    selectedPhotoId.set(null);
  }
  function openPhoto(id) {
    selectedPhotoId.set(id);
  }
  function closeAlbum() {
    selectedAlbumId.set(null);
    selectedPhotoId.set(null);
  }
</script>

<style>
  main {
    max-width: 900px;
    margin: 2rem auto 3rem;
    padding: 0 1rem 3rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.1);
    color: #222;
  }
  h1 {
    text-align: center;
    font-weight: 600;
    letter-spacing: 2px;
    font-size: 2.2rem;
    margin-bottom: 1.5rem;
    color: #444;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  button {
    font-weight: 600;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1.3rem;
    cursor: pointer;
    box-shadow: 0 3px 0 #105bab;
    user-select: none;
    transition: background-color 0.3s ease;
  }
  button:disabled {
    background: #a3c5f8;
    box-shadow: none;
    cursor: not-allowed;
  }
  button:hover:not(:disabled) {
    background: #105bab;
  }
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill,minmax(180px,1fr));
    gap: 1.3rem;
  }
  .album-card, .photo-card {
    background: #fafafa;
    border-radius: 10px;
    box-shadow: 0 1px 6px rgb(0 0 0 / 0.07);
    overflow: hidden;
    cursor: default;
    display: flex;
    flex-direction: column;
    border: 2px solid transparent;
    transition: border-color 0.2s ease;
  }
  .album-card:hover, .photo-card:hover {
    border-color: #1976d2;
  }
  .album-thumb, .photo-thumb {
    height: 140px;
    width: 100%;
    object-fit: cover;
    background: #ddd;
    user-select: none;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    box-shadow: inset 0 3px 8px rgb(0 0 0 / 0.12);
  }
  .album-info, .photo-info {
    padding: 0.7rem 0.9rem;
    flex-grow: 1;
  }
  strong {
    font-size: 1.1rem;
    user-select: text;
  }
  .desc-block {
    margin-top: 0.45rem;
    font-size: 0.9rem;
    color: #555;
    font-style: normal;
    user-select: text;
    max-height: 3rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .photo-date {
    font-size: 0.8rem;
    color: #777;
    margin-bottom: 0.4rem;
    text-align: right;
  }
  form {
    max-width: 480px;
    margin: 0 auto 2.5rem;
    padding: 1.4rem 1.6rem 2rem 1.6rem;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgb(0 0 0 / 0.1);
    background: #fff;
    border: 1px solid #e0e0e0;
  }
  form h3 {
    font-weight: 700;
    margin-bottom: 1rem;
    font-size: 1.5rem;
    color: #1565c0;
  }
  label {
    margin: 0.5rem 0 0.18rem;
    font-weight: 600;
    font-size: 0.95rem;
    display: block;
  }
  input[type="text"], textarea, select, input[type="file"] {
    width: 100%;
    padding: 0.48rem 0.6rem;
    border-radius: 6px;
    border: 1.4px solid #ccc;
    font-size: 1rem;
    transition: border-color 0.15s ease-in-out;
    font-family: inherit;
    box-sizing: border-box;
  }
  input[type="text"]:focus, textarea:focus, select:focus {
    outline: none;
    border-color: #1976d2;
    box-shadow: 0 0 4px #1976d2aa;
  }
  textarea {
    resize: vertical;
    min-height: 60px;
  }
  .error-msg {
    margin-top: 0.3rem;
    font-weight: 600;
    color: #d32f2f;
    text-align: left;
    font-size: 0.9rem;
  }
  .loading-msg {
    margin-top: 0.3rem;
    font-size: 0.9rem;
    color: #1976d2;
    font-weight: 600;
  }
  .close-btn {
    margin-top: 1.4rem;
    background: none;
    border: none;
    font-weight: 600;
    color: #1976d2;
    cursor: pointer;
    font-size: 1rem;
    user-select: none;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background-color 0.3s ease;
  }
  .close-btn:hover {
    background-color: #e3f2fd;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(40,40,40,0.66);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999;
    user-select: none;
  }
  .modal {
    background: white;
    border-radius: 14px;
    padding: 2rem 2.3rem 2.7rem 2.3rem;
    max-width: 620px;
    width: 90vw;
    box-shadow: 0 15px 40px rgb(0 0 0 / 0.3);
    max-height: 85vh;
    overflow-y: auto;
    user-select: text;
    text-align: center;
  }
  .modal img {
    width: 100%;
    max-height: 60vh;
    object-fit: contain;
    border-radius: 12px;
    user-select: none;
  }
  .modal h2 {
    margin: 1.3rem 0 0.4rem;
    font-weight: 700;
    font-size: 1.45rem;
    color: #1565c0;
  }
  .modal p {
    font-size: 1rem;
    color: #444;
    line-height: 1.4;
    white-space: pre-line;
    user-select: text;
  }
  .action-buttons {
    display: flex;
    gap: 0.4rem;
    justify-content: flex-end;
    background: #f7f9fc;
    padding: 0.3rem 0.6rem;
    border-top: 1px solid #ddd;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
  }
  .action-buttons button {
    background: transparent;
    border: none;
    color: #1976d2;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.34rem 0.72rem;
    border-radius: 6px;
    user-select: none;
    font-weight: 600;
    transition: background-color 0.2s ease;
  }
  .action-buttons button:hover {
    background: #e3f2fd;
  }
  .confirm-dialog {
    max-width: 400px;
    background: white;
    border-radius: 14px;
    padding: 1.6rem 2.1rem;
    box-shadow: 0 0 25px rgba(0,0,0,0.28);
    z-index: 1000;
    user-select: text;
  }
  .confirm-dialog h2 {
    font-weight: 700;
    font-size: 1.4rem;
    color: #d32f2f;
    margin-bottom: 0.3rem;
  }
  .confirm-dialog p {
    font-size: 1rem;
    margin-bottom: 1rem;
    color: #555;
    white-space: pre-wrap;
  }
  .confirm-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
  .btn-danger {
    background: #d32f2f;
    color: white;
    font-weight: 700;
    padding: 0.5rem 1.2rem;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    user-select: none;
  }
  .btn-danger:hover {
    background: #a22222;
  }
  .btn-cancel {
    background: #777;
    color: white;
    font-weight: 600;
    padding: 0.5rem 1.2rem;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    user-select: none;
  }
  .btn-cancel:hover {
    background: #555;
  }
</style>

<main>
  <h1>Gallery of Mmemories</h1>

  <div class="controls" role="region" aria-label="Add content controls">
    <button type="button" on:click={openAddAlbumForm} aria-expanded={showingAddAlbum}>+ Add Album</button>
    <button type="button" on:click={() => openAddPhotoForm()} aria-expanded={showingAddPhoto}>+ Add Photo</button>
  </div>

  {#if showingAddAlbum}
    <form on:submit|preventDefault={saveAlbum} aria-label={editingAlbumId ? "Edit Album Form" : "Create New Album Form"}>
      <h3>{editingAlbumId ? 'Edit Album' : 'Create New Album'}</h3>
      <label for="albumTitle">Album Title *</label>
      <input id="albumTitle" type="text" bind:value={newAlbumTitle} autocomplete="off" autofocus />

      <label for="albumDesc">Album Description</label>
      <textarea id="albumDesc" rows="3" bind:value={newAlbumDesc} placeholder="Description applies to all photos in this album (optional)"></textarea>

      {#if validationError}
        <p class="error-msg" role="alert">{validationError}</p>
      {/if}

      <div style="margin-top:1rem; display:flex; gap: 0.7rem;">
        <button type="submit">{editingAlbumId ? 'Save' : 'Create'}</button>
        {#if editingAlbumId}
          <button type="button" on:click={cancelEditAlbum} style="background:#ccc;color:#222;">Cancel</button>
        {/if}
      </div>
    </form>
  {/if}

  {#if showingAddPhoto}
    <form on:submit|preventDefault={addPhoto} aria-label="Add New Photo Form" >
      <h3>Add New Photo</h3>

      <label for="photoFile">Select Image *</label>
      <input
        id="photoFileInput"
        type="file"
        accept="image/*"
        aria-required="true"
        on:change={(e) => { newPhotoFile = e.target.files[0]; validationError = ''; uploadError = ''; }}
        autofocus
      />

      <label for="photoAlbum">Assign to Album (optional)</label>
      <select id="photoAlbum" bind:value={newPhotoAlbumId} aria-label="Select album for the photo">
        <option value={null}>-- No Album --</option>
        {#each $albums as album}
          <option value={album.id}>{album.title}</option>
        {/each}
      </select>

      <label for="photoDesc">Photo Description</label>
      <textarea id="photoDesc" rows="3" bind:value={newPhotoDesc} placeholder="Photo specific description (overrides album description)"></textarea>

      <label for="photoDate">Date Captured</label>
      <input id="photoDate" type="date" bind:value={newPhotoDate} />

      {#if validationError}
        <p class="error-msg" role="alert">{validationError}</p>
      {/if}
      {#if uploadError}
        <p class="error-msg" role="alert">{uploadError}</p>
      {/if}
      {#if uploadInProgress}
        <p class="loading-msg" role="alert" aria-live="assertive">Uploading image, please wait...</p>
      {/if}

      <button type="submit" disabled={uploadInProgress} style="margin-top:1rem;">Add Photo</button>
    </form>
  {/if}

  {#if $selectedAlbumId === null}
    <section aria-label="Albums">
      <h2>Albums</h2>
      {#if $albums.length === 0}
        <p class="no-items">No albums created yet.</p>
      {/if}
      <div class="gallery-grid" role="list">
        {#each $albums as album (album.id)}
          <article class="album-card" role="listitem" aria-label={`Album: ${album.title}`}>
            <div 
              tabindex="0" role="button" 
              aria-pressed="false" 
              on:click={() => openAlbum(album.id)} 
              on:keydown={e => { if (e.key === 'Enter' || e.key === ' ') openAlbum(album.id); }} 
              title={`Open album ${album.title}`} 
              class="album-thumb-wrapper"
            >
              {#if $photos.filter(p => p.albumId === album.id).length > 0}
                <img
                  src={$photos.find(p => p.albumId === album.id)?.src}
                  alt={"Cover photo of album " + album.title}
                  class="album-thumb"
                  draggable="false"
                />
              {:else}
                <div class="album-thumb" style="display:flex;align-items:center;justify-content:center;color:#bbb;font-size:3rem;user-select:none; background:#ececec;">📁</div>
              {/if}
            </div>
            <div class="album-info">
              <strong>{album.title}</strong>
              {#if album.description}
                <div class="desc-block" title={album.description}>{album.description}</div>
              {/if}
            </div>
            <div class="action-buttons" aria-label="Album actions">
              <button type="button" aria-label={"Edit album " + album.title} on:click={() => startEditAlbum(album)}>Edit</button>
              <button type="button" aria-label={"Delete album " + album.title} on:click={() => { confirmDeleteAlbumId = album.id; }}>Delete</button>
            </div>
          </article>
        {/each}
      </div>

      <section aria-label="Photos without album" style="margin-top:2.5rem;">
        <h2>Photos (No Album)</h2>
        {#if $photos.filter(p => !p.albumId).length === 0}
          <p class="no-items">No photos without an album.</p>
        {/if}
        <div class="gallery-grid" role="list">
          {#each $photos.filter(p => !p.albumId) as photo (photo.id)}
            <article class="photo-card" role="listitem" aria-label="Photo without album">
              <div 
                tabindex="0"
                role="button"
                aria-label="View photo"
                on:click={() => openPhoto(photo.id)}
                on:keydown={e => { if (e.key === 'Enter' || e.key === ' ') openPhoto(photo.id); }}
              >
                <img src={photo.src} alt={photo.description || ''} class="photo-thumb" draggable="false" />
              </div>
              <div class="photo-info">
                {#if photo.date}
                  <p class="photo-date">{new Date(photo.date).toLocaleDateString()}</p>
                {/if}
                {#if photo.description}
                  <div class="desc-block" title={photo.description}>{photo.description}</div>
                {/if}
              </div>
              <div class="action-buttons" aria-label="Photo actions">
                <button type="button" aria-label="Edit photo" on:click={() => startEditPhoto(photo)}>Edit</button>
                <button type="button" aria-label="Delete photo" on:click={() => { confirmDeletePhotoId = photo.id; }}>Delete</button>
              </div>
            </article>
          {/each}
        </div>
      </section>
    </section>
  {:else}
    <section aria-label={`Viewing album: ${selectedAlbum?.title ?? ''}`}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.4rem;">
        <button on:click={closeAlbum} aria-label="Back to albums" style="font-weight:600; font-size:1.1rem; background:none; border:none; color:#1976d2; cursor:pointer; padding: 0;">
          ← Back to Albums
        </button>
        <button type="button" on:click={() => openAddPhotoForm($selectedAlbumId)}>+ Add Photo to Album</button>
      </div>

      <h2>{selectedAlbum?.title}</h2>
      {#if selectedAlbum?.description}
        <p style="color:#555; font-style:italic; margin-bottom:1rem; user-select:text;">{selectedAlbum.description}</p>
      {/if}

      {#if $photosInSelectedAlbum.length === 0}
        <p class="no-items">No photos in this album yet.</p>
      {/if}

      <div class="gallery-grid" aria-live="polite" role="list">
        {#each $photosInSelectedAlbum as photo (photo.id)}
          <article class="photo-card" role="listitem" aria-label="Photo in album">
            <div 
              tabindex="0" 
              role="button" 
              aria-label="View photo"
              on:click={() => openPhoto(photo.id)}
              on:keydown={e => { if (e.key === 'Enter' || e.key === ' ') openPhoto(photo.id); }}
            >
              <img src={photo.src} alt={photo.description || ''} class="photo-thumb" draggable="false" />
            </div>
            <div class="photo-info">
              {#if photo.date}
                <p class="photo-date">{new Date(photo.date).toLocaleDateString()}</p>
              {/if}
              {#if photo.description}
                <div class="desc-block" title={photo.description}>{photo.description}</div>
              {:else if selectedAlbum?.description}
                <div class="desc-block" style="font-style: italic; color: #888;" title={selectedAlbum.description}>{selectedAlbum.description}</div>
              {/if}
            </div>
            <div class="action-buttons" aria-label="Photo actions">
              <button type="button" aria-label="Edit photo" on:click={() => startEditPhoto(photo)}>Edit</button>
              <button type="button" aria-label="Delete photo" on:click={() => { confirmDeletePhotoId = photo.id; }}>Delete</button>
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/if}

  {#if editingPhotoId}
    <div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="editPhotoTitle" tabindex="0" on:click={() => editingPhotoId = null}>
      <form 
        class="modal" 
        on:click|stopPropagation 
        on:submit|preventDefault={saveEditedPhoto}
        aria-label="Edit photo form"
      >
        <h2 id="editPhotoTitle">Edit Photo</h2>

        <label for="editPhotoDesc">Photo Description</label>
        <textarea id="editPhotoDesc" rows="3" bind:value={editingPhotoNewDesc} placeholder="Photo specific description" autofocus></textarea>

        <label for="editPhotoAlbum">Assign to Album (optional)</label>
        <select id="editPhotoAlbum" bind:value={editingPhotoNewAlbumId} aria-label="Select album for the photo">
          <option value={null}>-- No Album --</option>
          {#each $albums as album}
            <option value={album.id}>{album.title}</option>
          {/each}
        </select>

        <label for="editPhotoDate">Date Captured</label>
        <input id="editPhotoDate" type="date" bind:value={editingPhotoNewDate} />

        <div style="margin-top:1.5rem; display:flex; gap:1rem; justify-content:flex-end;">
          <button type="submit">Save</button>
          <button type="button" on:click={() => editingPhotoId = null} style="background:#ccc; color:#222;">Cancel</button>
        </div>
      </form>
    </div>
  {/if}

  {#if $selectedPhotoId !== null && selectedPhoto}
    <div class="backdrop" role="dialog" aria-modal="true" aria-label="Photo view" on:click={() => selectedPhotoId.set(null)}>
      <div class="modal" on:click|stopPropagation>
        <img src={selectedPhoto.src} alt="Photo full view" />
        {#if selectedPhoto.date}
          <p style="font-size: 0.9rem; color: #666; margin-top: 1rem; text-align: left;">Captured on: {new Date(selectedPhoto.date).toLocaleDateString()}</p>
        {/if}
        <h2>Photo Description</h2>
        {#if selectedPhoto.description}
          <p>{selectedPhoto.description}</p>
        {:else if selectedPhoto.albumId}
          {#if $albums.find(a => a.id === selectedPhoto.albumId)?.description}
            <p><em>{$albums.find(a => a.id === selectedPhoto.albumId)?.description}</em></p>
          {:else}
            <p><em>No description</em></p>
          {/if}
        {:else}
          <p><em>No description</em></p>
        {/if}
        <button class="close-btn" on:click={() => selectedPhotoId.set(null)} aria-label="Close photo view">Close</button>
      </div>
    </div>
  {/if}

  {#if confirmDeleteAlbumId}
    <div class="backdrop" role="alertdialog" aria-modal="true" aria-labelledby="confirmDeleteAlbumTitle" tabindex="0" on:click={() => confirmDeleteAlbumId = null}>
      <section class="confirm-dialog" on:click|stopPropagation>
        <h2 id="confirmDeleteAlbumTitle">Delete Album?</h2>
        <p>
          Are you sure you want to delete this album? <strong>All photos in this album will also be deleted.</strong>
        </p>
        <div class="confirm-buttons">
          <button class="btn-danger" on:click={() => deleteAlbum(confirmDeleteAlbumId)} type="button">Delete</button>
          <button class="btn-cancel" on:click={() => confirmDeleteAlbumId = null} type="button">Cancel</button>
        </div>
      </section>
    </div>
  {/if}

  {#if confirmDeletePhotoId}
    <div class="backdrop" role="alertdialog" aria-modal="true" aria-labelledby="confirmDeletePhotoTitle" tabindex="0" on:click={() => confirmDeletePhotoId = null}>
      <section class="confirm-dialog" on:click|stopPropagation>
        <h2 id="confirmDeletePhotoTitle">Delete Photo?</h2>
        <p>Are you sure you want to delete this photo?</p>
        <div class="confirm-buttons">
          <button class="btn-danger" on:click={() => deletePhoto(confirmDeletePhotoId)} type="button">Delete</button>
          <button class="btn-cancel" on:click={() => confirmDeletePhotoId = null} type="button">Cancel</button>
        </div>
      </section>
    </div>
  {/if}
</main>