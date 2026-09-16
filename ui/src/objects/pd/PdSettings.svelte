<script lang="ts">
  import { X } from '@lucide/svelte/icons';
  import type { PdPort, PdPortKind } from './pd-patch';

  type Props = {
    path: string;
    ports: PdPort[];
    exposedPortIds: string[];
    loading: boolean;
    onPathChange: (value: string) => void;
    onLoad: () => void;
    onTogglePort: (portId: string) => void;
    onClose: () => void;
  };

  let { path, ports, exposedPortIds, loading, onPathChange, onLoad, onTogglePort, onClose }: Props =
    $props();

  const groups: Array<{ kind: PdPortKind; label: string }> = [
    { kind: 'message-in', label: 'Message inlets' },
    { kind: 'audio-in', label: 'Audio inlets' },
    { kind: 'message-out', label: 'Message outlets' },
    { kind: 'audio-out', label: 'Audio outlets' }
  ];
</script>

<div class="relative">
  <div class="absolute -top-7 right-0">
    <button
      type="button"
      class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
      aria-label="Close settings"
      onclick={onClose}
    >
      <X class="h-4 w-4" />
    </button>
  </div>

  <div
    class="nodrag nowheel max-h-[min(27rem,calc(100dvh-8rem))] w-64 overflow-y-auto rounded-md border border-zinc-600 bg-zinc-900 p-3 shadow-xl"
  >
    <label class="mb-1 block text-xs font-medium text-zinc-300" for="pd-path">Patch</label>

    <div class="flex gap-1.5">
      <input
        id="pd-path"
        class="h-8 min-w-0 flex-1 rounded bg-zinc-800 px-2 font-mono text-[11px] text-zinc-200 outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-zinc-500"
        value={path}
        placeholder="patch://pd/main.pd"
        oninput={(event) => onPathChange(event.currentTarget.value)}
        onkeydown={(event) => {
          if (event.key === 'Enter') onLoad();
        }}
      />
      <button
        type="button"
        class="h-8 cursor-pointer rounded bg-zinc-800 px-2.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={loading || !path.trim()}
        onclick={onLoad}
      >
        {loading ? 'Loading…' : 'Load'}
      </button>
    </div>

    {#if ports.length > 0}
      <div class="mt-3 space-y-3 border-t border-zinc-700 pt-3">
        <div class="text-xs font-medium text-zinc-300">Exposed ports</div>

        {#each groups as group (group.kind)}
          {@const groupPorts = ports.filter((port) => port.kind === group.kind)}
          {#if groupPorts.length > 0}
            <fieldset>
              <legend class="mb-1 text-[10px] text-zinc-500">{group.label}</legend>
              <div class="space-y-1">
                {#each groupPorts as port (port.id)}
                  <label class="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      class="h-3 w-3 cursor-pointer"
                      checked={exposedPortIds.includes(port.id)}
                      onchange={() => onTogglePort(port.id)}
                    />
                    <span class="truncate font-mono">{port.label}</span>
                    {#if port.source === 'named'}
                      <span class="ml-auto text-[9px] text-zinc-500">named</span>
                    {/if}
                  </label>
                {/each}
              </div>
            </fieldset>
          {/if}
        {/each}

        <p class="text-[10px] leading-4 text-zinc-500">
          Stereo uses the first two selected audio ports.
        </p>
      </div>
    {/if}
  </div>
</div>
