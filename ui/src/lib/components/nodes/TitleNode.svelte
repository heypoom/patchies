<script lang="ts">
  import { Settings, X } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import { match } from 'ts-pattern';
  import { useNodeDataTracker } from '$lib/history';
  import * as Tooltip from '$lib/components/ui/tooltip';

  const COLOR_PRESETS = [
    { name: 'Transparent', value: 'transparent' },
    { name: 'Black', value: '#09090b' },
    { name: 'Dark', value: '#18181b' },
    { name: 'White', value: '#ffffff' },
    { name: 'Yellow', value: '#fef3c7' },
    { name: 'Pink', value: '#fce7f3' },
    { name: 'Blue', value: '#dbeafe' },
    { name: 'Green', value: '#dcfce7' },
    { name: 'Purple', value: '#f3e8ff' },
    { name: 'Orange', value: '#ffedd5' },
    { name: 'Cyan', value: '#cffafe' },
    { name: 'Rose', value: '#ffe4e6' }
  ] as const;

  const FONT_SIZES = [
    { label: 'XS', value: 10 },
    { label: 'S', value: 14 },
    { label: 'M', value: 20 },
    { label: 'L', value: 28 },
    { label: 'XL', value: 40 },
    { label: 'XXL', value: 56 }
  ] as const;

  let node: {
    id: string;
    data: {
      text?: string;
      color?: string;
      fontSize?: number;
      bordered?: boolean;
      font?: 'default' | 'mono';
    };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  const tracker = useNodeDataTracker(node.id);
  const textTracker = tracker.track('text', () => node.data.text ?? '');

  let showSettings = $state(false);
  let isEditing = $state(false);
  let editableRef: HTMLDivElement | null = $state(null);

  const [defaultWidth, defaultHeight] = [250, 50];

  const text = $derived(node.data.text ?? '');
  const color = $derived(node.data.color ?? 'transparent');
  const fontSize = $derived(node.data.fontSize ?? 28);
  const bordered = $derived(node.data.bordered ?? false);
  const font = $derived(node.data.font ?? 'default');
  const fontFamily = $derived(font === 'mono' ? 'monospace' : 'inherit');
  const width = $derived(node.width ?? defaultWidth);
  const height = $derived(node.height ?? defaultHeight);

  // Determine text color based on background brightness
  const textColor = $derived.by(() => {
    if (color === 'transparent') return '#f4f4f5';
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#1f2937' : '#f4f4f5';
  });

  function updateConfig(updates: Partial<typeof node.data>) {
    updateNodeData(node.id, { ...node.data, ...updates });
  }

  function handleDoubleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isEditing = true;
    textTracker.onFocus();

    setTimeout(() => {
      if (!editableRef) return;
      editableRef.innerText = text;
      editableRef.focus();
      // Place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editableRef);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 10);
  }

  function handleBlur() {
    if (!isEditing) return;
    isEditing = false;
    textTracker.onBlur();
  }

  function handleKeydown(e: KeyboardEvent) {
    match(e.key)
      .with('Escape', () => {
        textTracker.onBlur();
        isEditing = false;
      })
      .otherwise(() => {});
  }

  function handleKeyActivate(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.key === ' ') e.preventDefault();
      handleDoubleClick();
    }
  }

  function handleInput(e: Event) {
    updateConfig({ text: (e.target as HTMLDivElement).innerText });
  }
</script>

<div class="relative">
  <NodeResizer class="z-1" isVisible={node.selected} minWidth={80} minHeight={50} />

  <div class="group relative">
    <!-- Settings button -->
    <div class="absolute -top-7 right-0 z-10 flex gap-x-1">
      <button
        class={[
          'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
          node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        ]}
        onclick={() => (showSettings = !showSettings)}
      >
        <Settings class="h-4 w-4 text-zinc-300" />
      </button>
    </div>

    <!-- Main card area -->
    <div
      class={[
        'relative flex items-center justify-center overflow-hidden rounded-md transition-shadow',
        isEditing && 'nodrag',
        bordered ? 'border-2' : 'border-0'
      ]}
      style="width: {width}px; height: {height}px; background-color: {color}; border-color: {textColor}22;"
      ondblclick={handleDoubleClick}
      onkeydown={handleKeyActivate}
      role="button"
      tabindex="0"
    >
      {#if isEditing}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          bind:this={editableRef}
          contenteditable="true"
          oninput={handleInput}
          onblur={handleBlur}
          onkeydown={handleKeydown}
          class="nodrag flex h-full w-full cursor-text items-center justify-center overflow-hidden px-3 text-center outline-none"
          style="font-size: {fontSize}px; color: {textColor}; line-height: 1.2; white-space: pre-wrap; font-family: {fontFamily};"
        ></div>
      {:else}
        <div
          class="flex h-full w-full items-center justify-center overflow-hidden px-3 text-center"
          style="font-size: {fontSize}px; color: {textColor}; line-height: 1.2; white-space: pre-wrap; font-family: {fontFamily};"
        >
          {#if text}
            {text}
          {:else}
            <span class="text-sm" style="opacity: 0.6;">Double-click to edit</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Settings panel -->
  {#if showSettings}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute top-0 z-20"
      style="left: {width + 10}px"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="absolute -top-7 right-0 flex gap-x-1">
        <button
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="nodrag w-52 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <div class="space-y-4">
          <!-- Color picker -->
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-2 block text-xs font-medium text-zinc-300">Color</label>
            <div class="flex flex-wrap gap-2">
              {#each COLOR_PRESETS as preset (preset.name)}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      onclick={() => {
                        const old = color;
                        updateConfig({ color: preset.value });
                        tracker.commit('color', old, preset.value);
                      }}
                      class={[
                        'h-6 w-6 cursor-pointer rounded-full border-2 transition-all',
                        color === preset.value
                          ? 'scale-110 border-white shadow-md'
                          : 'border-zinc-600 hover:scale-105 hover:border-zinc-400'
                      ]}
                      style={preset.value === 'transparent'
                        ? 'background-image: linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%); background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0px; background-color: #fff;'
                        : `background-color: ${preset.value};`}
                      aria-label={preset.name}
                    ></button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{preset.name}</Tooltip.Content>
                </Tooltip.Root>
              {/each}
            </div>
          </div>

          <!-- Font size -->
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-2 block text-xs font-medium text-zinc-300">Font Size</label>
            <div class="flex flex-wrap gap-1">
              {#each FONT_SIZES as size}
                <button
                  onclick={() => {
                    const old = fontSize;
                    updateConfig({ fontSize: size.value });
                    tracker.commit('fontSize', old, size.value);
                  }}
                  class={[
                    'cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                    fontSize === size.value
                      ? 'bg-zinc-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  ]}
                >
                  {size.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Font -->
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-2 block text-xs font-medium text-zinc-300">Font</label>
            <div class="flex gap-1">
              {#each [{ label: 'Default', value: 'default' }, { label: 'Mono', value: 'mono' }] as opt}
                <button
                  onclick={() => {
                    const old = font;
                    updateConfig({ font: opt.value as 'default' | 'mono' });
                    tracker.commit('font', old, opt.value);
                  }}
                  class={[
                    'cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                    font === opt.value
                      ? 'bg-zinc-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  ]}
                >
                  {opt.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Border toggle -->
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-2 block text-xs font-medium text-zinc-300">Border</label>
            <button
              onclick={() => {
                const old = bordered;
                updateConfig({ bordered: !bordered });
                tracker.commit('bordered', old, !bordered);
              }}
              class={[
                'cursor-pointer rounded px-3 py-1 text-xs transition-colors',
                bordered ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              ]}
            >
              {bordered ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
