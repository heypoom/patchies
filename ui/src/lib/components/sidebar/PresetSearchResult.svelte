<script lang="ts">
  import { Blocks, Pencil, Trash2 } from '@lucide/svelte/icons';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import type { PresetSearchRecord } from '$lib/presets/preset-utils';

  interface Props {
    result: PresetSearchRecord;
    selected: boolean;
    iconColor: string;
    renaming: boolean;
    renameInputValue: string;
    onclick: (event: MouseEvent) => void;
    ondragstart: (event: DragEvent) => void;
    ondragend: (event: DragEvent) => void;
    onrename: () => void;
    onrenamekeydown: (event: KeyboardEvent) => void;
    ondelete: () => void;
  }

  let {
    result,
    selected,
    iconColor,
    renaming,
    renameInputValue = $bindable(),
    onclick,
    ondragstart,
    ondragend,
    onrename,
    onrenamekeydown,
    ondelete
  }: Props = $props();
</script>

{#snippet row()}
  <button
    class="flex w-full cursor-pointer items-center gap-1.5 py-1 pl-2 text-left text-xs {selected
      ? 'bg-blue-900/40 hover:bg-blue-900/50'
      : 'hover:bg-zinc-800'}"
    draggable={!renaming}
    {ondragstart}
    {ondragend}
    onclick={(event) => {
      if (!renaming) {
        onclick(event);
      }
    }}
  >
    <Blocks class="h-3.5 w-3.5 shrink-0 {iconColor}" />

    {#if renaming}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        class="min-w-0 flex-1 rounded bg-transparent px-1 font-mono text-zinc-300 ring-1 ring-blue-500 outline-none"
        aria-label="Preset name"
        bind:value={renameInputValue}
        onkeydown={onrenamekeydown}
        onclick={(event) => event.stopPropagation()}
        autofocus
      />
    {:else}
      <span class="truncate font-mono text-zinc-300">{result.name}</span>
    {/if}

    <span class="ml-auto truncate pr-2 text-[10px] text-zinc-600">
      {result.location}
    </span>
  </button>
{/snippet}

{#if result.readonly}
  {@render row()}
{:else}
  <ContextMenu.Root>
    <ContextMenu.Trigger class="block w-full">
      {@render row()}
    </ContextMenu.Trigger>

    <ContextMenu.Content class="w-48">
      <ContextMenu.Item onclick={onrename}>
        <Pencil class="mr-2 h-4 w-4" />
        Rename
      </ContextMenu.Item>

      <ContextMenu.Separator />

      <ContextMenu.Item class="text-red-400 focus:text-red-400" onclick={ondelete}>
        <Trash2 class="mr-2 h-4 w-4" />
        Delete
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>
{/if}
