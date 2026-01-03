<script>
  import { goto } from '$app/navigation';
  
  let { 
    showBack = true, 
    showHome = true, 
    customBackAction = null,
    title = null,
    subtitle = null 
  } = $props();
  
  function goBack() {
    if (customBackAction) {
      customBackAction();
    } else {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        goto('/dashboard');
      }
    }
  }
  
  function goHome() {
    goto('/dashboard');
  }
</script>

<div class="flex items-center justify-between bg-cream-100 dark:bg-charcoal-800 border-b-2 border-cream-300 dark:border-charcoal-600 px-4 py-4 mb-6">
  <div class="flex items-center gap-4">
    {#if showBack}
      <button
        onclick={goBack}
        class="btn-tactile btn-tactile-secondary min-w-[48px] min-h-[48px] p-2"
        title="Go back"
        aria-label="Go back to previous page"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
    {/if}
    
    {#if title}
      <div class="flex flex-col">
        <h1 class="text-accessible-xl font-bold text-charcoal-800 dark:text-cream-100">
          {title}
        </h1>
        {#if subtitle}
          <p class="text-accessible-base text-charcoal-600 dark:text-cream-300">
            {subtitle}
          </p>
        {/if}
      </div>
    {/if}
  </div>
  
  {#if showHome}
    <button
      onclick={goHome}
      class="btn-tactile btn-tactile-primary min-w-[48px] min-h-[48px] p-2"
      title="Go to Home"
      aria-label="Go to Home"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    </button>
  {/if}
</div>
