<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { match } from 'ts-pattern';
  import { Type } from '@sinclair/typebox';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { BufferBridgeService } from '$lib/audio/buffer-bridge';
  import { messages } from '$lib/objects/schemas';
  import { msg, sym } from '$lib/objects/schemas/helpers';
  import { schema } from '$lib/objects/schemas/types';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import { Eye, EyeOff } from '@lucide/svelte/icons';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { bufferName: string; size: number; showVisual: boolean };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const bridge = BufferBridgeService.getInstance();

  let messageContext: MessageContext;
  let canvas = $state<HTMLCanvasElement | undefined>();
  let rafId: number | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const bufferName = $derived(data.bufferName || nodeId);
  const bufferSize = $derived(data.size || 100);
  const showVisual = $derived(data.showVisual ?? false);

  const containerClass = $derived(
    selected
      ? 'border-zinc-400 bg-zinc-800/80 shadow-glow-md'
      : 'border-zinc-700 bg-zinc-900/80 hover:shadow-glow-sm'
  );

  // --- Message schemas (mirroring TableObject.ts) ---
  const TableSet = msg('set', { index: Type.Number(), value: Type.Number() });
  const TableGet = msg('get', { index: Type.Number() });
  const TableResize = msg('resize', { length: Type.Number() });
  const TableClear = sym('clear');
  const TableNormalize = sym('normalize');

  const tableMessages = {
    set: schema(TableSet),
    get: schema(TableGet),
    resize: schema(TableResize),
    clear: schema(TableClear),
    normalize: schema(TableNormalize)
  };

  const handleMessage: MessageCallbackFn = (message) => {
    if (message instanceof Float32Array) {
      bridge.writeBuffer(bufferName, message);
      updateNodeData(nodeId, { ...data, size: message.length });
      return;
    }

    match(message)
      .with(messages.bang, () => {
        const buf = bridge.readBuffer(bufferName);
        if (buf) {
          messageContext.send(new Float32Array(buf));
        } else {
          bridge.readBufferAsync(bufferName).then((asyncBuf) => {
            if (asyncBuf) messageContext.send(new Float32Array(asyncBuf));
          });
        }
      })
      .with(tableMessages.set, ({ index, value }) => {
        bridge.setBufferSample(bufferName, index, value);
      })
      .with(tableMessages.get, ({ index }) => {
        bridge.readBufferAsync(bufferName).then((buf) => {
          if (!buf) return;
          const len = buf.length;
          const wrapped = ((index % len) + len) % len;
          messageContext.send({ type: 'get', index, value: buf[wrapped] });
        });
      })
      .with(tableMessages.resize, ({ length }) => {
        if (length > 0) {
          const rounded = Math.round(length);
          bridge.resizeBuffer(bufferName, rounded);
          updateNodeData(nodeId, { ...data, size: rounded });
        }
      })
      .with(tableMessages.clear, () => {
        bridge.clearBuffer(bufferName);
      })
      .with(tableMessages.normalize, () => {
        bridge.readBufferAsync(bufferName).then((buf) => {
          if (!buf) return;
          let maxAbs = 0;
          for (let i = 0; i < buf.length; i++) {
            const abs = Math.abs(buf[i]);
            if (abs > maxAbs) maxAbs = abs;
          }
          if (maxAbs > 0) {
            const scale = 1 / maxAbs;
            const normalized = new Float32Array(buf.length);
            for (let i = 0; i < buf.length; i++) normalized[i] = buf[i] * scale;
            bridge.writeBuffer(bufferName, normalized);
          }
        });
      })
      .otherwise(() => {});
  };

  // --- Canvas rendering ---
  const CANVAS_W = 200;
  const CANVAS_H = 60;

  function drawWaveform(buf: Float32Array) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mid = CANVAS_H / 2;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Zero line
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(CANVAS_W, mid);
    ctx.stroke();

    if (buf.length === 0) return;

    // Min/max envelope per pixel column
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let px = 0; px < CANVAS_W; px++) {
      const start = Math.floor((px / CANVAS_W) * buf.length);
      const end = Math.max(start + 1, Math.floor(((px + 1) / CANVAS_W) * buf.length));
      let min = 0,
        max = 0;
      for (let i = start; i < end; i++) {
        const v = buf[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const yMax = mid - max * (mid - 2);
      const yMin = mid - min * (mid - 2);
      if (px === 0) ctx.moveTo(px + 0.5, yMax);
      ctx.lineTo(px + 0.5, yMax);
      ctx.lineTo(px + 0.5, yMin);
    }

    ctx.stroke();
  }

  function startVisualization() {
    if (bridge.isSharedMemory) {
      // SAB: live zero-copy reads via RAF
      function loop() {
        const buf = bridge.readBuffer(bufferName);
        if (buf) drawWaveform(buf);
        rafId = requestAnimationFrame(loop);
      }
      rafId = requestAnimationFrame(loop);
    } else {
      // non-SAB: async polling at ~10 fps
      pollTimer = setInterval(() => {
        bridge.readBufferAsync(bufferName).then((buf) => {
          if (buf) drawWaveform(buf);
        });
      }, 100);
    }
  }

  function stopVisualization() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  $effect(() => {
    if (showVisual) {
      startVisualization();
    } else {
      stopVisualization();
    }
    return () => stopVisualization();
  });

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    if (!bridge.getBufferInfo(bufferName)) {
      bridge.createBuffer(bufferName, bufferSize);
    }
  });

  onDestroy(() => {
    stopVisualization();
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    if (bufferName) bridge.deleteBuffer(bufferName);
  });
</script>

<ContextMenu.Root>
  <ContextMenu.Trigger>
    <div class="relative flex gap-x-3">
      <div class="relative">
        <StandardHandle
          port="inlet"
          type="message"
          title="Commands (bang, set, get, resize, clear, normalize, Float32Array)"
          total={1}
          index={0}
          {nodeId}
        />

        {#if showVisual}
          <div class={['rounded-lg border', selected ? 'border-zinc-400' : 'border-zinc-700']}>
            <div class="px-2 pt-1.5 pb-1 font-mono text-[10px] text-zinc-500">
              {bufferName}
              <span class="text-zinc-600">({bufferSize})</span>
            </div>
            <canvas bind:this={canvas} width={CANVAS_W} height={CANVAS_H} class="block rounded-b-lg"
            ></canvas>
          </div>
        {:else}
          <div class={['w-fit cursor-default rounded-lg border px-3 py-2', containerClass]}>
            <span class="font-mono text-xs text-zinc-200">table</span>
            <span class="ml-1.5 font-mono text-xs text-zinc-400">{bufferName}</span>
            <span class="ml-1 font-mono text-xs text-zinc-600">{bufferSize}</span>
          </div>
        {/if}

        <StandardHandle
          port="outlet"
          type="message"
          title="Float32Array output (on bang) or get result"
          total={1}
          index={0}
          {nodeId}
        />
      </div>
    </div>
  </ContextMenu.Trigger>

  <ContextMenu.Content>
    <ContextMenu.Item onclick={() => updateNodeData(nodeId, { ...data, showVisual: !showVisual })}>
      {#if showVisual}
        <EyeOff class="mr-2 h-4 w-4" />
        Hide Visualizer
      {:else}
        <Eye class="mr-2 h-4 w-4" />
        Show Visualizer
      {/if}
    </ContextMenu.Item>
  </ContextMenu.Content>
</ContextMenu.Root>
