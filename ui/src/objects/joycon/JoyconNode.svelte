<script lang="ts">
  import { Crosshair, Gamepad2, Settings, X } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount } from 'svelte';

  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { useNodeDataTracker } from '$lib/history';
  import { MessageContext } from '$lib/messages/MessageContext';

  import { DEFAULT_JOYCON_DATA, type JoyconNodeData } from './constants';
  import { getJoyconReading, type JoyconLiveReading } from './joycon-live';
  import { JoyconObject } from './JoyconObject';
  import { JoyconSystem, joyconAssignments } from './JoyconSystem';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: Partial<JoyconNodeData>;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const tracker = $derived.by(() => useNodeDataTracker(nodeId));
  const system = JoyconSystem.getInstance();
  const isSupported = JoyconSystem.isSupported();

  const METER_RANGE = 90;

  let messageContext: MessageContext | null = null;
  let showSettings = $state(false);
  let errorMessage = $state<string | null>(null);
  let reading = $state<JoyconLiveReading | null>(null);
  let contentWidth = $state(0);

  const settings = $derived({ ...DEFAULT_JOYCON_DATA, ...data });
  const device = $derived($joyconAssignments.get(nodeId));

  const meterPercent = (angle: number) =>
    50 + (Math.max(-METER_RANGE, Math.min(METER_RANGE, angle)) / METER_RANGE) * 50;

  const borderColor = $derived.by(() => {
    if (errorMessage) return 'border-red-500';
    if (device) return 'border-emerald-500';
    if (selected) return 'border-zinc-400';

    return 'border-zinc-600';
  });

  const directionColor = $derived.by(() => {
    if (reading?.direction === 'forward') return 'text-emerald-400';
    if (reading?.direction === 'backward') return 'text-sky-400';

    return 'text-zinc-500';
  });

  async function requestDevices() {
    errorMessage = null;

    try {
      await system.requestDevices();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return;

      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  const sendToRuntime = (message: unknown) =>
    messageContext?.queue.sendMessage({ data: message, source: nodeId });

  function setSetting<K extends keyof JoyconNodeData>(key: K, value: JoyconNodeData[K]) {
    const oldValue = settings[key];

    updateNodeData(nodeId, { [key]: value });
    tracker.commit(key, oldValue, value);
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.messageCallbacks = [() => {}];

    let frame = requestAnimationFrame(function poll() {
      reading = getJoyconReading(nodeId) ?? null;
      frame = requestAnimationFrame(poll);
    });

    return () => {
      cancelAnimationFrame(frame);
      messageContext?.destroy({ unregisterNode: false });
      messageContext = null;
    };
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative" bind:clientWidth={contentWidth}>
    <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
      <div class="node-title-drag-handle z-10 rounded-lg bg-zinc-900 px-2 py-1">
        <div class="font-mono text-xs font-medium text-zinc-400">joycon</div>
      </div>

      <button
        class="node-floating-button"
        aria-label="Joy-Con settings"
        onclick={() => (showSettings = !showSettings)}
      >
        <Settings class="h-4 w-4 text-zinc-300" />
      </button>
    </div>

    <div class="relative">
      <TypedHandle
        port="inlet"
        spec={JoyconObject.inlets[0].handle!}
        title="Control"
        total={1}
        index={0}
        {nodeId}
      />

      <div
        class={[
          'flex w-44 flex-col gap-2 rounded-md border bg-zinc-900 p-3 text-zinc-300',
          borderColor,
          selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
        ]}
      >
        {#if !isSupported}
          <div class="text-[10px] text-red-400">WebHID needs Chrome or Edge on desktop.</div>
        {:else if !device}
          <button
            class="nodrag flex cursor-pointer flex-col items-center gap-1 rounded py-1 text-[10px] text-amber-400 hover:bg-zinc-800"
            onclick={requestDevices}
          >
            <Gamepad2 class="h-4 w-4" />
            Connect Joy-Con
          </button>
        {:else}
          <div class="flex items-center justify-between text-[10px]">
            <span class="truncate text-zinc-400">{device.label}</span>

            <button
              class="nodrag flex cursor-pointer items-center gap-1 rounded px-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              title="Use the current pose as neutral"
              onclick={() => sendToRuntime({ type: 'calibrate' })}
            >
              <Crosshair class="h-3 w-3" />
              zero
            </button>
          </div>

          <div class="relative h-2 rounded bg-zinc-800">
            <div
              class="absolute top-0 h-full w-px bg-zinc-600"
              style="left: {meterPercent(-settings.threshold)}%"
            ></div>

            <div
              class="absolute top-0 h-full w-px bg-zinc-600"
              style="left: {meterPercent(settings.threshold)}%"
            ></div>

            <div
              class="absolute top-[-2px] h-3 w-1 -translate-x-1/2 rounded bg-zinc-200"
              style="left: {meterPercent(reading?.angle ?? 0)}%"
            ></div>
          </div>

          <div class="flex items-center justify-between font-mono text-[10px]">
            <span class={directionColor}>
              {reading?.calibrating ? 'calibrating' : (reading?.direction ?? 'waiting')}
            </span>

            <span class="text-zinc-500">
              {(reading?.angle ?? 0).toFixed(0)}° {reading?.axis ?? ''}
            </span>
          </div>
        {/if}

        {#if errorMessage}
          <div class="text-[10px] text-red-400">{errorMessage}</div>
        {/if}
      </div>

      <TypedHandle
        port="outlet"
        spec={JoyconObject.outlets[0].handle!}
        title="Raw motion"
        total={2}
        index={0}
        {nodeId}
      />

      <TypedHandle
        port="outlet"
        spec={JoyconObject.outlets[1].handle!}
        title="Leg moves and connection events"
        total={2}
        index={1}
        {nodeId}
      />
    </div>
  </div>

  {#if showSettings}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end">
        <button
          aria-label="Close Joy-Con settings"
          onclick={() => (showSettings = false)}
          class="cursor-pointer rounded p-1 hover:bg-zinc-700"
        >
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div
        class="nodrag w-56 space-y-3 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl"
      >
        <label class="block text-xs text-zinc-300">
          <span class="mb-1 block font-medium">Device</span>

          <select
            class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
            value={settings.device}
            onchange={(e) =>
              setSetting('device', e.currentTarget.value as JoyconNodeData['device'])}
          >
            <option value="any">Any Joy-Con</option>
            <option value="left">Left Joy-Con</option>
            <option value="right">Right Joy-Con</option>
          </select>
        </label>

        <label class="block text-xs text-zinc-300">
          <span class="mb-1 block font-medium">Swing axis</span>

          <select
            class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
            value={settings.axis}
            onchange={(e) => setSetting('axis', e.currentTarget.value as JoyconNodeData['axis'])}
          >
            <option value="auto">Auto</option>
            <option value="x">X</option>
            <option value="y">Y</option>
            <option value="z">Z</option>
          </select>
        </label>

        <label class="block text-xs text-zinc-300">
          <span class="mb-1 flex justify-between font-medium">
            Threshold
            <span class="font-mono text-zinc-500">{settings.threshold}°</span>
          </span>

          <input
            type="range"
            min="5"
            max="60"
            step="1"
            class="w-full"
            value={settings.threshold}
            onchange={(e) => setSetting('threshold', Number(e.currentTarget.value))}
          />
        </label>

        <label class="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={settings.invert}
            onchange={(e) => setSetting('invert', e.currentTarget.checked)}
          />
          Invert forward/backward
        </label>

        <button
          class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          onclick={requestDevices}
        >
          <Gamepad2 class="h-3 w-3" />
          Pair another Joy-Con
        </button>
      </div>
    </div>
  {/if}
</div>
