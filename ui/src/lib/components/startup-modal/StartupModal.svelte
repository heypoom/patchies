<script lang="ts">
  import AboutTab from './AboutTab.svelte';
  import ExamplesTab from './ExamplesTab.svelte';
  import ThanksTab from './ThanksTab.svelte';
  import ShortcutsTab from './ShortcutsTab.svelte';
  import SparksTab from './SparksTab.svelte';
  import type { Tab } from './types';
  import { isAiFeaturesVisible, isObjectBrowserOpen } from '../../../stores/ui.store';
  import { sparksMoodTheme, DEFAULT_THEME } from '../../../stores/sparks.store';

  let {
    open = $bindable(false),
    initialTab = 'about' as Tab,
    onLoadPatch
  }: {
    open?: boolean;
    initialTab?: Tab;
    onLoadPatch?: (patchId: string) => Promise<void>;
  } = $props();

  let activeTab = $state<Tab>(initialTab);

  $effect(() => {
    if (open && initialTab) {
      activeTab = initialTab;
    }
  });

  $effect(() => {
    if (activeTab !== 'sparks') {
      sparksMoodTheme.set(DEFAULT_THEME);
    }
  });

  function handleClose() {
    open = false;
  }

  const tabs = $derived<Tab[]>(
    $isAiFeaturesVisible
      ? ['about', 'demos', 'sparks', 'shortcuts', 'thanks']
      : ['about', 'demos', 'shortcuts', 'thanks']
  );
</script>

