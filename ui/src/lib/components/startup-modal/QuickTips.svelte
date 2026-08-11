<script lang="ts">
  import { Cable, CirclePlus, Command, PanelLeftOpen, Play, Search } from '@lucide/svelte/icons';

  let { isMac }: { isMac: boolean } = $props();

  const mod = $derived(isMac ? 'Cmd' : 'Ctrl');
</script>

<div class="quick-tips" aria-label="First moves">
  <p class="quick-tips-label">First moves</p>
  <div class="quick-tips-grid">
    <div class="quick-tip">
      <CirclePlus class="tip-icon" />
      <span class="tip-name">Add object</span>
      <kbd class="tip-key">Enter</kbd>
    </div>

    <div class="quick-tip">
      <Search class="tip-icon" />
      <span class="tip-name">Browse objects</span>
      <kbd class="tip-key">{mod} + O</kbd>
    </div>

    <div class="quick-tip">
      <Play class="tip-icon" />
      <span class="tip-name">Run code</span>
      <kbd class="tip-key">Shift + Enter</kbd>
    </div>

    <div class="quick-tip">
      <PanelLeftOpen class="tip-icon" />
      <span class="tip-name">Open sidebar</span>
      <kbd class="tip-key">{mod} + B</kbd>
    </div>

    <div class="quick-tip">
      <Command class="tip-icon" />
      <span class="tip-name">Command palette</span>
      <kbd class="tip-key">{mod} + K</kbd>
    </div>

    <div class="quick-tip">
      <Cable class="tip-icon" />
      <span class="tip-name">Connect</span>
      <span class="tip-key">Drag</span>
    </div>
  </div>
</div>

<style>
  .quick-tips {
    background: #0c0c0e;
  }

  .quick-tips-label {
    margin: 0;
    padding: 10px 20px 6px;
    color: #71717a;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.5625rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .quick-tips-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .quick-tip {
    display: grid;
    min-width: 0;
    min-height: 42px;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
  }

  .quick-tip:nth-child(n + 4) {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .quick-tip:not(:nth-child(3n + 1)) {
    border-left: 1px solid rgba(255, 255, 255, 0.07);
  }

  :global(.tip-icon) {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    color: #71717a;
  }

  .tip-name {
    overflow: hidden;
    color: #a1a1aa;
    font-size: 0.6875rem;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tip-key {
    display: inline-flex;
    align-items: center;
    justify-self: end;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 6px;
    color: #a1a1aa;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.5625rem;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    .quick-tips-grid {
      grid-template-columns: 1fr;
    }

    .quick-tips-label {
      padding-inline: 16px;
    }

    .quick-tip {
      min-height: 44px;
      padding: 8px 16px;
    }

    .quick-tip:nth-child(n + 2) {
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .quick-tip:not(:nth-child(3n + 1)) {
      border-left: 0;
    }
  }

  @media (min-width: 601px) and (max-height: 760px) {
    .quick-tips-label {
      padding-top: 7px;
      padding-bottom: 4px;
    }

    .quick-tip {
      min-height: 38px;
      padding-block: 6px;
    }
  }
</style>
