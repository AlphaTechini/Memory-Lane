<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { checkAuthStatus, apiCall, getUserRole } from '$lib/auth.js';
  import ThemeToggle from './ThemeToggle.svelte';
  
  let currentPath = $state('');
  let isAuthenticated = $state(false);
  let userRole = $state(null);
  let showMobileMenu = $state(false);
  
  $effect(() => {
    currentPath = $page.url.pathname;
    isAuthenticated = checkAuthStatus();
    try {
      userRole = getUserRole();
    } catch (e) {
      userRole = null;
    }
    loadUserRole();
    showMobileMenu = false;
  });
  
  async function loadUserRole() {
    if (!isAuthenticated) {
      userRole = null;
      return;
    }
    
    try {
      const response = await apiCall('/api/auth/me', { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        const resolved = data.user || data.patient || data;
        try { localStorage.setItem('userData', JSON.stringify(resolved)); } catch (e) {}
        userRole = resolved?.role || 'caretaker';
      }
    } catch (error) {
      console.error('Failed to load user role:', error);
      try {
        userRole = getUserRole() || 'caretaker';
      } catch {
        userRole = 'caretaker';
      }
    }
  }

  function logout() {
    localStorage.removeItem('authToken');
    goto('/login');
  }

  function goHome() {
    goto('/dashboard');
  }
</script>

<!-- Skip to main content link for accessibility -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<nav class="bg-cream-50 dark:bg-charcoal-800 border-b-2 border-cream-300 dark:border-charcoal-600 px-4 py-3">
  <div class="max-w-6xl mx-auto flex items-center justify-between">
    <!-- Logo and Home - Always visible, large touch target -->
    <a 
      href="/dashboard" 
      class="flex items-center gap-3 min-h-touch px-3 py-2 rounded-tactile hover:bg-cream-200 dark:hover:bg-charcoal-700 transition-colors"
      aria-label="Go to Home - Memory Lane"
    >
      <img src="/logo.png" alt="" class="h-10 w-auto" aria-hidden="true" />
      <span class="text-accessible-lg font-bold text-charcoal-800 dark:text-cream-100">Memory Lane</span>
    </a>
    
    <!-- Desktop Navigation - Always visible with labels -->
    <div class="hidden md:flex items-center gap-2">
      <!-- Home Button - Always prominent -->
      <button
        onclick={goHome}
        class="nav-item-accessible {currentPath === '/dashboard' ? 'active' : ''}"
        aria-current={currentPath === '/dashboard' ? 'page' : undefined}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>Home</span>
      </button>
      
      <button
        onclick={() => goto('/chat-replicas')}
        class="nav-item-accessible {currentPath === '/chat-replicas' || currentPath === '/' ? 'active' : ''}"
        aria-current={currentPath === '/chat-replicas' ? 'page' : undefined}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        <span>Chat</span>
      </button>
      
      <button
        onclick={() => goto('/gallery')}
        class="nav-item-accessible {currentPath.startsWith('/gallery') ? 'active' : ''}"
        aria-current={currentPath.startsWith('/gallery') ? 'page' : undefined}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
        <span>Photos</span>
      </button>
      
      {#if userRole !== 'patient'}
        <button
          onclick={() => goto('/create-replicas')}
          class="nav-item-accessible {currentPath.startsWith('/create-replicas') ? 'active' : ''}"
          aria-current={currentPath.startsWith('/create-replicas') ? 'page' : undefined}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span>Create</span>
        </button>
        
        <button
          onclick={() => goto('/manage-patients')}
          class="nav-item-accessible {currentPath.startsWith('/manage-patients') ? 'active' : ''}"
          aria-current={currentPath.startsWith('/manage-patients') ? 'page' : undefined}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Patients</span>
        </button>
      {/if}
    </div>
    
    <!-- Right side actions -->
    <div class="flex items-center gap-2">
      <!-- Theme Toggle - only show for caretakers -->
      {#if userRole !== 'patient'}
        <ThemeToggle />
      {/if}
      
      <!-- Mobile menu button -->
      <button
        onclick={() => showMobileMenu = !showMobileMenu}
        class="md:hidden btn-tactile-secondary min-w-[48px] min-h-[48px] p-2"
        aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
        aria-expanded={showMobileMenu}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          {#if showMobileMenu}
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          {:else}
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          {/if}
        </svg>
      </button>
      
      <!-- Auth buttons - Desktop -->
      {#if isAuthenticated}
        <button
          onclick={logout}
          class="hidden md:flex btn-tactile btn-tactile-danger"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Logout</span>
        </button>
      {:else}
        <div class="hidden md:flex items-center gap-2">
          <button
            onclick={() => goto('/login')}
            class="btn-tactile btn-tactile-secondary"
          >
            Log In
          </button>
          <button
            onclick={() => goto('/signup')}
            class="btn-tactile btn-tactile-primary"
          >
            Sign Up
          </button>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Mobile menu - Full screen, large touch targets -->
  {#if showMobileMenu}
    <div class="md:hidden fixed inset-0 top-[72px] bg-cream-50 dark:bg-charcoal-800 z-50 p-4 overflow-y-auto">
      <div class="flex flex-col gap-3">
        <button
          onclick={() => { goto('/dashboard'); showMobileMenu = false; }}
          class="btn-tactile btn-tactile-secondary w-full justify-start gap-4 text-left {currentPath === '/dashboard' ? 'ring-2 ring-teal-500' : ''}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span class="text-accessible-lg font-semibold">Home</span>
        </button>
        
        <button
          onclick={() => { goto('/chat-replicas'); showMobileMenu = false; }}
          class="btn-tactile btn-tactile-secondary w-full justify-start gap-4 text-left {currentPath === '/chat-replicas' ? 'ring-2 ring-teal-500' : ''}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <span class="text-accessible-lg font-semibold">Chat</span>
        </button>
        
        <button
          onclick={() => { goto('/gallery'); showMobileMenu = false; }}
          class="btn-tactile btn-tactile-secondary w-full justify-start gap-4 text-left {currentPath.startsWith('/gallery') ? 'ring-2 ring-teal-500' : ''}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
          <span class="text-accessible-lg font-semibold">Photos</span>
        </button>
        
        {#if userRole !== 'patient'}
          <button
            onclick={() => { goto('/create-replicas'); showMobileMenu = false; }}
            class="btn-tactile btn-tactile-secondary w-full justify-start gap-4 text-left {currentPath.startsWith('/create-replicas') ? 'ring-2 ring-teal-500' : ''}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <span class="text-accessible-lg font-semibold">Create Replica</span>
          </button>
          
          <button
            onclick={() => { goto('/manage-patients'); showMobileMenu = false; }}
            class="btn-tactile btn-tactile-secondary w-full justify-start gap-4 text-left {currentPath.startsWith('/manage-patients') ? 'ring-2 ring-teal-500' : ''}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span class="text-accessible-lg font-semibold">Manage Patients</span>
          </button>
        {/if}
        
        <hr class="my-3 border-cream-300 dark:border-charcoal-600">
        
        {#if isAuthenticated}
          <button
            onclick={() => { logout(); showMobileMenu = false; }}
            class="btn-tactile btn-tactile-danger w-full justify-start gap-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span class="text-accessible-lg font-semibold">Logout</span>
          </button>
        {:else}
          <button
            onclick={() => { goto('/login'); showMobileMenu = false; }}
            class="btn-tactile btn-tactile-secondary w-full justify-center"
          >
            <span class="text-accessible-lg font-semibold">Log In</span>
          </button>
          <button
            onclick={() => { goto('/signup'); showMobileMenu = false; }}
            class="btn-tactile btn-tactile-primary w-full justify-center"
          >
            <span class="text-accessible-lg font-semibold">Sign Up</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}
</nav>
