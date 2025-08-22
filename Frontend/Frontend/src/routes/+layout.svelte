<script>
	import '../app.css';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
</script>

<div class="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
	<header class="p-4 flex justify-end border-b border-gray-200 dark:border-gray-800">
		<ThemeToggle />
	</header>
	<main>
		<slot />
	</main>
</div>

