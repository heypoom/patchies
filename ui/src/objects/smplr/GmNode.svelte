<script lang="ts">
  import { Settings } from '@lucide/svelte/icons';
  import { onDestroy, onMount } from 'svelte';
  import { useSvelteFlow, type NodeProps } from '@xyflow/svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { GM_DEFAULT_SETTINGS, GM_SETTINGS_SCHEMA } from './gm-settings';
  import type { GmAudioNode, GmMonitorSnapshot, GmRuntimeStatus } from './GmAudioNode';

  type GmNodeData = {
    settings?: Record<string, unknown>;
    settingsSchema?: typeof GM_SETTINGS_SCHEMA;
  };

  let node: NodeProps & { data: GmNodeData } = $props();

  const CHANNEL_COLORS = [
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#10b981',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#14b8a6',
    '#d946ef',
    '#ec4899',
    '#e879f9',
    '#f87171',
    '#f9a8d4',
    '#d9f99d'
  ];

  const { updateNodeData } = useSvelteFlow();
  const audioService = AudioService.getInstance();

  let messageContext: MessageContext | null = null;
  let runtimeNode: GmAudioNode | null = null;
  let disposed = false;
  let showSettings = $state(false);
  let status = $state<GmRuntimeStatus>({ state: 'idle' });
  let monitor = $state<GmMonitorSnapshot>({ channels: createInitialMonitorChannels() });
  let settings = $derived<Record<string, unknown>>({
    ...GM_DEFAULT_SETTINGS,
    ...(node.data.settings ?? {})
  });

  const handleMessage: MessageCallbackFn = (message) => {
    audioService.send(node.id, 'message', message);
  };

  function persistSettings(nextSettings: Record<string, unknown>) {
    settings = nextSettings;

    updateNodeData(node.id, {
      settings: nextSettings,
      settingsSchema: GM_SETTINGS_SCHEMA
    });
  }

  async function applySettings(nextSettings: Record<string, unknown>) {
    persistSettings(nextSettings);
    await audioService.send(node.id, 'settings', nextSettings);
  }

  async function updateSetting(key: string, value: unknown) {
    const nextSettings = { ...settings, [key]: value };
    await applySettings(nextSettings);
  }

  async function revertSettings() {
    await applySettings(GM_DEFAULT_SETTINGS);
  }

  function createInitialMonitorChannels(): GmMonitorSnapshot['channels'] {
    return Array.from({ length: 16 }, (_, index) => ({
      channel: index + 1,
      program: 0,
      instrumentName: 'acoustic_grand_piano',
      activeNotes: 0,
      status: 'idle',
      activity: 0
    }));
  }

  onMount(async () => {
    disposed = false;
    messageContext = new MessageContext(node.id);
    messageContext.queue.addCallback(handleMessage);

    if (!node.data.settings || !node.data.settingsSchema) {
      persistSettings(settings);
    }

    await audioService.createNode(node.id, 'gm~', []);

    if (disposed) {
      audioService.removeNodeById(node.id);
      return;
    }

    runtimeNode = audioService.getNodeById(node.id) as GmAudioNode | null;

    if (runtimeNode) {
      runtimeNode.onStatusChange = (nextStatus) => {
        status = nextStatus;
      };

      runtimeNode.onMonitorChange = (snapshot) => {
        monitor = snapshot;
      };
    }

    audioService.send(node.id, 'settings', settings);

    if (disposed) {
      audioService.removeNodeById(node.id);
      return;
    }

    monitor = runtimeNode?.getMonitorSnapshot() ?? monitor;
  });

  onDestroy(() => {
    disposed = true;
    runtimeNode = null;

    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    audioService.removeNodeById(node.id);
  });
</script>

