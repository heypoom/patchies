import { fetchTopicHelp } from '$lib/docs/fetch-topic-help';

/**
 * Composable for fetching topic help content reactively.
 * Automatically fetches when topicSlug changes.
 */
export function useTopicHelp(getTopicSlug: () => string | null) {
  let htmlContent = $state<string | null>(null);
  let title = $state<string | null>(null);
  let loading = $state(false);

  $effect(() => {
    const topicSlug = getTopicSlug();

    if (!topicSlug) {
      htmlContent = null;
      title = null;
      loading = false;
      return;
    }

    loading = true;

    fetchTopicHelp(topicSlug).then((content) => {
      htmlContent = content.htmlContent;
      title = content.title;
      loading = false;
    });
  });

  return {
    get htmlContent() {
      return htmlContent;
    },
    get title() {
      return title;
    },
    get loading() {
      return loading;
    }
  };
}
