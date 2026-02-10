// Category order for display in docs navigation
export const categoryOrder = [
  'Getting Started',
  'Connections',
  'Sidebar',
  'Audio & Video',
  'Scripting',
  'Other'
];

// Topic order within each category
export const topicOrder: Record<string, string[]> = {
  'Getting Started': ['demos', 'adding-objects', 'modifying-objects', 'keyboard-shortcuts'],
  Connections: ['connecting-objects', 'message-passing', 'hot-cold-inlets', 'network-p2p'],
  'Audio & Video': ['audio-chaining', 'video-chaining', 'audio-reactivity', 'connection-rules'],
  Scripting: ['javascript-runner', 'canvas-interaction', 'virtual-filesystem', 'data-storage'],
  Sidebar: ['manage-saves', 'manage-presets', 'manage-files', 'manage-packs', 'in-app-help'],
  Other: [
    'sharing-links',
    'offline-usage',
    'ai-features',

    'rendering-pipeline',
    'supporting-open-source'
  ]
};
