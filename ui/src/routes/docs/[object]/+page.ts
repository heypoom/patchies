import { error } from '@sveltejs/kit';
import { objectSchemas } from '$lib/objects/schemas';
import { fetchObjectHelp } from '$lib/objects/fetch-object-help';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const objectType = params.object;

  // Get schema if available
  const schema = objectSchemas[objectType] ?? null;

  // Fetch help content
  const helpContent = await fetchObjectHelp(objectType, fetch);

  // If neither schema nor markdown exists, 404
  if (!schema && !helpContent.markdown) {
    throw error(404, {
      message: `Documentation not found for "${objectType}"`
    });
  }

  return {
    objectType,
    schema,
    markdown: helpContent.markdown,
    hasHelpPatch: helpContent.hasHelpPatch
  };
};