{#if open}
  <div class="modal-root" role="presentation">
    <!-- Backdrop -->
    <div
      class="modal-backdrop"
      role="button"
      tabindex="-1"
      onclick={handleClose}
      onkeydown={(e) => {
        if (e.key === 'Escape') handleClose();
      }}
      aria-label="Close modal"
    ></div>

    <!-- Modal container -->
    <div
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
      style:--modal-accent={$sparksMoodTheme.accentColor}
      style:--modal-glow={$sparksMoodTheme.glowColor}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          handleClose();
        }
      }}
    >
      <!-- Corner ornaments -->
      <span class="mc mc-tl" aria-hidden="true"></span>
      <span class="mc mc-tr" aria-hidden="true"></span>
      <span class="mc mc-bl" aria-hidden="true"></span>
      <span class="mc mc-br" aria-hidden="true"></span>

      <!-- Radial glow -->
      <div class="modal-glow" aria-hidden="true"></div>

      <!-- Tab navigation -->
      <div class="modal-tabbar">
        <nav class="modal-tabs">
          {#each tabs as tab (tab)}
            <button
              onclick={() => (activeTab = tab)}
              class="modal-tab"
              class:modal-tab--active={activeTab === tab}
            >
              {tab}
            </button>
          {/each}
        </nav>
        <button onclick={handleClose} class="modal-close" aria-label="Close modal">✕</button>
      </div>

      <!-- Tab content -->
      <div class="modal-body">
        {#if activeTab === 'about'}
          <AboutTab
            setTab={(tab) => (activeTab = tab)}
            onOpenObjectBrowser={() => {
              open = false;

              setTimeout(() => {
                isObjectBrowserOpen.set(true);
              }, 50);
            }}
          />
        {:else if activeTab === 'demos'}
          <ExamplesTab {onLoadPatch} />
        {:else if activeTab === 'sparks' && $isAiFeaturesVisible}
          <SparksTab />
        {:else if activeTab === 'thanks'}
          <ThanksTab />
        {:else if activeTab === 'shortcuts'}
          <ShortcutsTab />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-root {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-family: 'Syne', sans-serif;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(12px);
    animation: fade-in 0.2s ease both;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-card {
    position: relative;
    z-index: 10;
    outline: none;
    background: #09090b;
    border: 1px solid color-mix(in srgb, var(--modal-accent, #f97316) 18%, transparent);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.03),
      0 0 80px var(--modal-glow, rgba(249, 115, 22, 0.06)),
      0 40px 80px rgba(0, 0, 0, 0.8);
    border-radius: 14px;
    width: 100%;
    max-width: 680px;
    height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: card-in 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both;
    transition:
      border-color 0.6s ease,
      box-shadow 0.6s ease;
  }

  @media (min-width: 640px) {
    .modal-card {
      height: 85vh;
      max-height: 720px;
      margin: 16px;
    }
  }

  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Corner ornaments */
  .mc {
    position: absolute;
    width: 16px;
    height: 16px;
    opacity: 0.4;
    pointer-events: none;
    z-index: 2;
  }
  .mc-tl {
    top: 12px;
    left: 12px;
    border-top: 1px solid var(--modal-accent, #f97316);
    border-left: 1px solid var(--modal-accent, #f97316);
    transition: border-color 0.6s ease;
  }
  .mc-tr {
    top: 12px;
    right: 12px;
    border-top: 1px solid var(--modal-accent, #f97316);
    border-right: 1px solid var(--modal-accent, #f97316);
    transition: border-color 0.6s ease;
  }
  .mc-bl {
    bottom: 12px;
    left: 12px;
    border-bottom: 1px solid var(--modal-accent, #f97316);
    border-left: 1px solid var(--modal-accent, #f97316);
    transition: border-color 0.6s ease;
  }
  .mc-br {
    bottom: 12px;
    right: 12px;
    border-bottom: 1px solid var(--modal-accent, #f97316);
    border-right: 1px solid var(--modal-accent, #f97316);
    transition: border-color 0.6s ease;
  }

  /* Top radial glow */
  .modal-glow {
    position: absolute;
    top: -60px;
    left: -60px;
    right: -60px;
    height: 280px;
    background: radial-gradient(
      ellipse 70% 60% at 50% 35%,
      var(--modal-glow, rgba(249, 115, 22, 0.07)),
      transparent 70%
    );
    pointer-events: none;
    z-index: 0;
    transition: background 0.6s ease;
  }

  /* Tab bar */
  .modal-tabbar {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  .modal-tabs {
    display: flex;
    gap: 2px;
    overflow-x: auto;
  }

  .modal-tab {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #3f3f46;
    background: none;
    border: none;
    padding: 8px 12px 12px;
    cursor: pointer;
    transition: color 0.15s;
    white-space: nowrap;
    position: relative;
  }

  .modal-tab:hover {
    color: #71717a;
  }

  .modal-tab--active {
    color: var(--modal-accent, #f97316);
    transition: color 0.6s ease;
  }

  .modal-tab--active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 8px;
    right: 8px;
    height: 1px;
    background: var(--modal-accent, #f97316);
    opacity: 0.8;
    transition: background 0.6s ease;
  }

  /* Close button */
  .modal-close {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #3f3f46;
    background: none;
    border: none;
    padding: 6px 8px;
    cursor: pointer;
    transition: color 0.15s;
    line-height: 1;
    flex-shrink: 0;
    margin-bottom: 8px;
  }

  .modal-close:hover {
    color: #71717a;
  }

  /* Content area */
  .modal-body {
    position: relative;
    z-index: 1;
    flex: 1;
    overflow-y: auto;
    padding: 24px 24px max(20px, env(safe-area-inset-bottom));
  }

  @media (min-width: 640px) {
    .modal-tabbar {
      padding: 18px 28px 0;
    }
    .modal-body {
      padding: 28px 28px max(24px, env(safe-area-inset-bottom));
    }
  }

  /* Scrollbar */
  .modal-body::-webkit-scrollbar {
    width: 6px;
  }
  .modal-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .modal-body::-webkit-scrollbar-thumb {
    background: #27272a;
    border-radius: 3px;
  }
  .modal-body::-webkit-scrollbar-thumb:hover {
    background: #3f3f46;
  }
</style>
