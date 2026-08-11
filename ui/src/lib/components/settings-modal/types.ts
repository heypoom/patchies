export const SETTINGS_CATEGORIES = [
  // Per-User
  'general',
  'editor',
  'rendering',
  'ai',
  'debug',
  // Per-Patch
  'visual',
  'transport',
  'network'
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export type SettingsCategoryScope = 'per-user' | 'per-patch';

export interface SettingsCategoryInfo {
  id: SettingsCategory;
  label: string;
  scope: SettingsCategoryScope;
  description: string;
}

export const CATEGORY_INFO: SettingsCategoryInfo[] = [
  {
    id: 'general',
    label: 'General',
    scope: 'per-user',
    description: 'Startup and workspace preferences.'
  },
  {
    id: 'editor',
    label: 'Editor',
    scope: 'per-user',
    description: 'Code editing, layout, and type preferences.'
  },
  {
    id: 'rendering',
    label: 'Rendering',
    scope: 'per-user',
    description: 'Preview performance and output behavior.'
  },
  {
    id: 'ai',
    label: 'AI',
    scope: 'per-user',
    description: 'Provider access and generation preferences.'
  },
  {
    id: 'debug',
    label: 'Debug',
    scope: 'per-user',
    description: 'Diagnostics for developing and testing patches.'
  },
  {
    id: 'visual',
    label: 'Visual',
    scope: 'per-patch',
    description: 'Canvas display and render size for this patch.'
  },
  {
    id: 'transport',
    label: 'Transport',
    scope: 'per-patch',
    description: 'Tempo and timing for this patch.'
  },
  {
    id: 'network',
    label: 'Network',
    scope: 'per-patch',
    description: 'Peer-to-peer room settings for this patch.'
  }
];
