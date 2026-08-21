<script lang="ts">
  import {
    Bot,
    Bug,
    Check,
    Code2,
    Image,
    MonitorUp,
    Network,
    Radio,
    Settings2,
    SlidersHorizontal,
    Timer,
    X
  } from '@lucide/svelte/icons';
  import { CATEGORY_INFO, type SettingsCategory } from './types';
  import GeneralSettings from './categories/GeneralSettings.svelte';
  import EditorSettings from './categories/EditorSettings.svelte';
  import RenderingSettings from './categories/RenderingSettings.svelte';
  import DebugSettings from './categories/DebugSettings.svelte';
  import AISettings from './categories/AISettings.svelte';
  import VisualSettings from './categories/VisualSettings.svelte';
  import TransportSettings from './categories/TransportSettings.svelte';
  import NetworkSettings from './categories/NetworkSettings.svelte';
  import RemoteControlSettings from './categories/RemoteControlSettings.svelte';

  let {
    open = $bindable(false),
    initialCategory = 'general' as SettingsCategory,
    remoteControlEnabled = false,
    remoteControlMountCommand = null,
    onEnableRemoteControl,
    onDisableRemoteControl
  }: {
    open?: boolean;
    initialCategory?: SettingsCategory;
    remoteControlEnabled?: boolean;
    remoteControlMountCommand?: string | null;
    onEnableRemoteControl?: () => Promise<void>;
    onDisableRemoteControl?: () => void;
  } = $props();

  const CATEGORY_ICONS = {
    general: SlidersHorizontal,
    editor: Code2,
    rendering: MonitorUp,
    ai: Bot,
    debug: Bug,
    visual: Image,
    transport: Timer,
    network: Network,
    'remote-control': Radio
  };

  function getInitialCategory() {
    return initialCategory;
  }

  let activeCategory = $state<SettingsCategory>(getInitialCategory());
  let dialogElement = $state<HTMLDivElement>();
  let previouslyFocusedElement: HTMLElement | null = null;

  $effect(() => {
    if (open && initialCategory) activeCategory = initialCategory;
  });

  $effect(() => {
    if (!open) return;

    previouslyFocusedElement = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => dialogElement?.focus());

    return () => {
      cancelAnimationFrame(frame);
      requestAnimationFrame(() => previouslyFocusedElement?.focus());
    };
  });

  const perUserCategories = CATEGORY_INFO.filter((category) => category.scope === 'per-user');
  const perPatchCategories = CATEGORY_INFO.filter((category) => category.scope === 'per-patch');
  const activeCategoryInfo = $derived(
    CATEGORY_INFO.find((category) => category.id === activeCategory) ?? CATEGORY_INFO[0]
  );
  const ActiveCategoryIcon = $derived(CATEGORY_ICONS[activeCategory]);

  function handleClose() {
    open = false;
  }

  function handleCategoryChange(event: Event) {
    activeCategory = (event.currentTarget as HTMLSelectElement).value as SettingsCategory;
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') handleClose();
  }

  function trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !dialogElement) return;

    const focusable = Array.from(
      dialogElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.getClientRects().length > 0);

    if (focusable.length === 0) {
      event.preventDefault();
      dialogElement.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (current === dialogElement || !focusable.includes(current as HTMLElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
  <div
    class="pt-safe pr-safe pb-safe pl-safe fixed inset-0 z-50 flex items-center justify-center"
    role="presentation"
  >
    <div
      class="fixed inset-0 animate-[ob-fade_0.18s_ease_both] bg-black/80"
      onclick={handleClose}
      aria-hidden="true"
    ></div>

    <div
      bind:this={dialogElement}
      class="relative z-10 m-0 flex h-full w-full max-w-[900px] animate-[ob-card-in_0.2s_cubic-bezier(0.22,0.61,0.36,1)_both] flex-col overflow-hidden rounded-none border border-white/12 bg-[#101012] shadow-[0_24px_80px_rgba(0,0,0,0.58)] outline-none sm:m-4 sm:h-[86dvh] sm:max-h-[760px] sm:rounded-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabindex="-1"
      onkeydown={trapFocus}
    >
      <header
        class="flex min-h-[72px] shrink-0 items-center gap-3 border-b border-white/7 px-4 py-3 sm:px-6"
      >
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/[0.025] text-zinc-400"
        >
          <Settings2 class="h-4 w-4" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 id="settings-title" class="text-[17px] leading-tight font-medium text-zinc-100">
            Settings
          </h2>
          <p class="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Check class="h-3 w-3 text-zinc-600" />
            Changes save automatically
          </p>
        </div>
        <button
          type="button"
          onclick={handleClose}
          class="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent text-zinc-500 transition-colors outline-none hover:border-white/8 hover:bg-white/[0.035] hover:text-zinc-200 focus-visible:border-orange-500/70 sm:h-9 sm:w-9"
          aria-label="Close settings"
        >
          <X class="h-4 w-4" />
        </button>
      </header>

      <div class="flex min-h-0 flex-1">
        <aside
          class="hidden w-[220px] shrink-0 flex-col border-r border-white/7 bg-black/10 px-3 py-4 sm:flex"
          aria-label="Settings categories"
        >
          <p class="mb-2 px-2 font-mono text-[9px] tracking-[0.18em] text-zinc-600 uppercase">
            Your workspace
          </p>
          <nav class="flex flex-col gap-1">
            {#each perUserCategories as category (category.id)}
              {@const Icon = CATEGORY_ICONS[category.id]}
              <button
                type="button"
                onclick={() => (activeCategory = category.id)}
                aria-current={activeCategory === category.id ? 'page' : undefined}
                class={[
                  'relative flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-left text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-orange-500/25',
                  activeCategory === category.id
                    ? 'bg-white/[0.065] text-zinc-100'
                    : 'bg-transparent text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200'
                ]}
              >
                {#if activeCategory === category.id}
                  <span class="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-orange-500"
                  ></span>
                {/if}
                <Icon
                  class={[
                    'h-4 w-4',
                    activeCategory === category.id ? 'text-orange-500' : 'text-zinc-600'
                  ]}
                />
                {category.label}
              </button>
            {/each}
          </nav>

          <div class="mx-2 my-4 border-t border-white/7"></div>
          <p class="mb-2 px-2 font-mono text-[9px] tracking-[0.18em] text-zinc-600 uppercase">
            This patch
          </p>
          <nav class="flex flex-col gap-1">
            {#each perPatchCategories as category (category.id)}
              {@const Icon = CATEGORY_ICONS[category.id]}
              <button
                type="button"
                onclick={() => (activeCategory = category.id)}
                aria-current={activeCategory === category.id ? 'page' : undefined}
                class={[
                  'relative flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-left text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-orange-500/25',
                  activeCategory === category.id
                    ? 'bg-white/[0.065] text-zinc-100'
                    : 'bg-transparent text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200'
                ]}
              >
                {#if activeCategory === category.id}
                  <span class="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-orange-500"
                  ></span>
                {/if}
                <Icon
                  class={[
                    'h-4 w-4',
                    activeCategory === category.id ? 'text-orange-500' : 'text-zinc-600'
                  ]}
                />
                {category.label}
              </button>
            {/each}
          </nav>
        </aside>

        <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div class="shrink-0 border-b border-white/7 px-4 py-4 sm:px-6 sm:py-5">
            <div class="mb-4 sm:hidden">
              <label
                for="settings-category"
                class="mb-1.5 block font-mono text-[9px] tracking-[0.16em] text-zinc-600 uppercase"
              >
                Category
              </label>
              <select
                id="settings-category"
                value={activeCategory}
                onchange={handleCategoryChange}
                class="h-11 w-full rounded-md border border-white/10 bg-white/[0.035] px-3 text-[13px] font-medium text-zinc-100 outline-none focus-visible:border-orange-500/60 focus-visible:ring-2 focus-visible:ring-orange-500/15"
              >
                <optgroup label="Your workspace">
                  {#each perUserCategories as category (category.id)}
                    <option value={category.id}>{category.label}</option>
                  {/each}
                </optgroup>
                <optgroup label="This patch">
                  {#each perPatchCategories as category (category.id)}
                    <option value={category.id}>{category.label}</option>
                  {/each}
                </optgroup>
              </select>
            </div>

            <div class="flex items-start gap-3">
              <div
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/[0.025] text-orange-500"
              >
                <ActiveCategoryIcon class="h-4 w-4" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-[15px] leading-6 font-medium text-zinc-100">
                    {activeCategoryInfo.label}
                  </h3>
                  <span
                    class="rounded-full border border-white/8 px-2 py-0.5 font-mono text-[8px] tracking-[0.12em] text-zinc-500 uppercase"
                  >
                    {activeCategoryInfo.scope === 'per-patch' ? 'This patch' : 'Your workspace'}
                  </span>
                </div>
                <p class="mt-0.5 text-[11px] leading-4 text-zinc-500">
                  {activeCategoryInfo.description}
                </p>
              </div>
            </div>
          </div>

          <div class="settings-scroll flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <section
              class="settings-panel mx-auto max-w-[660px] overflow-hidden rounded-lg border border-white/8 bg-white/[0.018]"
              aria-label={`${activeCategoryInfo.label} settings`}
            >
              {#if activeCategory === 'general'}
                <GeneralSettings />
              {:else if activeCategory === 'editor'}
                <EditorSettings />
              {:else if activeCategory === 'rendering'}
                <RenderingSettings />
              {:else if activeCategory === 'debug'}
                <DebugSettings />
              {:else if activeCategory === 'ai'}
                <AISettings />
              {:else if activeCategory === 'visual'}
                <VisualSettings />
              {:else if activeCategory === 'transport'}
                <TransportSettings />
              {:else if activeCategory === 'network'}
                <NetworkSettings />
              {:else if activeCategory === 'remote-control'}
                <RemoteControlSettings
                  enabled={remoteControlEnabled}
                  mountCommand={remoteControlMountCommand}
                  onEnable={onEnableRemoteControl ?? (async () => {})}
                  onDisable={onDisableRemoteControl ?? (() => {})}
                />
              {/if}
            </section>
          </div>
        </main>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-scroll {
    scrollbar-width: thin;
    scrollbar-color: #3f3f46 transparent;
  }

  .settings-scroll::-webkit-scrollbar {
    width: 6px;
  }

  .settings-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .settings-scroll::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: #3f3f46;
  }

  :global(.settings-panel input[type='text']),
  :global(.settings-panel input[type='password']),
  :global(.settings-panel input[type='number']) {
    max-width: min(15rem, 42vw);
  }

  @media (max-width: 520px) {
    :global(.settings-panel input[type='text']),
    :global(.settings-panel input[type='password']),
    :global(.settings-panel input[type='number']) {
      max-width: 38vw;
    }
  }

  @media (max-width: 360px) {
    :global(.settings-panel .setting-row) {
      flex-direction: column;
    }

    :global(.settings-panel .setting-row > :last-child) {
      width: 100%;
    }

    :global(.settings-panel input[type='text']),
    :global(.settings-panel input[type='password']),
    :global(.settings-panel input[type='number']),
    :global(.settings-panel select) {
      width: 100%;
      max-width: none;
    }

    :global(.settings-panel input[type='range']) {
      flex: 1;
      width: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.animate-\[ob-card-in_0\.2s_cubic-bezier\(0\.22\,0\.61\,0\.36\,1\)_both\]),
    :global(.animate-\[ob-fade_0\.18s_ease_both\]) {
      animation: none;
    }
  }
</style>
