import type { ClientInit, HandleClientError } from '@sveltejs/kit';

export const init: ClientInit = () => {
  window.__patchiesStartup?.phase('SvelteKit started; loading the page');
};

export const handleError: HandleClientError = ({ error }) => {
  console.error('[SvelteKit]', error);
  window.__patchiesStartup?.error(error);
};
