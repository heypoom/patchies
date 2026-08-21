<script lang="ts">
  import { Copy, Link2, Power, PowerOff } from '@lucide/svelte/icons';
  import { toast } from 'svelte-sonner';
  import SettingRow from '../SettingRow.svelte';

  let {
    enabled,
    mountCommand,
    onEnable,
    onDisable
  }: {
    enabled: boolean;
    mountCommand: string | null;
    onEnable: () => Promise<void>;
    onDisable: () => void;
  } = $props();

  async function enable() {
    try {
      await onEnable();
      toast.success('Remote Control enabled');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not enable Remote Control');
    }
  }

  async function copyMountCommand() {
    if (!mountCommand) return;

    try {
      await navigator.clipboard.writeText(mountCommand);
      toast.success('Mount command copied');
    } catch {
      toast.error('Could not copy the mount command');
    }
  }
</script>

<SettingRow
  title="Remote Control"
  description="Let the local Patchies CLI edit supported code in this open patch."
>
  {#if enabled}
    <div class="flex items-center gap-2">
      <span class="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        ACTIVE
      </span>
      <button
        type="button"
        onclick={onDisable}
        class="flex h-8 cursor-pointer items-center gap-1.5 rounded border border-red-500/25 bg-red-500/10 px-2.5 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/20 focus-visible:ring-2 focus-visible:ring-red-500/30"
      >
        <PowerOff class="h-3.5 w-3.5" />
        Disable
      </button>
    </div>
  {:else}
    <button
      type="button"
      onclick={enable}
      class="flex h-8 cursor-pointer items-center gap-1.5 rounded border border-orange-500/30 bg-orange-500/10 px-2.5 text-[11px] font-medium text-orange-200 transition-colors hover:bg-orange-500/20 focus-visible:ring-2 focus-visible:ring-orange-500/30"
    >
      <Power class="h-3.5 w-3.5" />
      Enable
    </button>
  {/if}
</SettingRow>

{#if enabled && mountCommand}
  <div class="border-t border-white/8 px-4 py-4">
    <div class="mb-2 flex items-center justify-between gap-3">
      <p class="flex items-center gap-1.5 text-[11px] font-medium text-zinc-300">
        <Link2 class="h-3.5 w-3.5 text-orange-500" />
        Mount command
      </p>
      <button
        type="button"
        onclick={copyMountCommand}
        class="flex h-7 cursor-pointer items-center gap-1.5 rounded border border-white/10 bg-white/[0.035] px-2 text-[10px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500/30"
      >
        <Copy class="h-3 w-3" />
        Copy
      </button>
    </div>
    <textarea
      readonly
      value={mountCommand}
      aria-label="Remote Control mount command"
      class="min-h-20 w-full resize-y rounded border border-white/10 bg-black/25 px-2.5 py-2 font-mono text-[10px] leading-4 text-zinc-300 outline-none selection:bg-orange-500/30 focus:border-orange-500/50"
    ></textarea>
    <p class="mt-2 text-[10px] leading-4 text-zinc-500">
      Run this in a terminal with a new empty folder path. Disable Remote Control to revoke this
      command.
    </p>
  </div>
{/if}
