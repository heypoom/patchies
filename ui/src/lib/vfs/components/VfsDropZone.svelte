<script lang="ts">
  import type { Component } from 'svelte';

  interface Props {
    /** Icon component to display */
    icon: Component;

    /** File type description (e.g., "image", "audio", "video") */
    fileType: string;

    /** Width of the drop zone */
    width: number;

    /** Height of the drop zone */
    height: number;

    /** Whether user is dragging a file over */
    isDragging?: boolean;

    /** Callback when user double-clicks to open file dialog */
    onDoubleClick?: () => void;

    /** Drag event handlers */
    onDragOver?: (e: DragEvent) => void;
    onDragLeave?: (e: DragEvent) => void;
    onDrop?: (e: DragEvent) => void;

    /** Additional CSS classes */
    class?: string;
  }

  let {
    icon: Icon,
    fileType,
    width,
    height,
    isDragging = false,
    onDoubleClick,
    onDragOver,
    onDragLeave,
    onDrop,
    class: className = ''
  }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && onDoubleClick) {
      onDoubleClick();
    }
  }
</script>

<div
  class={[
    'flex flex-col items-center justify-center gap-2 rounded-lg border-1 px-1 py-3',
    isDragging ? 'border-blue-400 bg-blue-50/10' : 'border-dashed border-zinc-600 bg-zinc-900',
    className
  ]}
  style="width: {width}px; height: {height}px"
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  ondblclick={onDoubleClick}
  role="button"
  tabindex="0"
  onkeydown={handleKeydown}
>
  <Icon class="h-4 w-4 text-zinc-400" />

  <div class="px-2 text-center font-mono text-[12px] text-zinc-400">
    <span class="text-zinc-300">double click</span> or
    <span class="text-zinc-300">drop</span><br />
    {fileType} file
  </div>
</div>
