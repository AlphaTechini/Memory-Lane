import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default {
	plugins: [
		tailwindcss(),
		sveltekit(),
		devtoolsJson()
	]
};

