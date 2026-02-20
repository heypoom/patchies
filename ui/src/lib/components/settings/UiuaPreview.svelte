<script lang="ts">
  import { Play } from '@lucide/svelte/icons';
  import type { OutputItem } from '$lib/uiua/UiuaService';

  let {
    resultStack,
    onRun,
    getBlobUrl,
    getImageDimensions
  }: {
    resultStack: OutputItem[];
    onRun: () => void;
    getBlobUrl: (index: number) => string | undefined;
    getImageDimensions: (index: number) => { width: number; height: number } | undefined;
  } = $props();
</script>

<div class="absolute top-0 left-full z-20 ml-2">
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
    <button
      onclick={onRun}
      class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
      title="Run"
    >
      <Play class="h-4 w-4" />
    </button>
  </div>
  <div
    class="nodrag nowheel max-h-96 min-h-20 max-w-96 min-w-20 overflow-auto rounded-md border border-zinc-600 bg-zinc-900 p-2 shadow-xl"
  >
    {#if resultStack.length > 0}
      {#each resultStack as item, index}
        {#if item.type === 'image'}
          {@const dims = getImageDimensions(index)}
          <div style={dims ? `width: ${dims.width}px; height: ${dims.height}px;` : undefined}>
            <img
              src={getBlobUrl(index)}
              alt={item.label ?? 'Uiua image'}
              class="block rounded"
              width={dims?.width}
              height={dims?.height}
              style={dims ? `width: ${dims.width}px; height: ${dims.height}px;` : undefined}
            />
          </div>
        {:else if item.type === 'gif'}
          {@const dims = getImageDimensions(index)}
          <div style={dims ? `width: ${dims.width}px; height: ${dims.height}px;` : undefined}>
            <img
              src={getBlobUrl(index)}
              alt={item.label ?? 'Uiua animation'}
              class="block rounded"
              width={dims?.width}
              height={dims?.height}
              style={dims ? `width: ${dims.width}px; height: ${dims.height}px;` : undefined}
            />
          </div>
        {:else if item.type === 'audio'}
          <audio controls src={getBlobUrl(index)} class="h-8 w-full"></audio>
        {:else if item.type === 'svg'}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="svg-container max-w-full overflow-auto">
            {@html item.svg}
          </div>
        {:else if item.type === 'text'}
          <pre class="font-mono text-xs whitespace-pre-wrap text-zinc-300">{item.value}</pre>
        {/if}
      {/each}
    {:else}
      <span class="text-xs text-zinc-500"></span>
    {/if}
  </div>
</div>
