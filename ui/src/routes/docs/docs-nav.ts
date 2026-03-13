// Category order for display in docs navigation
export const categoryOrder = [
  'Getting Started',
  'Connections',
  'Sidebar',
  'Audio & Video',
  'Scripting',
  'Timing & Sync',
  'Other'
];

// Topic order within each category
export const topicOrder: Record<string, string[]> = {
  'Getting Started': ['demos', 'adding-objects', 'modifying-objects', 'shortcuts'],
  Connections: ['connecting-objects', 'message-passing', 'hot-cold-inlets', 'network-p2p'],
  'Audio & Video': ['audio-chaining', 'video-chaining', 'connection-rules'],
  Scripting: ['javascript-runner', 'canvas-interaction', 'virtual-filesystem', 'data-storage'],
  'Timing & Sync': ['audio-reactivity', 'transport-control', 'clock-api', 'parameter-automation'],
  Sidebar: [
    'manage-files',
    'manage-presets',
    'manage-saves',
    'manage-packs',
    'in-app-help',
    'browse-samples'
  ],
  Other: [
    'sharing-links',
    'offline-usage',
    'ai-features',
    'rendering-pipeline',
    'supporting-open-source'
  ]
};
