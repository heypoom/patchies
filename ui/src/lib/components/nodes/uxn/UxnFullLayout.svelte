<script lang="ts">
  import { Code, FolderOpen, Monitor, Pause, Play, Terminal } from '@lucide/svelte/icons';
  import * as Tooltip from '../../ui/tooltip';
  import StandardHandle from '../../StandardHandle.svelte';

  let {
    nodeId,
    selected,
    isPaused,
    canvas = $bindable(),
    previewContainer = $bindable(),
    onTogglePause,
    onOpenFileDialog,
    onToggleConsole,
    onToggleEditor,
    onHideScreen,
    onMeasureContainerWidth
  }: {
    nodeId: string;
    selected: boolean;
    isPaused: boolean;
    canvas?: HTMLCanvasElement;
    previewContainer?: HTMLDivElement | null;
    onTogglePause: () => void;
    onOpenFileDialog: () => void;
    onToggleConsole: () => void;
    onToggleEditor: () => void;
    onHideScreen: () => void;
    onMeasureContainerWidth: () => void;
  } = $props();
</script>

<div class="absolute -top-7 left-0 flex w-full items-center justify-between">
  <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
    <div class="font-mono text-xs font-medium text-zinc-400">uxn</div>
  </div>

  <div class="flex gap-1">
    <button
      title={isPaused ? 'Resume' : 'Pause'}
      class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
      onclick={onTogglePause}
    >
      {#if isPaused}
        <Play class="h-4 w-4 text-zinc-300" />
      {:else}
        <Pause class="h-4 w-4 text-zinc-300" />
      {/if}
    </button>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={onOpenFileDialog}
        >
          <FolderOpen class="h-4 w-4 text-zinc-300" />
        </button>
      </Tooltip.Trigger>

      <Tooltip.Content>
        <p>Load ROM</p>
      </Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={onHideScreen}
        >
          <Monitor class="h-4 w-4 text-zinc-300" />
        </button>
      </Tooltip.Trigger>

      <Tooltip.Content>
        <p>Hide Screen</p>
      </Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={onToggleConsole}
        >
          <Terminal class="h-4 w-4 text-zinc-300" />
        </button>
      </Tooltip.Trigger>

      <Tooltip.Content>
        <p>Console</p>
      </Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={() => {
            onToggleEditor();
            onMeasureContainerWidth();
          }}
        >
          <Code class="h-4 w-4 text-zinc-300" />
        </button>
      </Tooltip.Trigger>

      <Tooltip.Content>
        <p>Edit Code</p>
      </Tooltip.Content>
    </Tooltip.Root>
  </div>
</div>

<div class="relative">
  <StandardHandle
    port="inlet"
    type="message"
    id={0}
    title="ROM input"
    total={1}
    index={0}
    {nodeId}
  />
  <div bind:this={previewContainer}>
    <canvas
      bind:this={canvas}
      class={[
        'nodrag cursor-default rounded-md border',
        selected
          ? 'shadow-glow-md border-zinc-400 [&>canvas]:rounded-[7px]'
          : 'hover:shadow-glow-sm border-transparent [&>canvas]:rounded-md'
      ]}
      width={512}
      height={320}
      style="width: 512px; height: 320px; image-rendering: pixelated; image-rendering: crisp-edges;"
    ></canvas>
  </div>

  <StandardHandle
    port="outlet"
    type="video"
    id={0}
    title="Video output"
    total={2}
    index={0}
    {nodeId}
  />

  <StandardHandle
    port="outlet"
    type="message"
    id={0}
    title="Console output"
    total={2}
    index={1}
    {nodeId}
  />
</div>
