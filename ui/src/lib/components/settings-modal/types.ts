export const SETTINGS_CATEGORIES = [
  // Per-User
  'general',
  'editor',
  'rendering',
  'ai',
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
}

export const CATEGORY_INFO: SettingsCategoryInfo[] = [
  { id: 'general', label: 'General', scope: 'per-user' },
  { id: 'editor', label: 'Editor', scope: 'per-user' },
  { id: 'rendering', label: 'Rendering', scope: 'per-user' },
  { id: 'ai', label: 'AI', scope: 'per-user' },
  { id: 'visual', label: 'Visual', scope: 'per-patch' },
  { id: 'transport', label: 'Transport', scope: 'per-patch' },
  { id: 'network', label: 'Network', scope: 'per-patch' }
];
