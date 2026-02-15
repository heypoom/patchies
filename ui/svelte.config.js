import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ strict: false }),
    prerender: {
      handleHttpError: ({ path, message }) => {
        // Allow 404s for optional content files (not all objects have markdown docs)
        if (path.startsWith('/content/')) return;
        throw new Error(message);
      }
    },
    alias: {
      $workers: 'src/workers'
    }
  }
};

export default config;
