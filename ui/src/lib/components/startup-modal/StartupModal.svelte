<script lang="ts">
  import AboutTab from './AboutTab.svelte';
  import AboutFooter from './AboutFooter.svelte';
  import ExamplesTab from './ExamplesTab.svelte';
  import ThanksTab from './thanks/ThanksTab.svelte';
  import ShortcutsTab from './ShortcutsTab.svelte';
  import SparksTab from './SparksTab.svelte';
  import type { Tab } from './types';
  import { X } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';
  import { isAiFeaturesVisible, isObjectBrowserOpen } from '../../../stores/ui.store';
  import { sparksMoodTheme, DEFAULT_THEME } from '../../../stores/sparks.store';

  let {
    open = $bindable(false),
    initialTab = 'about' as Tab,
    onLoadPatch
  }: {
    open?: boolean;
    initialTab?: Tab;
    onLoadPatch?: (slug: string) => Promise<void>;
  } = $props();

  function getInitialTab() {
    return initialTab;
  }

  let activeTab = $state<Tab>(getInitialTab());
  let modalBody = $state<HTMLDivElement>();
  let isTouchFirst = $state(false);
  let openedTab = $state<Tab | undefined>();

  onMount(() => {
    const touchFirstQuery = window.matchMedia('(pointer: coarse)');
    const updateTouchFirst = () => {
      isTouchFirst = touchFirstQuery.matches;
    };

    updateTouchFirst();
    touchFirstQuery.addEventListener('change', updateTouchFirst);

    return () => touchFirstQuery.removeEventListener('change', updateTouchFirst);
  });

  $effect(() => {
    if (!open) {
      openedTab = undefined;
      return;
    }

    if (initialTab && openedTab !== initialTab) {
      activeTab = isTouchFirst && initialTab === 'shortcuts' ? 'about' : initialTab;
      openedTab = initialTab;
    }
  });

  $effect(() => {
    if (isTouchFirst && activeTab === 'shortcuts') {
      activeTab = 'about';
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

  function selectTab(tab: Tab) {
    activeTab = tab;
    if (modalBody) modalBody.scrollTop = 0;
  }

  const tabs = $derived<Tab[]>(
    ($isAiFeaturesVisible
      ? ['about', 'demos', 'sparks', 'shortcuts', 'thanks']
      : ['about', 'demos', 'shortcuts', 'thanks']
    ).filter((tab) => !isTouchFirst || tab !== 'shortcuts') as Tab[]
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
      class:modal-card--sparks={activeTab === 'sparks'}
      class:modal-card--shortcuts={activeTab === 'shortcuts'}
      class:modal-card--thanks={activeTab === 'thanks'}
      role="dialog"
      aria-modal="true"
      aria-label="Patchies"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          handleClose();
        }
      }}
    >
      <!-- Tab navigation -->
      <div class="modal-tabbar">
        <nav class="modal-tabs">
          {#each tabs as tab (tab)}
            <button
              onclick={() => selectTab(tab)}
              class="modal-tab"
              class:modal-tab--active={activeTab === tab}
            >
              {tab}
            </button>
          {/each}
        </nav>
        <button onclick={handleClose} class="modal-close" aria-label="Close modal">
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Tab content -->
      <div
        class="modal-body"
        class:modal-body--sparks={activeTab === 'sparks'}
        bind:this={modalBody}
      >
        {#if activeTab === 'about'}
          <AboutTab
            setTab={selectTab}
            {isTouchFirst}
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
          <SparksTab closeModal={handleClose} />
        {:else if activeTab === 'thanks'}
          <ThanksTab />
        {:else if activeTab === 'shortcuts'}
          <ShortcutsTab />
        {/if}
      </div>

      {#if activeTab === 'about'}
        <AboutFooter />
      {/if}
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
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
      env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
    font-family: 'IBM Plex Sans', sans-serif;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(2px);
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
    background: #111113;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.58);
    border-radius: 12px;
    width: 100%;
    max-width: 680px;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: card-in 0.35s cubic-bezier(0.22, 0.61, 0.36, 1) both;
    transition: max-width 0.48s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @media (min-width: 640px) {
    .modal-card {
      height: 85dvh;
      max-height: 720px;
      margin: 16px;
    }
  }

  @media (min-width: 900px) {
    .modal-card--sparks {
      max-width: 1120px;
    }

    .modal-card--thanks {
      max-width: 960px;
    }

    .modal-card--shortcuts {
      max-width: 920px;
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

  /* Tab bar */
  .modal-tabbar {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  .modal-tabs {
    display: flex;
    min-width: 0;
    gap: 2px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .modal-tab {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #a1a1aa;
    background: none;
    border: none;
    padding: 6px 12px 10px;
    cursor: pointer;
    transition: color 0.15s;
    white-space: nowrap;
    position: relative;
  }

  @media (pointer: fine) {
    .modal-tab:not(.modal-tab--active):hover {
      color: #e4e4e7;
    }
  }

  .modal-tab--active {
    color: #fb923c;
  }

  .modal-tab--active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 8px;
    right: 8px;
    height: 1px;
    background: #fb923c;
  }

  /* Close button */
  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a1a1aa;
    background: none;
    border: none;
    padding: 8px;
    cursor: pointer;
    transition: color 0.15s;
    line-height: 1;
    flex-shrink: 0;
    border-radius: 6px;
    margin: -2px 0 2px;
  }

  .modal-close:hover {
    color: #f4f4f5;
    background: rgba(255, 255, 255, 0.08);
  }

  /* Content area */
  .modal-body {
    position: relative;
    z-index: 1;
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .modal-body--sparks {
    overflow: hidden;
  }

  @media (min-width: 640px) {
    .modal-tabbar {
      padding: 10px 28px 0;
    }
  }

  @media (max-width: 639px) {
    .modal-tabbar {
      padding: 8px 10px 0;
    }

    .modal-tabs {
      gap: 0;
    }

    .modal-tab {
      padding: 8px 7px 11px;
      font-size: 9px;
      letter-spacing: 0.11em;
    }

    .modal-close {
      padding: 7px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-card {
      animation: none;
      transition: none;
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
