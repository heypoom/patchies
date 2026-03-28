// Category order for display in docs navigation
export const categoryOrder = [
  'Getting Started',
  'Essentials',
  'Connections',
  'Scripting',
  'Sidebar',
  'Timing & Sync',
  'Other',
  'AI'
];

// Topic order within each category
export const topicOrder: Record<string, string[]> = {
  'Getting Started': ['demos', 'adding-objects', 'modifying-objects', 'shortcuts'],
  Essentials: [
    'connecting-objects',
    'message-passing',
    'javascript-runner',
    'audio-chaining',
    'video-chaining'
  ],
  Connections: ['connection-rules', 'hot-cold-inlets'],
  Scripting: [
    'canvas-interaction',
    'virtual-filesystem',
    'data-storage',
    'object-settings',
    'network-p2p'
  ],
  Sidebar: [
    'manage-files',
    'manage-presets',
    'manage-saves',
    'manage-packs',
    'in-app-help',
    'browse-samples'
  ],
  'Timing & Sync': ['audio-reactivity', 'transport-control', 'clock-api', 'parameter-automation'],
  Other: ['sharing-links', 'offline-usage', 'rendering-pipeline', 'supporting-open-source'],
  AI: ['enabling-ai', 'ai-edits', 'ai-chat', 'ai-patch-to-app']
};
