export const WAM_COMMUNITY_PLUGINS_URL = 'https://www.webaudiomodules.com/community/plugins.json';

const WAM_COMMUNITY_PLUGIN_BASE_URL = new URL('plugins/', WAM_COMMUNITY_PLUGINS_URL);

export type WamCommunityPlugin = {
  identifier: string;
  name: string;
  vendor: string;
  description: string;
  categories: string[];
  thumbnailUrl?: string;
  url: string;
};

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  return typeof value === 'string' ? value.trim() : '';
}

function resolveCommunityUrl(path: string): string | undefined {
  try {
    return new URL(path, WAM_COMMUNITY_PLUGIN_BASE_URL).href;
  } catch {
    return undefined;
  }
}

export function parseWamCommunityPlugins(value: unknown): WamCommunityPlugin[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const record = entry as Record<string, unknown>;
    const path = getString(record, 'path');
    const name = getString(record, 'name');
    if (!path || !name) return [];

    const url = resolveCommunityUrl(path);
    if (!url) return [];

    const thumbnail = getString(record, 'thumbnail');

    const categories = Array.isArray(record.category)
      ? record.category.filter((category): category is string => typeof category === 'string')
      : [];

    return [
      {
        identifier: getString(record, 'identifier'),
        name,
        vendor: getString(record, 'vendor'),
        description: getString(record, 'description'),
        categories,
        thumbnailUrl: thumbnail ? resolveCommunityUrl(thumbnail) : undefined,
        url
      }
    ];
  });
}

export async function fetchWamCommunityPlugins(): Promise<WamCommunityPlugin[]> {
  const response = await fetch(WAM_COMMUNITY_PLUGINS_URL);
  if (!response.ok) throw new Error(`Community registry request failed (${response.status}).`);

  return parseWamCommunityPlugins(await response.json());
}
