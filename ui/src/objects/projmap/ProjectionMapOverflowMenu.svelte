<script lang="ts">
  import * as Popover from '$lib/components/ui/popover';
  import { Expand, Plus, Trash2, EllipsisVertical } from '@lucide/svelte/icons';

  let {
    selected,
    activeSurfaceId,
    onexpand,
    onaddsurface,
    ondeletesurface
  }: {
    selected: boolean;
    activeSurfaceId: string | null;
    onexpand: () => void;
    onaddsurface: () => void;
    ondeletesurface: () => void;
  } = $props();

  let open = $state(false);
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    <button
      class={[
        'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
        !open && (selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')
      ]}
    >
      <EllipsisVertical class="h-4 w-4 text-zinc-400" />
    </button>
  </Popover.Trigger>

  <Popover.Content
    class="w-44 p-1"
    align="end"
    sideOffset={6}
    onCloseAutoFocus={(e) => e.preventDefault()}
  >
    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
      onclick={() => {
        onexpand();
        open = false;
      }}
    >
      <Expand class="h-4 w-4 text-zinc-400" />
      Expand editor
    </button>

    <div class="my-1 border-t border-zinc-700"></div>

    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
      onclick={() => {
        onaddsurface();
        open = false;
      }}
    >
      <Plus class="h-4 w-4 text-zinc-400" />
      Add surface
    </button>

    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
      onclick={() => {
        ondeletesurface();
        open = false;
      }}
      disabled={!activeSurfaceId}
    >
      <Trash2 class="h-4 w-4 text-zinc-400" />
      Delete surface
    </button>
  </Popover.Content>
</Popover.Root>
