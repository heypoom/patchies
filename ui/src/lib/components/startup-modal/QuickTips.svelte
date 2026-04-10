<script lang="ts">
  import { Cable, CirclePlus, PanelLeftOpen, Play } from '@lucide/svelte/icons';

  let { isMac }: { isMac: boolean } = $props();

  const mod = $derived(isMac ? 'Cmd' : 'Ctrl');
  let expanded = $state(false);
</script>

<div class="tips-root">
  <div class="tips-grid">
    <div class="tip">
      <span class="tip-label">Add object</span>
      <kbd class="tip-key">Enter</kbd>
    </div>

    <div class="tip">
      <span class="tip-label">Browse objects</span>
      <span class="tip-keys">
        <CirclePlus class="tip-icon" />
        <span class="tip-sep">/</span>
        <kbd class="tip-key">{mod} + O</kbd>
      </span>
    </div>

    <div class="tip">
      <span class="tip-label">Open sidebar</span>
      <span class="tip-keys">
        <PanelLeftOpen class="tip-icon" />
        <span class="tip-sep">/</span>
        <kbd class="tip-key">{mod} + B</kbd>
      </span>
    </div>

    <div class="tip tip--collapse" class:tip--hidden={!expanded}>
      <span class="tip-label">Command palette</span>
      <kbd class="tip-key">{mod} + K</kbd>
    </div>

    <div class="tip tip--collapse" class:tip--hidden={!expanded}>
      <span class="tip-label">Run code</span>
      <span class="tip-keys">
        <Play class="tip-icon" />
        <span class="tip-sep">/</span>
        <kbd class="tip-key">Shift + Enter</kbd>
      </span>
    </div>

    <div class="tip tip--collapse" class:tip--hidden={!expanded}>
      <span class="tip-label">Connect</span>
      <span class="tip-keys">
        <span class="tip-desc">drag handle</span>
        <span class="tip-sep">/</span>
        <Cable class="tip-icon" />
      </span>
    </div>
  </div>

  <button class="tips-more" onclick={() => (expanded = !expanded)}>
    {expanded ? '↑ less' : '+ more shortcuts'}
  </button>
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

  /* On mobile: single column, hide last 3, show toggle */
  @media (max-width: 460px) {
    .tips-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .tip--collapse {
      display: none;
    }

    .tip--collapse.tip--hidden {
      display: none;
    }

    .tip--collapse:not(.tip--hidden) {
      display: flex;
    }

    .tips-more {
      display: block;
    }
  }

  /* On desktop: always show all */
  @media (min-width: 461px) {
    .tip--collapse {
      display: flex !important;
    }
  }

  .tips-more {
    display: block;
    width: 100%;
    margin-top: 10px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    color: #3f3f46;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: center;
  }

  @media (min-width: 461px) {
    .tips-more {
      display: none;
    }
  }

  .tip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  .tip-label {
    font-family: 'Syne', sans-serif;
    font-size: 0.75rem;
    color: #52525b;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tip-keys {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
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
    white-space: nowrap;
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
