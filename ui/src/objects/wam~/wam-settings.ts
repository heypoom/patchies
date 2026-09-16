import type { SettingsSchema } from '$lib/settings';

export const WAM_SETTINGS_SCHEMA: SettingsSchema = [
  {
    key: 'muted',
    label: 'Mute output',
    description: 'Silence this WAM without stopping it',
    type: 'boolean',
    persistence: 'none',
    default: false
  },
  {
    key: 'resizable',
    label: 'Enable resizing',
    description: 'Show resize handles while the node is selected',
    type: 'boolean',
    persistence: 'none',
    default: false
  }
];
