import { error } from '@sveltejs/kit';
import { objectSchemas } from '$lib/objects/schemas';
import { fetchObjectHelp } from '$lib/objects/fetch-object-help';
import { objectTypeToSlug, objectSlugToType } from '$lib/docs/object-slug';
import type { PageLoad, EntryGenerator } from './$types';

// Generate entries for prerendering all object pages
export const entries: EntryGenerator = () => {
  return Object.keys(objectSchemas).map((type) => ({ object: objectTypeToSlug(type) }));
};

export const load: PageLoad = async ({ params, fetch }) => {
  const objectType = objectSlugToType(params.object);

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
