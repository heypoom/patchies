export interface PaletteCommand {
  id: string;
  name: string;
  description: string;
  requiresAi?: boolean;
  requiresSelection?: boolean;
}

interface CommandContext {
  cablesVisible: boolean;
  renderFpsCap: number;
  useWebCodecs: boolean;
}

export const createPaletteCommands = ({
  cablesVisible,
  renderFpsCap,
  useWebCodecs
}: CommandContext): PaletteCommand[] => [
  {
    id: 'undo',
    name: 'Undo',
    description: 'Undo the last action (Ctrl+Z)'
  },
  {
    id: 'redo',
    name: 'Redo',
    description: 'Redo the last undone action (Ctrl+Shift+Z)'
  },
  {
    id: 'share-patch',
    name: 'Share Patch Link',
    description: 'Get a shareable link for your patch.'
  },
  {
    id: 'new-patch',
    name: 'New Patch',
    description: 'Create a new patch. All unsaved changes will be lost.'
  },
  {
    id: 'enter-fullscreen',
    name: 'Enter Fullscreen',
    description: 'Enter fullscreen mode in the main window.'
  },
  {
    id: 'toggle-connect-mode',
    name: 'Toggle Easy Connect',
    description: 'Enter or exit easy connect mode for quickly connecting objects'
  },
  {
    id: 'ai-insert-object',
    name: 'Insert or Edit Object with AI',
    description: 'Use AI to create objects with natural language',
    requiresAi: true
  },
  { id: 'export-patch', name: 'Export Patch', description: 'Save patch as JSON file' },
  { id: 'import-patch', name: 'Import Patch', description: 'Load patch from JSON file' },
  {
    id: 'import-preset-library',
    name: 'Import Preset Library',
    description: 'Add a preset library from a JSON file'
  },
  { id: 'save-patch', name: 'Save Patch', description: 'Save patch to local storage' },
  { id: 'load-patch', name: 'Load Patch', description: 'Load patch from local storage' },
  { id: 'rename-patch', name: 'Rename Patch', description: 'Rename saved patch' },
  { id: 'delete-patch', name: 'Delete Patch', description: 'Delete patch from local storage' },
  {
    id: 'open-output-screen',
    name: 'Open Output Screen',
    description: 'Open a secondary output screen for live performances.'
  },
  {
    id: 'toggle-output-target',
    name: 'Toggle Output Target',
    description: 'Switch between background canvas and output screen.'
  },
  {
    id: 'open-settings',
    name: 'Settings',
    description: 'Open the settings modal (⌘,)'
  },
  {
    id: 'toggle-sidebar',
    name: 'Toggle Sidebar',
    description: 'Files and presets in the sidebar'
  },
  {
    id: 'browse-objects',
    name: 'Browse Objects',
    description: 'Open the object browser to add nodes (Ctrl+O)'
  },
  {
    id: 'enable-all-packs',
    name: 'Enable All Packs',
    description: 'Enable every object and preset pack for workshops'
  },
  {
    id: 'save-as-preset',
    name: 'Save Selected Object as Preset',
    description: 'Save the selected node as a reusable preset',
    requiresSelection: true
  },
  {
    id: 'help-about',
    name: 'Getting Started: About',
    description: 'Open the About tab in the Getting Started guide'
  },
  {
    id: 'help-demos',
    name: 'Getting Started: Demos',
    description: 'Open the Demos tab to browse example patches'
  },
  {
    id: 'help-sparks',
    name: 'Getting Started: Sparks',
    description: 'Open the Sparks tab for AI-generated patch ideas',
    requiresAi: true
  },
  {
    id: 'help-shortcuts',
    name: 'Getting Started: Shortcuts',
    description: 'Open the Shortcuts tab for keyboard shortcuts'
  },
  {
    id: 'help-thanks',
    name: 'Getting Started: Thanks',
    description: 'Open the Thanks tab for credits and acknowledgements'
  },
  {
    id: 'open-docs',
    name: 'Open Docs / Help',
    description: 'Browse the docs for adding and using objects'
  },
  {
    id: 'set-room',
    name: 'Set room for netsend/netrecv',
    description: 'Set a custom room ID for P2P communication between patches'
  },
  {
    id: 'set-output-size',
    name: 'Set Output Size',
    description: 'Set the render resolution for this patch (e.g. 1920x1080)'
  },
  {
    id: 'generate-prompt',
    name: 'Patch to App',
    description: 'Generate an app from your patch or export as a specification',

    // It does not really require AI.
    // The rationale is that people who presses "Toggle AI Features"
    // Likely doesn't want to see this.
    requiresAi: true
  },
  {
    id: 'set-gemini-api-key',
    name: 'AI Provider Settings',
    description: 'Configure AI provider (Gemini or OpenRouter) and API key',
    requiresAi: true
  },
  {
    id: 'toggle-bottom-bar',
    name: 'Toggle Bottom Bar',
    description: 'Show or hide the bottom toolbar'
  },
  {
    id: 'prepare-offline',
    name: 'Prepare for Offline',
    description: 'Download heavy assets (Ruby WASM, SuperSonic, Strudel samples) for offline use'
  },
  {
    id: 'toggle-ai-features',
    name: 'Toggle AI Features',
    description: 'Show or hide AI-related objects and features'
  },
  {
    id: 'clear-cache',
    name: 'Clear Cache',
    description: 'Fix stale app issues by clearing all caches and unregistering service workers'
  },
  {
    id: 'toggle-vim-mode',
    name: 'Toggle Vim Mode',
    description: 'Enable or disable Vim keybindings in code editors'
  },
  {
    id: 'toggle-cables',
    name: 'Toggle Cables',
    description: `${cablesVisible ? 'Hide' : 'Show'} cables (edges) between objects`
  },
  {
    id: 'toggle-fps-monitor',
    name: 'Toggle FPS Monitor',
    description: 'Show or hide the FPS monitor'
  },
  {
    id: 'cycle-render-fps-cap',
    name: `Render FPS Cap: ${renderFpsCap === 0 ? 'Unlimited' : `${renderFpsCap} FPS`}`,
    description: 'Cycle render FPS limit (Unlimited → 30 → 60)'
  },
  {
    id: 'toggle-video-stats',
    name: 'Toggle Video Stats Overlay',
    description: 'Show or hide video/webcam performance stats (FPS, drops, pipeline)'
  },
  {
    id: 'toggle-mediabunny',
    name: 'Toggle MediaBunny',
    description: `${useWebCodecs ? 'Disable' : 'Enable'} MediaBunny for video decoding (currently ${useWebCodecs ? 'ON' : 'OFF'})`
  },
  {
    id: 'clear-patch-data',
    name: 'Clear Patch Data',
    description: 'Delete all kv storage data for the current patch'
  },
  {
    id: 'view-startup-diagnostics',
    name: 'View startup diagnostics',
    description: 'Inspect the slowest and largest downloads from this page load'
  }
];
