<script lang="ts">
  import { categoryOrder, topicOrder } from '../../../routes/docs/docs-nav';
  import DocsSidebarDesktop from './DocsSidebarDesktop.svelte';
  import DocsSidebarMobile from './DocsSidebarMobile.svelte';
  import type { Topic, ObjectItem } from './docs-sidebar-types';

  interface Props {
    topics: Topic[];
    objects: ObjectItem[];
    visible?: boolean;
  }

  let { topics, objects, visible = $bindable(true) }: Props = $props();

  const topicsByCategory = $derived.by(() => {
    const groups = new Map<string, Topic[]>();

    for (const topic of topics) {
      const category = topic.category ?? 'Other';

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category)!.push(topic);
    }

    for (const [category, categoryTopics] of groups) {
      const order = topicOrder[category] ?? [];

      categoryTopics.sort((a, b) => {
        const aIndex = order.indexOf(a.slug);
        const bIndex = order.indexOf(b.slug);
        const aPos = aIndex === -1 ? Infinity : aIndex;
        const bPos = bIndex === -1 ? Infinity : bIndex;

        return aPos - bPos;
      });
    }

    return groups;
  });
</script>

<DocsSidebarMobile {topics} {objects} {topicsByCategory} {categoryOrder} />
<DocsSidebarDesktop {topics} {objects} {topicsByCategory} {categoryOrder} bind:visible />