<div class="relative w-[24rem]">
  <div class="absolute -top-7 left-0 z-10 rounded-lg bg-black/60 px-2 py-1">
    <div
      class={[
        'node-title-drag-handle max-w-72 truncate font-mono text-xs font-medium',
        status.state === 'error' ? 'text-red-300' : 'text-zinc-400'
      ]}
    >
      gm~
    </div>
  </div>

  <div class="absolute -top-7 right-0 z-10">
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class="node-floating-button !opacity-100"
          aria-label="Settings"
          onclick={() => (showSettings = !showSettings)}
        >
          <Settings class="h-4 w-4 text-zinc-300" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>Settings</Tooltip.Content>
    </Tooltip.Root>
  </div>

  <div class="relative">
    <StandardHandle
      port="inlet"
      type="message"
      title="Channel-aware MIDI messages"
      total={1}
      index={0}
      nodeId={node.id}
    />

    <div
      class={[
        'grid grid-cols-4 overflow-hidden rounded border bg-zinc-950/70 shadow-sm',
        node.selected ? 'border-zinc-400' : 'border-zinc-800/80'
      ]}
    >
      {#each monitor.channels as channel, index (channel.channel)}
        <div
          class={[
            'channel-cell relative min-w-0 overflow-hidden border-zinc-800/70 px-2 py-1.5',
            channel.status === 'error'
              ? 'bg-red-950/20'
              : channel.activeNotes > 0
                ? 'bg-zinc-900/80'
                : 'bg-zinc-950/20'
          ]}
          style={`--channel-color: ${CHANNEL_COLORS[index]}`}
        >
          {#key channel.activity}
            <div class="activity-pulse"></div>
          {/key}

          <div class="relative flex min-w-0 items-center gap-1.5">
            <span
              class={[
                'activity-dot',
                channel.activeNotes > 0 || channel.activity > 0 ? 'opacity-100' : 'opacity-25'
              ]}
            ></span>
            <span class="font-mono text-[9px] text-zinc-600">
              {String(channel.channel).padStart(2, '0')}
            </span>
            <span class="truncate font-mono text-[9px] text-zinc-700">
              P{String(channel.program).padStart(3, '0')}
            </span>
            <span
              class={[
                'ml-auto font-mono text-[9px]',
                channel.activeNotes > 0 ? 'text-zinc-200' : 'text-zinc-700'
              ]}
            >
              {channel.activeNotes > 0 ? channel.activeNotes : ''}
            </span>
          </div>

          <div
            class={[
              'relative mt-1 min-w-0 truncate font-mono text-[10px]',
              channel.activeNotes > 0 ? 'text-zinc-100' : 'text-zinc-400'
            ]}
          >
            {channel.instrumentName}
          </div>

          {#if channel.status !== 'ready' && channel.status !== 'idle'}
            <div
              class={[
                'relative mt-0.5 truncate font-mono text-[9px]',
                channel.status === 'error' ? 'text-red-300' : 'text-amber-300'
              ]}
            >
              {channel.status}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <StandardHandle
      port="outlet"
      type="audio"
      title="Audio output"
      total={1}
      index={0}
      nodeId={node.id}
    />
  </div>

  {#if showSettings}
    <div class="absolute top-0 left-full z-20 ml-3">
      <ObjectSettings
        nodeId={node.id}
        schema={GM_SETTINGS_SCHEMA}
        values={settings}
        onValueChange={updateSetting}
        onRevertAll={revertSettings}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}
</div>

<style>
  .channel-cell {
    min-height: 3.1rem;
  }

  .channel-cell:not(:nth-child(4n)) {
    border-right-width: 1px;
  }

  .channel-cell:nth-child(-n + 12) {
    border-bottom-width: 1px;
  }

  .activity-dot {
    width: 0.3125rem;
    height: 0.3125rem;
    flex: none;
    border-radius: 9999px;
    background: var(--channel-color);
    box-shadow: 0 0 5px color-mix(in srgb, var(--channel-color) 45%, transparent);
  }

  .activity-pulse {
    pointer-events: none;
    position: absolute;
    inset: auto 0 0 0;
    height: 1px;
    background: var(--channel-color);
    opacity: 0;
    animation: channel-pulse 260ms ease-out both;
  }

  @keyframes channel-pulse {
    from {
      opacity: 0.85;
    }
    to {
      opacity: 0;
    }
  }
</style>
