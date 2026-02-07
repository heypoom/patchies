import { fetchObjectHelp } from '$lib/objects/fetch-object-help';

/**
 * Composable for fetching object help content reactively.
 * Automatically fetches when objectType changes.
 */
export function useObjectHelp(getObjectType: () => string | null) {
  let htmlContent = $state<string | null>(null);
  let hasHelpPatch = $state(false);
  let loading = $state(false);

  $effect(() => {
    const objectType = getObjectType();

    if (!objectType) {
      htmlContent = null;
      hasHelpPatch = false;
      loading = false;
      return;
    }

    loading = true;
    hasHelpPatch = false;

    fetchObjectHelp(objectType).then((content) => {
      htmlContent = content.htmlContent;
      hasHelpPatch = content.hasHelpPatch;
      loading = false;
    });
  });

  return {
    get htmlContent() {
      return htmlContent;
    },
    get hasHelpPatch() {
      return hasHelpPatch;
    },
    get loading() {
      return loading;
    }
  };
}
