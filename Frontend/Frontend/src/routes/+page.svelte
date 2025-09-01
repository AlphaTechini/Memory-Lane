<script>
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import MessageInput from '$lib/components/MessageInput.svelte';

	// Mock data and function, you can replace this with your actual chat logic.
	let messages = [
		{ id: 1, type: 'text', text: 'Hello! How can I help you today?', sender: 'ai' }
	];

	function addMessage(message) {
		messages = [...messages, message];
	}

	// updated handler: accept CustomEvent or direct payload, interpolate correctly
	function handleSend(eventOrPayload) {
		const payload = eventOrPayload && eventOrPayload.detail ? eventOrPayload.detail : eventOrPayload;
		const text = payload?.text ?? '';

		const userMessage = { id: Date.now(), type: 'text', text, sender: 'user' };
		addMessage(userMessage);

		// Simulate AI response using a template string (correct interpolation)
		setTimeout(() => {
			const aiResponse = {
				id: Date.now() + 1,
				type: 'text',
				text: `This is a simulated response: ${text}`,
				sender: 'ai'
			};
			addMessage(aiResponse);
		}, 1200);
	}
</script>

<div class="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
	<header class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
		<h1 class="text-xl font-bold">Sensay AI Chat</h1>
		<ThemeToggle />
	</header>

	<main class="flex-1 overflow-y-auto p-4 space-y-4">
		{#each messages as message (message.id)}
			<div class="flex" class:justify-end={message.sender === 'user'}>
				<div
					class="max-w-lg p-3 rounded-lg"
					class:bg-blue-500={message.sender === 'user'}
					class:text-white={message.sender === 'user'}
					class:bg-gray-200={message.sender === 'ai'}
					class:dark:bg-gray-700={message.sender === 'ai'}
				>
					{#if message.type === 'text'}
						{message.text}
					{:else if message.type === 'audio'}
						<!-- Basic audio player for voice messages -->
						<audio controls src={message.url} class="w-full"></audio>
					{/if}
				</div>
			</div>
		{/each}
	</main>

	<footer class="p-4 border-t dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
		<MessageInput on:send={handleSend} />
	</footer>
</div>