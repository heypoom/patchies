import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

function isGeneratedSvelteKitRootStateWarning(warning) {
  return (
    warning.code === 'state_referenced_locally' &&
    warning.filename?.replaceAll('\\', '/').endsWith('.svelte-kit/generated/root.svelte')
  );
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  onwarn: (warning, defaultHandler) => {
    // SvelteKit owns this generated file; keep project-authored warnings visible.
    if (isGeneratedSvelteKitRootStateWarning(warning)) return;

    defaultHandler(warning);
  },
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
      $workers: 'src/workers',
      $objects: 'src/objects',
      $routes: 'src/routes'
    }
  }
};

export default config;
