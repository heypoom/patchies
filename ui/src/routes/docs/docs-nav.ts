// Category order for display in docs navigation
export const categoryOrder = [
  'Getting Started',
  'Connections',
  'Audio & Video',
  'Scripting',
  'Sidebar Features',
  'Other'
];

// Topic order within each category
export const topicOrder: Record<string, string[]> = {
  'Getting Started': ['getting-started', 'creating-objects', 'keyboard-shortcuts'],
  Connections: ['connecting-objects', 'message-passing'],
  'Audio & Video': ['audio-chaining', 'video-chaining', 'audio-reactivity', 'connection-rules'],
  Scripting: ['javascript-runner', 'canvas-interaction'],
  'Sidebar Features': ['manage-saves', 'manage-presets', 'manage-files', 'manage-packs'],
  Other: [
    'sharing-links',
    'offline-usage',
    'ai-features',

    'rendering-pipeline',
    'supporting-open-source'
  ]
};
