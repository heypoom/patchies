<script lang="ts">
  import { Keyboard, MousePointer } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';

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
      keys: ['Ctrl', 'Click on object / edge'],
      description: 'Multi-select objects and edges',
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
  <!-- Header -->
  <div class="sc-hero">
    <p class="sc-eyebrow">patchies · shortcuts</p>
    <h1 class="sc-headline">Keyboard & Mouse</h1>
    <p class="sc-subhead">Quick reference for navigating and working with Patchies.</p>
  </div>

  <!-- Mouse -->
  <div class="sc-group">
    <div class="sc-group-label">
      <MousePointer class="sc-group-icon" />
      mouse
    </div>
    <div class="sc-list">
      {#each mouseShortcuts as shortcut}
        <div class="sc-row">
          <span class="sc-desc">{shortcut.description}</span>
          <div class="sc-keys">
            {#each shortcut.keys as key}
              <kbd class="sc-key">{transformKey(key)}</kbd>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Keyboard -->
  <div class="sc-group">
    <div class="sc-group-label">
      <Keyboard class="sc-group-icon" />
      keyboard
    </div>
    <div class="sc-list">
      {#each keyboardShortcuts as shortcut}
        <div class="sc-row">
          <span class="sc-desc">{shortcut.description}</span>
          <div class="sc-keys">
            {#each shortcut.keys as key}
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
    gap: 24px;
  }

  /* Hero */
  .sc-hero {
    padding-bottom: 4px;
  }

  .sc-eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: rgba(249, 115, 22, 0.7);
    margin-bottom: 14px;
  }

  .sc-headline {
    font-family: 'Instrument Serif', serif;
    font-style: italic;
    font-size: clamp(1.8rem, 5vw, 2.4rem);
    line-height: 1.12;
    color: #f4f4f5;
    margin-bottom: 10px;
  }

  .sc-subhead {
    font-family: 'Syne', sans-serif;
    font-size: 0.82rem;
    color: #52525b;
    line-height: 1.6;
  }

  /* Group */
  .sc-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sc-group-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #3f3f46;
  }

  :global(.sc-group-icon) {
    width: 11px;
    height: 11px;
    color: rgba(249, 115, 22, 0.5);
  }

  /* Shortcut list */
  .sc-list {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    overflow: hidden;
  }

  .sc-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.12s;
  }

  .sc-row:last-child {
    border-bottom: none;
  }

  .sc-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .sc-desc {
    font-family: 'Syne', sans-serif;
    font-size: 0.78rem;
    color: #71717a;
    flex: 1;
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
    color: #71717a;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 2px 7px;
    white-space: nowrap;
  }
</style>
