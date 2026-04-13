<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import { applyRoom, getRoom } from '$lib/utils/settings-actions';

  let roomName = $state(getRoom());

  function handleApplyRoom() {
    applyRoom(roomName);
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
    class="w-40 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs text-zinc-300 transition-colors outline-none placeholder:text-zinc-700 hover:border-white/20 focus:border-orange-500/40"
  />
</SettingRow>
