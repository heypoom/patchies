<script lang="ts">
  import { Lock, LockOpen, Settings, X } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import { match } from 'ts-pattern';
  import { useNodeDataTracker } from '$lib/history';
  import * as Tooltip from '$lib/components/ui/tooltip';

  // Predefined color palette for post-it notes
  const COLOR_PRESETS = [
    { name: 'Yellow', value: '#fef3c7' },
    { name: 'Pink', value: '#fce7f3' },
    { name: 'Blue', value: '#dbeafe' },
    { name: 'Green', value: '#dcfce7' },
    { name: 'Purple', value: '#f3e8ff' },
    { name: 'Orange', value: '#ffedd5' },
    { name: 'Cyan', value: '#cffafe' },
    { name: 'Rose', value: '#ffe4e6' },
    { name: 'Lime', value: '#ecfccb' },
    { name: 'Slate', value: '#e2e8f0' }
  ] as const;

  const FONT_SIZES = [
    { label: 'Small', value: 12 },
    { label: 'Medium', value: 14 },
    { label: 'Large', value: 18 },
    { label: 'Huge', value: 24 }
  ] as const;

  let node: {
    id: string;
    data: {
      text?: string;
      color?: string;
      fontSize?: number;
      locked?: boolean;
    };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(node.id);
  const textTracker = tracker.track('text', () => node.data.text ?? '');

  let showSettings = $state(false);
  let isEditing = $state(false);
  let textareaElement: HTMLTextAreaElement | null = $state(null);

  // Defaults
  const [defaultWidth, defaultHeight] = [200, 150];

  // Derived values
  const text = $derived(node.data.text ?? '');
  const color = $derived(node.data.color ?? '#fef3c7');
  const fontSize = $derived(node.data.fontSize ?? 14);
  const locked = $derived(node.data.locked ?? false);
  const width = $derived(node.width ?? defaultWidth);
  const height = $derived(node.height ?? defaultHeight);

  // Text color should be dark on light backgrounds
  const textColor = $derived.by(() => {
    // Simple brightness check - all preset colors are light so use dark text
    return '#1f2937';
  });

  // Simple markdown: **bold** and *italic* only
  function formatText(raw: string): string {
    // Escape HTML to prevent XSS
    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Apply formatting: **bold** then _italic_
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>');
  }

  const formattedText = $derived(formatText(text));

  function updateConfig(updates: Partial<typeof node.data>) {
    updateNodeData(node.id, { ...node.data, ...updates });
  }

  function handleDoubleClick(e: MouseEvent) {
    if (locked) return;

    e.preventDefault();
    e.stopPropagation();

    isEditing = true;
    textTracker.onFocus();

    setTimeout(() => textareaElement?.focus(), 10);
  }

  function handleBlur() {
    isEditing = false;
    textTracker.onBlur();
  }

  // Toggle wrap: if already wrapped, unwrap; otherwise wrap
  function toggleWrap(marker: string) {
    if (!textareaElement) return;

    const start = textareaElement.selectionStart;
    const end = textareaElement.selectionEnd;

    // Only act if there's a selection
    if (start === end) return;

    const len = marker.length;

    // Check if selection is already wrapped with this marker
    const before = text.slice(start - len, start);
    const after = text.slice(end, end + len);
    const isWrapped = before === marker && after === marker;

    let newText: string;
    let newCursorPos: number;

    if (isWrapped) {
      // Unwrap: remove markers around selection
      newText = text.slice(0, start - len) + text.slice(start, end) + text.slice(end + len);
      newCursorPos = end - len;
    } else {
      // Wrap: add markers around selection
      const selected = text.slice(start, end);
      newText = text.slice(0, start) + marker + selected + marker + text.slice(end);
      newCursorPos = end + len * 2;
    }

    updateConfig({ text: newText });

    setTimeout(() => {
      if (!textareaElement) return;
      textareaElement.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;

    // Cmd/Ctrl+B for bold
    if (mod && e.key === 'b') {
      e.preventDefault();
      toggleWrap('**');
      return;
    }

    // Cmd/Ctrl+I for italic
    if (mod && e.key === 'i') {
      e.preventDefault();
      toggleWrap('_');
      return;
    }

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
  <NodeResizer class="z-1" isVisible={node.selected && !locked} minWidth={100} minHeight={80} />

  <div class="group relative">
    <!-- Settings button (visible on hover or when selected) -->
    <div class={['absolute -top-7 right-0 z-10 flex gap-x-1', locked && 'nodrag']}>
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
        (isEditing || locked) && 'nodrag',
        locked && node.selected && 'ring-2 ring-blue-500'
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
            {@html formattedText}
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
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={() => {
                const oldLocked = locked;
                updateConfig({ locked: !locked });
                tracker.commit('locked', oldLocked, !locked);
              }}
              class={[
                'h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 hover:bg-zinc-700',
                locked ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              ]}
            >
              {#if locked}
                <Lock class="h-4 w-4" />
              {:else}
                <LockOpen class="h-4 w-4" />
              {/if}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>
            <p class="text-xs">Prevent moving, resizing, and editing</p>
          </Tooltip.Content>
        </Tooltip.Root>
        <button
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="nodrag w-48 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <div class="space-y-4">
          <!-- Color picker -->
          <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="mb-2 block text-xs font-medium text-zinc-300">Color</label>

            <div class="flex flex-wrap gap-2">
              {#each COLOR_PRESETS as preset}
                <button
                  onclick={() => {
                    const oldColor = color;
                    updateConfig({ color: preset.value });
                    tracker.commit('color', oldColor, preset.value);
                  }}
                  class={[
                    'h-6 w-6 cursor-pointer rounded-full border-2 transition-all',
                    color === preset.value
                      ? 'scale-110 border-white shadow-md'
                      : 'border-transparent hover:scale-105 hover:border-zinc-400'
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
                  onclick={() => {
                    const oldFontSize = fontSize;
                    updateConfig({ fontSize: size.value });
                    tracker.commit('fontSize', oldFontSize, size.value);
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
        </div>
      </div>
    </div>
  {/if}
</div>
