<script lang="ts">
  import { Settings, X } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import { match } from 'ts-pattern';

  // Predefined color palette for post-it notes
  const COLOR_PRESETS = [
    { name: 'Yellow', value: '#fef3c7' },
    { name: 'Pink', value: '#fce7f3' },
    { name: 'Blue', value: '#dbeafe' },
    { name: 'Green', value: '#dcfce7' },
    { name: 'Purple', value: '#f3e8ff' },
    { name: 'Orange', value: '#ffedd5' }
  ] as const;

  const FONT_SIZES = [
    { label: 'Small', value: 12 },
    { label: 'Medium', value: 14 },
    { label: 'Large', value: 18 },
    { label: 'XL', value: 24 }
  ] as const;

  let node: {
    id: string;
    data: {
      text?: string;
      color?: string;
      fontSize?: number;
    };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  let showSettings = $state(false);
  let isEditing = $state(false);
  let textareaElement: HTMLTextAreaElement | null = $state(null);

  // Defaults
  const [defaultWidth, defaultHeight] = [200, 150];

  // Derived values
  const text = $derived(node.data.text ?? '');
  const color = $derived(node.data.color ?? '#fef3c7');
  const fontSize = $derived(node.data.fontSize ?? 14);
  const width = $derived(node.width ?? defaultWidth);
  const height = $derived(node.height ?? defaultHeight);

  // Text color should be dark on light backgrounds
  const textColor = $derived.by(() => {
    // Simple brightness check - all preset colors are light so use dark text
    return '#1f2937';
  });

  function updateConfig(updates: Partial<typeof node.data>) {
    updateNodeData(node.id, { ...node.data, ...updates });
  }

  function handleDoubleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    isEditing = true;

    setTimeout(() => textareaElement?.focus(), 10);
  }

  function handleBlur() {
    isEditing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    match(e.key)
      .with('Escape', () => {
        isEditing = false;
      })
      .otherwise(() => {});
  }

  function handleTextChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    updateConfig({ text: target.value });
  }

  // Close settings when clicking outside
  function handleSettingsClick(e: MouseEvent) {
    e.stopPropagation();
  }
</script>

<div class="relative">
  <NodeResizer class="z-1" isVisible={node.selected} minWidth={100} minHeight={80} />

  <div class="group relative">
    <!-- Settings button (visible on hover or when selected) -->
    <div class="absolute -top-7 right-0 z-10 flex gap-x-1">
      <button
        class={[
          'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
          node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        ]}
        onclick={() => (showSettings = !showSettings)}
        title="Settings"
      >
        <Settings class="h-4 w-4 text-zinc-300" />
      </button>
    </div>

    <!-- Main post-it note area -->
    <div
      class={[
        'relative overflow-hidden rounded-lg shadow-md transition-shadow hover:shadow-lg',
        isEditing && 'nodrag'
      ]}
      style="width: {width}px; height: {height}px; background-color: {color};"
      ondblclick={handleDoubleClick}
      role="button"
      tabindex="0"
    >
      {#if isEditing}
        <textarea
          bind:this={textareaElement}
          value={text}
          oninput={handleTextChange}
          onblur={handleBlur}
          onkeydown={handleKeydown}
          class="h-full w-full resize-none border-none bg-transparent p-3 outline-none"
          style="font-size: {fontSize}px; color: {textColor};"
          placeholder="Double-click to edit..."
        ></textarea>
      {:else}
        <div
          class="h-full w-full overflow-auto p-3 whitespace-pre-wrap"
          style="font-size: {fontSize}px; color: {textColor};"
        >
          {#if text}
            {text}
          {:else}
            <span class="italic opacity-50">Double-click to edit...</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Settings panel -->
  {#if showSettings}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="absolute top-0 z-20" style="left: {width + 10}px" onclick={handleSettingsClick}>
      <div class="absolute -top-7 right-0 flex gap-x-1">
        <button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="nodrag w-48 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <div class="space-y-4">
          <!-- Color picker -->
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-2 block text-xs font-medium text-zinc-300">Color</label>
            <div class="grid grid-cols-3 gap-2">
              {#each COLOR_PRESETS as preset}
                <button
                  onclick={() => updateConfig({ color: preset.value })}
                  class={[
                    'h-8 w-full rounded border-2 transition-all',
                    color === preset.value
                      ? 'border-white shadow-md'
                      : 'border-transparent hover:border-zinc-400'
                  ]}
                  style="background-color: {preset.value};"
                  title={preset.name}
                  aria-label={preset.name}
                ></button>
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
                  onclick={() => updateConfig({ fontSize: size.value })}
                  class={[
                    'rounded px-2 py-1 text-xs transition-colors',
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
        </div>
      </div>
    </div>
  {/if}
</div>
