<script lang="ts">
  import { Keyboard, MousePointer } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';
  import StartupTabIntro from './StartupTabIntro.svelte';

  import { isAiFeaturesVisible } from '../../../stores/ui.store';

  let isMac = $state(false);

  onMount(() => {
    isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  });

  interface Shortcut {
    keys: string[];
    description: string;
    category: 'mouse' | 'keyboard';
    requiresAi?: boolean;
  }

  const shortcuts: Shortcut[] = [
    { keys: ['Click on object / title'], description: 'Focus on the object', category: 'mouse' },
    { keys: ['Drag on object / title'], description: 'Move the object around', category: 'mouse' },
    { keys: ['Scroll up'], description: 'Zoom in', category: 'mouse' },
    { keys: ['Scroll down'], description: 'Zoom out', category: 'mouse' },
    { keys: ['Drag on empty space'], description: 'Pan the canvas', category: 'mouse' },
    {
      keys: ['Shift', 'Drag on empty space'],
      description: 'Select multiple objects',
      category: 'mouse'
    },
    {
      keys: ['Shift', 'Click on object / edge'],
      description: 'Select multiple objects and edges',
      category: 'mouse'
    },
    { keys: ['Enter'], description: 'Create a new object at cursor', category: 'keyboard' },
    { keys: ['Ctrl', 'K'], description: 'Open the command palette', category: 'keyboard' },
    { keys: ['Ctrl', 'B'], description: 'Toggle the left sidebar', category: 'keyboard' },
    { keys: ['Ctrl', 'O'], description: 'Browse all objects', category: 'keyboard' },
    {
      keys: ['Ctrl', 'I'],
      description: 'Insert or edit object with AI',
      category: 'keyboard',
      requiresAi: true
    },
    { keys: ['Ctrl', 'S'], description: 'Save the patch', category: 'keyboard' },
    {
      keys: ['Ctrl', 'Shift', 'S'],
      description: 'Save as a different patch',
      category: 'keyboard'
    },
    { keys: ['Ctrl', 'N'], description: 'Create a new patch', category: 'keyboard' },
    { keys: ['Shift', 'Enter'], description: 'Run the code in the editor', category: 'keyboard' },
    { keys: ['Delete'], description: 'Delete the selected object', category: 'keyboard' },
    { keys: ['Ctrl', 'C'], description: 'Copy the selected object', category: 'keyboard' },
    { keys: ['Ctrl', 'V'], description: 'Paste the copied object', category: 'keyboard' },
    { keys: ['Ctrl', 'Z'], description: 'Undo', category: 'keyboard' },
    { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo', category: 'keyboard' },
    { keys: ['Space'], description: 'Toggle play / pause', category: 'keyboard' },
    { keys: ['Shift', 'Space'], description: 'Toggle the transport panel', category: 'keyboard' },
    { keys: ['Shift', 'P'], description: 'Toggle all node previews', category: 'keyboard' }
  ];

  const transformKey = (key: string) => (isMac && key === 'Ctrl' ? 'Cmd' : key);

  const mouseShortcuts = $derived(
    shortcuts.filter((s) => s.category === 'mouse' && (!s.requiresAi || $isAiFeaturesVisible))
  );

  const keyboardShortcuts = $derived(
    shortcuts.filter((s) => s.category === 'keyboard' && (!s.requiresAi || $isAiFeaturesVisible))
  );
</script>

<div class="sc-root">
  <StartupTabIntro
    title="Move at patch speed."
    description="A complete keyboard and mouse reference for navigating the canvas and building patches."
  />

  <div class="sc-group">
    <div class="sc-group-label">
      <span><MousePointer class="sc-group-icon" /> Mouse</span>
      <span>{mouseShortcuts.length} gestures</span>
    </div>
    <div class="sc-list">
      {#each mouseShortcuts as shortcut (shortcut.description)}
        <div class="sc-row">
          <span class="sc-desc">{shortcut.description}</span>
          <div class="sc-keys">
            {#each shortcut.keys as key (key)}
              <kbd class="sc-key">{transformKey(key)}</kbd>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="sc-group">
    <div class="sc-group-label">
      <span><Keyboard class="sc-group-icon" /> Keyboard</span>
      <span>{keyboardShortcuts.length} commands</span>
    </div>
    <div class="sc-list">
      {#each keyboardShortcuts as shortcut (shortcut.description)}
        <div class="sc-row">
          <span class="sc-desc">{shortcut.description}</span>
          <div class="sc-keys">
            {#each shortcut.keys as key (key)}
              <kbd class="sc-key">{transformKey(key)}</kbd>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .sc-root {
    display: flex;
    flex-direction: column;
  }

  .sc-group {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sc-group-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 32px 12px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #52525b;
  }

  .sc-group-label > span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #d4d4d8;
  }

  :global(.sc-group-icon) {
    width: 13px;
    height: 13px;
    color: #f97316;
  }

  .sc-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sc-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 52px;
    padding: 10px 18px 10px 32px;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: background 0.12s;
  }

  .sc-row:nth-child(2n) {
    border-right: 0;
  }
  .sc-row:hover {
    background: rgba(255, 255, 255, 0.025);
  }

  .sc-desc {
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.78rem;
    color: #a1a1aa;
    flex: 1;
    line-height: 1.35;
  }

  .sc-keys {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .sc-key {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #a1a1aa;
    background: #1c1c1f;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    padding: 2px 7px;
    white-space: nowrap;
  }

  @media (max-width: 700px) {
    .sc-group-label {
      padding-inline: 20px;
    }
    .sc-list {
      grid-template-columns: 1fr;
    }
    .sc-row {
      padding-inline: 20px;
      border-right: 0;
    }
  }
</style>
