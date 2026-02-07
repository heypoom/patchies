import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const topic = params.topic;

  // Fetch topic markdown
  const res = await fetch(`/content/topics/${topic}.md`);

  if (!res.ok) {
    throw error(404, {
      message: `Documentation not found for "${topic}"`
    });
  }

  const markdown = await res.text();

  return {
    topic,
    markdown
  };
};
