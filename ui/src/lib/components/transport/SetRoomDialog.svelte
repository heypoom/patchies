<script lang="ts">
  import { getSearchParam, setSearchParam } from '$lib/utils/search-params';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let roomName = $state(getSearchParam('room') ?? '');
  let inputRef: HTMLInputElement | null = $state(null);

  $effect(() => {
    inputRef?.focus();
    inputRef?.select();
  });

  function handleConfirm() {
    const trimmed = roomName.trim();
    if (!trimmed) return;

    setSearchParam('room', trimmed);
    setSearchParam('sync', 'true');
    onClose();
    window.location.reload();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  onclick={handleBackdropClick}
>
  <div class="w-80 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
    <div class="mb-3 text-sm font-medium text-zinc-200">Set Room for Sync</div>
    <div class="mb-4 text-xs text-zinc-400">
      Enter a room ID to sync transport with other peers. The page will reload to join the room.
    </div>

    <input
      bind:this={inputRef}
      bind:value={roomName}
      onkeydown={handleKeydown}
      type="text"
      placeholder="Enter room ID..."
      class="w-full rounded bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-500 ring-1 ring-zinc-600 outline-none focus:ring-zinc-400"
    />

    {#if roomName.trim()}
      <div class="mt-2 text-xs text-zinc-500">
        Room: <span class="font-mono text-green-300">{roomName.trim()}</span>
      </div>
    {/if}

    <div class="mt-4 flex justify-end gap-2">
      <button
        onclick={onClose}
        class="cursor-pointer rounded px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        Cancel
      </button>
      <button
        onclick={handleConfirm}
        disabled={!roomName.trim()}
        class="cursor-pointer rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Set Room & Reload
      </button>
    </div>
  </div>
</div>
