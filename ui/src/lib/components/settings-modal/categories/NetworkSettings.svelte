<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import { applyRoom, getRoom } from '$lib/utils/settings-actions';
  import { remoteControlStore } from '../../../../stores/remote-control.store';

  let roomName = $state(getRoom());

  function handleApplyRoom() {
    applyRoom(roomName);
  }

  async function copyConnectionDetails() {
    if (!$remoteControlStore.capability) return;

    await navigator.clipboard.writeText(
      JSON.stringify({ room: getRoom(), capability: $remoteControlStore.capability })
    );
  }
</script>

<SettingRow title="Room" description="Room ID for netsend/netrecv P2P communication">
  <input
    type="text"
    bind:value={roomName}
    onblur={handleApplyRoom}
    onkeydown={(e) => {
      if (e.key === 'Enter') handleApplyRoom();
    }}
    placeholder="No room set"
    aria-label="Network room"
    class="w-40 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none placeholder:text-zinc-700 hover:border-white/20 focus:border-orange-500/40"
  />
</SettingRow>

<SettingRow
  title="Coding agent remote control"
  description="Allow a paired local coding agent to inspect and edit this running editor. The capability expires when disabled or reloaded."
>
  <div class="flex flex-col items-end gap-2">
    {#if $remoteControlStore.enabled}
      <button
        type="button"
        onclick={() => remoteControlStore.disable()}
        class="cursor-pointer rounded border border-red-500/30 bg-red-500/10 px-2 py-1 font-mono text-xs text-red-300 transition-colors hover:bg-red-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
      >
        Disable
      </button>
      <button
        type="button"
        onclick={copyConnectionDetails}
        class="cursor-pointer rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
      >
        Copy pairing details
      </button>
    {:else}
      <button
        type="button"
        onclick={() => remoteControlStore.enable()}
        class="cursor-pointer rounded border border-orange-500/40 bg-orange-500/10 px-2 py-1 font-mono text-xs text-orange-200 transition-colors hover:bg-orange-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
      >
        Enable
      </button>
    {/if}
  </div>
</SettingRow>
