<script lang="ts">
  import { HelpCircle, X } from '@lucide/svelte/icons';
  import AboutTab from './AboutTab.svelte';
  import ExamplesTab from './ExamplesTab.svelte';
  import ThanksTab from './ThanksTab.svelte';
  import ShortcutsTab from './ShortcutsTab.svelte';
  import type { Tab } from './types';

  let {
    open = $bindable(false),
    onLoadPatch
  }: { open?: boolean; onLoadPatch?: (patchId: string) => Promise<void> } = $props();

  let activeTab = $state<Tab>('about');

  function handleClose() {
    open = false;
  }

  const tabs: Tab[] = ['about', 'demos', 'shortcuts', 'thanks'];
</script>

{#if open}
  <!-- Modal backdrop -->
  <div class="fixed inset-0 z-50 flex items-center justify-center font-mono" role="presentation">
    <!-- Backdrop overlay -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm"
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
      class="relative z-10 h-screen w-full overflow-hidden bg-zinc-950 sm:mx-4 sm:h-[85vh] sm:max-w-3xl sm:rounded-lg sm:border sm:border-zinc-700 sm:shadow-2xl md:mx-8 lg:mx-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
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
      <div class="relative border-b border-zinc-800 px-4 pt-10 sm:px-6 sm:pt-4">
        <div class="flex items-start gap-4">
          <nav class="flex flex-1 gap-4 overflow-x-auto sm:gap-6">
            {#each tabs as tab (tab)}
              <button
                onclick={() => (activeTab = tab)}
                class="flex-shrink-0 pb-3 text-sm font-medium transition-colors {activeTab === tab
                  ? 'border-b-2 border-orange-500 text-orange-500'
                  : 'text-zinc-400 hover:text-zinc-200'}"
              >
                {tab}
              </button>
            {/each}
          </nav>
          <!-- Close button -->
          <button
            onclick={handleClose}
            class="flex-shrink-0 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close modal"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Tab content -->
      <div class="tab-content flex overflow-y-auto p-4 sm:p-6">
        {#if activeTab === 'about'}
          <AboutTab setTab={(tab) => (activeTab = tab)} />
        {:else if activeTab === 'demos'}
          <ExamplesTab {onLoadPatch} />
        {:else if activeTab === 'thanks'}
          <ThanksTab setTab={(tab) => (activeTab = tab)} />
        {:else if activeTab === 'shortcuts'}
          <ShortcutsTab />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Custom scrollbar styling */
  :global(.overflow-y-auto::-webkit-scrollbar) {
    width: 8px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-track) {
    background: rgb(39 39 42); /* zinc-800 */
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb) {
    background: rgb(63 63 70); /* zinc-700 */
    border-radius: 4px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
    background: rgb(82 82 91); /* zinc-600 */
  }

  /* Tab content max-height */
  :global(.tab-content) {
    max-height: calc(100vh - 80px);
  }

  @media (min-width: 640px) {
    :global(.tab-content) {
      max-height: calc(85vh - 80px);
    }
  }
</style>
