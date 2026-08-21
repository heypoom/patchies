<script lang="ts">
  import {
    Check,
    ChevronDown,
    Copy,
    FolderPlus,
    Power,
    PowerOff,
    Terminal
  } from '@lucide/svelte/icons';
  import { toast } from 'svelte-sonner';

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

  let copied = $state(false);

  async function enable() {
    try {
      await onEnable();
      copied = false;
      toast.success('Remote Control enabled');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not enable Remote Control');
    }
  }

  async function copyMountCommand() {
    if (!mountCommand) return;

    try {
      await navigator.clipboard.writeText(mountCommand);
      copied = true;
      toast.success('Mount command copied');
    } catch {
      toast.error('Could not copy the mount command');
    }
  }

  function revoke() {
    onDisable();
    copied = false;
    toast.success('Remote Control revoked');
  }
</script>

{#if enabled}
  <div class="px-4 py-4 sm:px-5">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p
          class="flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-zinc-400 uppercase"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-zinc-500"></span>
          Local mount active
        </p>
        <p class="mt-1 text-[12px] leading-5 text-zinc-400">
          The Patchies CLI can sync supported code in this patch.
        </p>
      </div>
      <button
        type="button"
        onclick={revoke}
        class="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/10 px-3 text-[12px] font-medium text-zinc-400 transition-colors hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-200 focus-visible:ring-2 focus-visible:ring-zinc-500/50"
      >
        <PowerOff class="h-3.5 w-3.5" />
        Revoke access
      </button>
    </div>
  </div>

  {#if mountCommand}
    <div class="border-t border-white/8 px-4 py-4 sm:px-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-[13px] font-medium text-zinc-100">
            <Terminal class="h-4 w-4 text-zinc-500" />
            Copy the mount command
          </p>
          <p class="mt-1 text-[12px] leading-5 text-zinc-400">
            Paste it in Terminal, then replace
            <code class="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-zinc-200"
              >&lt;new-folder-path&gt;</code
            >
            with an empty folder.
          </p>
        </div>
        <button
          type="button"
          onclick={copyMountCommand}
          class="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] hover:text-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-500/50"
        >
          {#if copied}
            <Check class="h-3.5 w-3.5" />
            Copied
          {:else}
            <Copy class="h-3.5 w-3.5" />
            Copy command
          {/if}
        </button>
      </div>

      <details class="group mt-4 rounded-md border border-white/8 bg-black/15">
        <summary
          class="flex h-9 cursor-pointer list-none items-center justify-between px-3 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.035] hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-500/50"
        >
          View full command
          <ChevronDown class="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <pre
          aria-label="Remote Control mount command"
          class="max-h-40 overflow-auto border-t border-white/8 px-3 py-3 font-mono text-[11px] leading-5 break-all whitespace-pre-wrap text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 focus-visible:ring-inset">{mountCommand}</pre>
      </details>

      <p class="mt-3 flex items-start gap-2 text-[11px] leading-4 text-zinc-500">
        <FolderPlus class="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
        Keep this command private. Revoking access immediately invalidates it and disconnects the local
        client.
      </p>
    </div>
  {/if}
{:else}
  <div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
    <div class="min-w-0">
      <p class="text-[13px] font-medium text-zinc-100">Create a local mount</p>
      <p class="mt-1 text-[12px] leading-5 text-zinc-400">
        Edit supported code in your local editor and sync it back to this patch.
      </p>
    </div>
    <button
      type="button"
      onclick={enable}
      class="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] hover:text-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-500/50"
    >
      <Power class="h-3.5 w-3.5" />
      Enable local mount
    </button>
  </div>
{/if}
