<script lang="ts">
  import { Cable, CirclePlus, PanelLeftOpen, Play } from '@lucide/svelte/icons';

  let { isMac }: { isMac: boolean } = $props();

  const mod = $derived(isMac ? 'Cmd' : 'Ctrl');
</script>

<div class="tips-root">
  <div class="tips-grid">
    <div class="tip hidden sm:flex">
      <span class="tip-label">Add object</span>
      <kbd class="tip-key">Enter</kbd>
    </div>

    <div class="tip">
      <span class="tip-label">Browse objects</span>
      <span class="tip-keys">
        <CirclePlus class="tip-icon" />

        <span class="tip-sep hidden md:inline">/</span>

        <kbd class="tip-key hidden md:inline-flex">{mod} + O</kbd>
      </span>
    </div>

    <div class="tip md:hidden">
      <span class="tip-label">Connect</span>

      <div class="flex items-center justify-center">
        <span class="tip-desc mr-1">drag handle /</span>

        <Cable class="tip-icon" />
      </div>
    </div>

    <div class="tip">
      <span class="tip-label">Open sidebar</span>
      <span class="tip-keys">
        <PanelLeftOpen class="tip-icon" />
        <span class="tip-sep hidden md:inline">/</span>
        <kbd class="tip-key hidden md:inline-flex">{mod} + B</kbd>
      </span>
    </div>

    <div class="tip hidden sm:flex">
      <span class="tip-label">Command palette</span>
      <kbd class="tip-key">{mod} + K</kbd>
    </div>

    <div class="tip">
      <span class="tip-label">Run code</span>
      <span class="tip-keys">
        <Play class="tip-icon" />
        <span class="tip-sep hidden md:inline">/</span>
        <kbd class="tip-key hidden md:inline-flex">Shift + Enter</kbd>
      </span>
    </div>
  </div>
</div>

<style>
  .tips-root {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.015);
  }

  .tips-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 24px;
  }

  .tip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .tip-label {
    font-family: 'Syne', sans-serif;
    font-size: 0.75rem;
    color: #52525b;
    white-space: nowrap;
  }

  .tip-keys {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .tip-sep {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #27272a;
  }

  .tip-desc {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #3f3f46;
    letter-spacing: 0.03em;
  }

  :global(.tip-icon) {
    width: 12px;
    height: 12px;
    color: #3f3f46;
    flex-shrink: 0;
  }

  .tip-key {
    display: inline-flex;
    align-items: center;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.03em;
    color: #71717a;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 2px 7px;
    white-space: nowrap;
  }
</style>
