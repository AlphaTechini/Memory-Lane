<script>
	let value = '';

	/**
	 * @param {SubmitEvent} event
	 */
	function handleSubmit(event) {
		event.preventDefault();
		console.log('submitting', value);
		// You can dispatch an event here, e.g.
		// import { createEventDispatcher } from 'svelte';
		// const dispatch = createEventDispatcher();
		// dispatch('submit', { text: value });
		value = '';
	}

	/** @type {import('svelte/elements').HTMLTextareaAttributes['onkeydown']} */
	function handleKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			event.currentTarget?.form?.requestSubmit();
		}
	}
</script>

<form onsubmit={handleSubmit}>
	<textarea bind:value onkeydown={handleKeydown} placeholder="Type a message..."></textarea>
	<button type="submit">Send</button>
</form>