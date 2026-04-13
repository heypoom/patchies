<script lang="ts">
  import { CATEGORY_INFO, type SettingsCategory } from './types';
  import GeneralSettings from './categories/GeneralSettings.svelte';
  import EditorSettings from './categories/EditorSettings.svelte';
  import RenderingSettings from './categories/RenderingSettings.svelte';
  import AISettings from './categories/AISettings.svelte';
  import VisualSettings from './categories/VisualSettings.svelte';
  import TransportSettings from './categories/TransportSettings.svelte';
  import NetworkSettings from './categories/NetworkSettings.svelte';

  let {
    open = $bindable(false),
    initialCategory = 'general' as SettingsCategory
  }: {
    open?: boolean;
    initialCategory?: SettingsCategory;
  } = $props();

  let activeCategory = $state<SettingsCategory>(initialCategory);

  $effect(() => {
    if (open && initialCategory) {
      activeCategory = initialCategory;
    }
  });

  function handleClose() {
    open = false;
  }

  const perUserCategories = CATEGORY_INFO.filter((c) => c.scope === 'per-user');
  const perPatchCategories = CATEGORY_INFO.filter((c) => c.scope === 'per-patch');

  const activeCategoryLabel = $derived(
    CATEGORY_INFO.find((c) => c.id === activeCategory)?.label ?? ''
  );

  const activeCategoryScope = $derived(
    CATEGORY_INFO.find((c) => c.id === activeCategory)?.scope ?? 'per-user'
  );
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 animate-[ob-fade_0.2s_ease_both] bg-black/88 backdrop-blur-[12px]"
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
      class="relative z-10 m-0 flex h-dvh w-full max-w-[780px] animate-[ob-card-in_0.35s_cubic-bezier(0.22,0.61,0.36,1)_both] flex-col overflow-hidden rounded-[14px] border border-orange-500/18 bg-[#09090b] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_0_80px_rgba(249,115,22,0.06),0_40px_80px_rgba(0,0,0,0.8)] outline-none sm:m-4 sm:h-[85vh] sm:max-h-[720px] sm:flex-row"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          handleClose();
        }
      }}
    >
      <!-- Corner ornaments -->
      <span
        class="pointer-events-none absolute top-3 left-3 z-[2] h-4 w-4 border-t border-l border-orange-500 opacity-40"
        aria-hidden="true"
      ></span>
      <span
        class="pointer-events-none absolute top-3 right-3 z-[2] h-4 w-4 border-t border-r border-orange-500 opacity-40"
        aria-hidden="true"
      ></span>
      <span
        class="pointer-events-none absolute bottom-3 left-3 z-[2] h-4 w-4 border-b border-l border-orange-500 opacity-40"
        aria-hidden="true"
      ></span>
      <span
        class="pointer-events-none absolute right-3 bottom-3 z-[2] h-4 w-4 border-r border-b border-orange-500 opacity-40"
        aria-hidden="true"
      ></span>

      <!-- Radial glow -->
      <div
        class="pointer-events-none absolute -top-[60px] -right-[60px] -left-[60px] z-0 h-[240px] bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,rgba(249,115,22,0.07),transparent_70%)]"
        aria-hidden="true"
      ></div>

      <!-- Mobile: top tab bar -->
      <div class="relative z-[1] shrink-0 border-b border-white/5 sm:hidden">
        <div class="flex items-center justify-between px-4 pt-4 pb-0">
          <span
            id="settings-title"
            class="font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase"
          >
            settings
          </span>
          <button
            onclick={handleClose}
            class="shrink-0 cursor-pointer border-none bg-transparent p-1.5 font-mono text-[11px] leading-none text-zinc-500 transition-colors hover:text-zinc-300"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <nav class="flex gap-0 overflow-x-auto px-2 pt-2">
          {#each CATEGORY_INFO as cat (cat.id)}
            <button
              onclick={() => (activeCategory = cat.id)}
              class={[
                'relative cursor-pointer border-none bg-transparent px-3 py-2 font-mono text-[10px] tracking-[0.12em] whitespace-nowrap uppercase transition-colors',
                activeCategory === cat.id ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
              ]}
            >
              {cat.label}
              {#if activeCategory === cat.id}
                <span class="absolute right-2 bottom-0 left-2 h-px bg-orange-500 opacity-80"></span>
              {/if}
            </button>
          {/each}
        </nav>
      </div>

      <!-- Desktop: sidebar -->
      <div
        class="relative z-[1] hidden w-[180px] shrink-0 flex-col border-r border-white/5 pt-5 pb-4 sm:flex"
      >
        <span class="mb-4 px-5 font-mono text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
          settings
        </span>

        <!-- Per-User section -->
        <span class="mb-1 px-5 font-mono text-[9px] tracking-[0.2em] text-zinc-500 uppercase">
          Per-User
        </span>
        <nav class="flex flex-col gap-0.5 px-2">
          {#each perUserCategories as cat (cat.id)}
            <button
              onclick={() => (activeCategory = cat.id)}
              class={[
                'cursor-pointer rounded px-3 py-1.5 text-left font-mono text-[11px] tracking-wide transition-colors',
                activeCategory === cat.id
                  ? 'bg-white/8 text-orange-500'
                  : 'bg-transparent text-zinc-400 hover:bg-white/4 hover:text-zinc-200'
              ]}
            >
              {cat.label}
            </button>
          {/each}
        </nav>

        <!-- Divider -->
        <div class="mx-4 my-3 border-t border-white/5"></div>

        <!-- Per-Patch section -->
        <span class="mb-1 px-5 font-mono text-[9px] tracking-[0.2em] text-zinc-500 uppercase">
          Per-Patch
        </span>
        <nav class="flex flex-col gap-0.5 px-2">
          {#each perPatchCategories as cat (cat.id)}
            <button
              onclick={() => (activeCategory = cat.id)}
              class={[
                'cursor-pointer rounded px-3 py-1.5 text-left font-mono text-[11px] tracking-wide transition-colors',
                activeCategory === cat.id
                  ? 'bg-white/8 text-orange-500'
                  : 'bg-transparent text-zinc-400 hover:bg-white/4 hover:text-zinc-200'
              ]}
            >
              {cat.label}
            </button>
          {/each}
        </nav>
      </div>

      <!-- Content pane -->
      <div class="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Header (desktop only — mobile has it in the tab bar) -->
        <div
          class="hidden shrink-0 items-center justify-between border-b border-white/5 px-6 py-4 sm:flex"
        >
          <h2 class="font-['Syne',sans-serif] text-sm font-medium text-zinc-200">
            {activeCategoryLabel}
          </h2>
          <button
            onclick={handleClose}
            class="shrink-0 cursor-pointer border-none bg-transparent p-1.5 font-mono text-[11px] leading-none text-zinc-500 transition-colors hover:text-zinc-300"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <!-- Mobile: category title + scope badge -->
        <div class="flex items-center gap-2 px-5 pt-4 pb-1 sm:hidden">
          <h2 class="font-['Syne',sans-serif] text-sm font-medium text-zinc-200">
            {activeCategoryLabel}
          </h2>
          <span
            class="rounded border border-white/8 px-1.5 py-0.5 font-mono text-[8px] tracking-[0.15em] text-zinc-500 uppercase"
          >
            {activeCategoryScope === 'per-patch' ? 'patch' : 'user'}
          </span>
        </div>

        <!-- Settings content -->
        <div
          class="settings-scroll flex-1 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          {#if activeCategory === 'general'}
            <GeneralSettings />
          {:else if activeCategory === 'editor'}
            <EditorSettings />
          {:else if activeCategory === 'rendering'}
            <RenderingSettings />
          {:else if activeCategory === 'ai'}
            <AISettings />
          {:else if activeCategory === 'visual'}
            <VisualSettings />
          {:else if activeCategory === 'transport'}
            <TransportSettings />
          {:else if activeCategory === 'network'}
            <NetworkSettings />
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .settings-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .settings-scroll::-webkit-scrollbar-thumb {
    background: #27272a;
    border-radius: 3px;
  }
  .settings-scroll::-webkit-scrollbar-thumb:hover {
    background: #3f3f46;
  }
</style>
