<script lang="ts">
  import {
    Code,
    Ellipsis,
    Expand,
    Settings,
    Terminal,
    Volume2,
    VolumeX,
    X
  } from '@lucide/svelte/icons';
  import { onMount } from 'svelte';
  import { Portal } from 'bits-ui';
  import { isExpandedDismissKey } from '$lib/keyboard/dismiss';
  import { useSvelteFlow } from '@xyflow/svelte';
  import * as Popover from '$lib/components/ui/popover';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { useNodeDataTracker } from '$lib/history';
  import {
    editorFontFamily,
    editorFontSize,
    editorFullscreenFontSize
  } from '../../stores/editor.store';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import StrudelStylesDialog from './StrudelStylesDialog.svelte';
  import { resolveStrudelFontSizes, type StrudelNodeData } from './strudel-settings';

  let {
    nodeId,
    data,
    expanded = false,
    onExpand,
    onLayoutChange,
    sidePanelTarget,
    onCompactSettings
  }: {
    nodeId: string;
    data: StrudelNodeData;
    expanded?: boolean;
    onExpand: () => void;
    onLayoutChange: (collapsed: boolean) => void;
    sidePanelTarget?: HTMLElement;
    onCompactSettings: () => void;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const initialNodeId = () => nodeId;
  const tracker = useNodeDataTracker(initialNodeId());
  const fontSizeTracker = tracker.track('fontSize', () => data.fontSize);
  const expandedFontSizeTracker = tracker.track('expandedFontSize', () => data.expandedFontSize);
  const activeFontSizeTracker = $derived(expanded ? expandedFontSizeTracker : fontSizeTracker);
  const fontSizeKey = $derived(expanded ? 'expandedFontSize' : 'fontSize');
  const fontSizeLabel = $derived(expanded ? 'Expanded font size' : 'Font size');
  const fontSizes = $derived(
    resolveStrudelFontSizes(data, $editorFontSize, $editorFullscreenFontSize)
  );
  const fontFamilyTracker = tracker.track('fontFamily', () => data.fontFamily);

  let settingsOpen = $state(false);
  let menuOpen = $state(false);
  let stylesOpen = $state(false);
  let floatingSettingsAnchor = $state<HTMLElement>();
  let settingsSource = $state<'overflow' | 'editor'>('editor');

  const actionButtonClass = $derived(
    expanded
      ? 'cursor-pointer rounded bg-black/35 p-2 text-zinc-300 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100'
      : 'cursor-pointer rounded p-1 text-zinc-300 hover:bg-zinc-700'
  );

  const compact = $derived(!!data.editorCollapsed && !expanded);
  const compactOverflowSettings = $derived(compact && settingsSource === 'overflow');
  const settingsAnchor = $derived.by(() => {
    if (!compact) return undefined;
    if (settingsSource === 'overflow') return sidePanelTarget;

    return floatingSettingsAnchor;
  });

  onMount(() => {
    if (expanded) openSettings(true);
  });

  $effect(() => {
    if (compact || !settingsOpen) return;

    const dismissSettings = (event: KeyboardEvent) => {
      if (!isExpandedDismissKey(event) || menuOpen || stylesOpen) return;

      event.preventDefault();
      event.stopPropagation();
      openSettings(false);
    };

    window.addEventListener('keydown', dismissSettings, { capture: true });

    return () => window.removeEventListener('keydown', dismissSettings, { capture: true });
  });

  function change<K extends keyof StrudelNodeData>(key: K, value: StrudelNodeData[K]) {
    const oldValue = data[key];

    updateNodeData(nodeId, { [key]: value });
    tracker.commit(key, oldValue, value);
  }

  function openSettings(open: boolean) {
    settingsOpen = open;

    if (open) {
      updateNodeData(nodeId, { showConsole: false });
    }
  }

  export function toggleSettings(anchor: HTMLElement) {
    const closeCurrentPanel =
      settingsOpen && settingsSource === 'editor' && floatingSettingsAnchor === anchor;

    floatingSettingsAnchor = anchor;
    settingsSource = 'editor';
    menuOpen = false;
    openSettings(!closeCurrentPanel);
  }

  export const hideSettings = () => openSettings(false);

  function showCompactSettings() {
    settingsSource = 'overflow';
    menuOpen = false;
    onCompactSettings();
    openSettings(true);
  }

  function toggleConsole() {
    settingsOpen = false;
    menuOpen = false;
    updateNodeData(nodeId, { showConsole: !data.showConsole });
  }

  // VirtualConsole can also open itself when a runtime error arrives.
  $effect(() => {
    if (data.showConsole) {
      settingsOpen = false;
    }
  });
</script>

{#snippet settingsFields()}
  <button
    role="checkbox"
    aria-checked={data.syncTransport ?? false}
    class="flex cursor-pointer items-center gap-1.5 transition-colors"
    onclick={() => change('syncTransport', !data.syncTransport)}
  >
    <span
      class={[
        'h-3 w-3 shrink-0 rounded-sm border transition-colors',
        data.syncTransport ? 'border-zinc-500 bg-zinc-500' : 'border-zinc-600'
      ]}
    ></span>
    <span class={['text-xs', data.syncTransport ? 'text-zinc-400' : 'text-zinc-500']}
      >Sync to transport</span
    >
  </button>
  {#if !compact}
    <button
      role="checkbox"
      aria-checked={data.editorResizingEnabled ?? true}
      class="flex cursor-pointer items-center gap-1.5 transition-colors"
      onclick={() => change('editorResizingEnabled', !(data.editorResizingEnabled ?? true))}
    >
      <span
        class={[
          'h-3 w-3 shrink-0 rounded-sm border transition-colors',
          (data.editorResizingEnabled ?? true) ? 'border-zinc-500 bg-zinc-500' : 'border-zinc-600'
        ]}
      ></span>
      <span
        class={[
          'text-xs',
          (data.editorResizingEnabled ?? true) ? 'text-zinc-400' : 'text-zinc-500'
        ]}>Resizing</span
      >
    </button>
  {/if}
  <label class="block">
    <span class="mb-1 block text-xs font-medium text-zinc-300">{fontSizeLabel}</span>
    <input
      type="number"
      min={expanded ? fontSizes.normal + 1 : 1}
      aria-label={fontSizeLabel}
      class="nodrag w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-500"
      value={expanded ? fontSizes.expanded : fontSizes.normal}
      onfocus={activeFontSizeTracker.onFocus}
      onblur={activeFontSizeTracker.onBlur}
      oninput={(event) => {
        const value = event.currentTarget.valueAsNumber;
        if (Number.isFinite(value) && value > 0) {
          const nextValue = expanded ? Math.max(fontSizes.normal + 1, value) : value;

          updateNodeData(nodeId, { [fontSizeKey]: nextValue });
        }
      }}
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-xs font-medium text-zinc-300">Font family</span>
    <input
      type="text"
      aria-label="Font family"
      class="nodrag w-full min-w-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-zinc-500"
      value={data.fontFamily ?? $editorFontFamily}
      onfocus={fontFamilyTracker.onFocus}
      onblur={fontFamilyTracker.onBlur}
      oninput={(event) => updateNodeData(nodeId, { fontFamily: event.currentTarget.value })}
    />
  </label>
  <button
    class="w-full cursor-pointer rounded border border-zinc-600 px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800"
    onclick={() => {
      stylesOpen = true;
      settingsOpen = false;
    }}>Custom Styles…</button
  >
{/snippet}

{#snippet settingsPanel()}
  {#if !compact && !expanded}
    <div class="absolute -top-7 left-0 flex w-full justify-end">
      <button
        class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
        aria-label="Close Strudel settings"
        onclick={() => openSettings(false)}><X class="h-4 w-4" /></button
      >
    </div>
  {/if}
  <ObjectSettings
    {nodeId}
    schema={[]}
    values={{}}
    onValueChange={() => {}}
    onRevertAll={() => {}}
    onClose={() => openSettings(false)}
    showCloseButton={false}
    showRevertButton={false}
    content={settingsFields}
  />
{/snippet}

{#if !compact}
  <Tooltip.Root>
    <Tooltip.Trigger
      class={actionButtonClass}
      aria-label="Strudel settings"
      aria-expanded={settingsOpen}
      onclick={() => openSettings(!settingsOpen)}><Settings class="h-4 w-4" /></Tooltip.Trigger
    >
    <Tooltip.Content>Settings</Tooltip.Content>
  </Tooltip.Root>
  {#if settingsOpen && (expanded || sidePanelTarget)}
    <Portal to={expanded ? document.body : sidePanelTarget}>
      <section
        data-strudel-panel
        data-state="open"
        aria-label="Strudel settings"
        class={[
          'nodrag nopan nowheel w-48 text-zinc-200',
          !expanded && 'relative',
          expanded &&
            'fixed top-[calc(env(safe-area-inset-top,0px)+4.25rem)] right-6 z-[70] max-w-[calc(100vw-3rem)]'
        ]}
      >
        {@render settingsPanel()}
      </section>
    </Portal>
  {/if}
{/if}

<Popover.Root open={settingsOpen && compact} onOpenChange={openSettings}>
  <Popover.Trigger class="hidden" aria-hidden="true" tabindex={-1} />
  <Popover.Content
    data-strudel-panel
    class="nodrag nopan nowheel z-[70] w-48 max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 text-zinc-200 shadow-none"
    customAnchor={settingsOpen ? settingsAnchor : undefined}
    side={compactOverflowSettings ? 'right' : 'bottom'}
    align="start"
    sideOffset={compactOverflowSettings ? 0 : 4}
    onCloseAutoFocus={(event) => event.preventDefault()}
  >
    {@render settingsPanel()}
  </Popover.Content>
</Popover.Root>

<Popover.Root
  open={menuOpen}
  onOpenChange={(open) => {
    menuOpen = open;

    if (open && expanded) {
      openSettings(false);
    }
  }}
>
  <Popover.Trigger class={actionButtonClass} aria-label="Editor options">
    <Ellipsis class="h-4 w-4" />
  </Popover.Trigger>
  <Popover.Content
    data-strudel-panel
    class="nodrag nopan nowheel z-[70] w-52 max-w-[calc(100vw-2rem)] border-zinc-700 bg-zinc-900 p-1 text-zinc-200"
    align="end"
    onCloseAutoFocus={(event) => event.preventDefault()}
  >
    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
      onclick={() => {
        change('muted', !data.muted);
        menuOpen = false;
      }}
    >
      {#if data.muted}<Volume2 class="h-4 w-4" />{:else}<VolumeX class="h-4 w-4" />{/if}
      {data.muted ? 'Unmute' : 'Mute'}
    </button>
    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
      onclick={toggleConsole}
    >
      <Terminal class="h-4 w-4" />{data.showConsole ? 'Hide Console' : 'Show Console'}
    </button>
    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
      onclick={() => {
        menuOpen = false;
        onExpand();
      }}
    >
      <Expand class="h-4 w-4" />Expand Editor
    </button>
    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
      onclick={() => {
        menuOpen = false;
        onLayoutChange(!data.editorCollapsed);
      }}
    >
      <Code class="h-4 w-4" />{data.editorCollapsed ? 'Show Editor in Patch' : 'Hide Code'}
    </button>
    {#if compact}
      <button
        class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
        onclick={showCompactSettings}
      >
        <Settings class="h-4 w-4" />Settings
      </button>
    {/if}
  </Popover.Content>
</Popover.Root>

<StrudelStylesDialog
  bind:open={stylesOpen}
  styles={data.styles ?? {}}
  onchange={(styles) => updateNodeData(nodeId, { styles })}
  oncommit={(oldValue, newValue) => tracker.commit('styles', oldValue, newValue)}
/>
