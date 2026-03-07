<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { match } from 'ts-pattern';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { BufferBridgeService } from '$lib/audio/buffer-bridge';
  import { setupDprCanvas, drawWaveform } from '$lib/canvas/waveform-renderer';
  import { useWaveformZoom } from '$lib/canvas/use-waveform-zoom.svelte';
  import {
    messages,
    TableSet,
    TableGet,
    TableResize,
    TableClear,
    TableNormalize
  } from '$lib/objects/schemas';
  import { schema } from '$lib/objects/schemas/types';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Eye, EyeOff } from '@lucide/svelte/icons';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { useVfsMedia } from '$lib/vfs';
  import { VfsRelinkOverlay } from '$lib/vfs/components';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { bufferName: string; size: number; showVisual: boolean; vfsPath?: string };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const bridge = BufferBridgeService.getInstance();

  let messageContext: MessageContext;
  let canvas = $state<HTMLCanvasElement | undefined>();
  let rafId: number | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  let isEditing = $state(false);
  let editValue = $state('');
  let inputElement = $state<HTMLInputElement | undefined>();

  const bufferName = $derived(data.bufferName || nodeId);
  const bufferSize = $derived(data.size || 100);
  const showVisual = $derived(data.showVisual ?? false);

  const textualContainerClass = $derived(
    selected
      ? 'border-zinc-400 bg-zinc-800/80 shadow-glow-md'
      : 'border-zinc-700 bg-zinc-900/80 hover:shadow-glow-sm'
  );

  // --- VFS source loading ---

  async function handleFileLoaded(file: File, sourceUrl?: string) {
    let arrayBuffer: ArrayBuffer;

    if (sourceUrl) {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      arrayBuffer = await response.arrayBuffer();
    } else {
      arrayBuffer = await file.arrayBuffer();
    }

    const audioCtx = AudioService.getInstance().getAudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Mono mix
    const length = audioBuffer.length;
    const channelCount = audioBuffer.numberOfChannels;
    const samples = new Float32Array(length);
    for (let ch = 0; ch < channelCount; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) samples[i] += channelData[i];
    }
    if (channelCount > 1) {
      for (let i = 0; i < length; i++) samples[i] /= channelCount;
    }

    bridge.writeBuffer(bufferName, samples);
    updateNodeData(nodeId, { ...data, size: length });
    vfsMedia.markLoaded();
  }

  const vfsMedia = useVfsMedia({
    nodeId,
    acceptMimePrefix: 'audio/',
    onFileLoaded: handleFileLoaded,
    updateNodeData: (d) => updateNodeData(nodeId, { ...data, ...d }),
    getVfsPath: () => data.vfsPath,
    filePickerAccept: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
    filePickerDescription: 'Audio Files'
  });

  // --- Editing ---

  function enterEditingMode() {
    editValue = `${bufferName} ${bufferSize}`;
    isEditing = true;
    setTimeout(() => inputElement?.focus(), 10);
  }

  async function exitEditingMode(save: boolean) {
    isEditing = false;
    if (!save) return;

    const parts = editValue.trim().split(/\s+/);
    const newName = parts[0] || bufferName;
    const newSize = parts[1] ? Math.max(1, Math.round(Number(parts[1]))) : bufferSize;
    const validSize = !isNaN(newSize) && newSize > 0 ? newSize : bufferSize;

    const nameChanged = newName !== bufferName;
    const sizeChanged = validSize !== bufferSize;

    if (!nameChanged && !sizeChanged) return;

    if (nameChanged) {
      const oldData = await bridge.readBufferAsync(bufferName);
      bridge.createBuffer(newName, validSize);
      if (oldData) bridge.writeBuffer(newName, oldData);
      bridge.deleteBuffer(bufferName);
    } else if (sizeChanged) {
      bridge.resizeBuffer(bufferName, validSize);
    }

    updateNodeData(nodeId, { ...data, bufferName: newName, size: validSize });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      exitEditingMode(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      exitEditingMode(false);
    }
  }

  function handleBlur() {
    if (!isEditing) return;
    setTimeout(() => exitEditingMode(true), 150);
  }

  // --- Message handling ---

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
      // Programmatic write — detach from VFS source
      updateNodeData(nodeId, { ...data, size: message.length, vfsPath: undefined });
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
        bridge.readBufferAsync(bufferName).then((buffer) => {
          if (!buffer) return;
          let maxAbs = 0;
          for (let i = 0; i < buffer.length; i++) {
            const abs = Math.abs(buffer[i]);
            if (abs > maxAbs) maxAbs = abs;
          }
          if (maxAbs > 0) {
            const scale = 1 / maxAbs;
            const normalized = new Float32Array(buffer.length);
            for (let i = 0; i < buffer.length; i++) normalized[i] = buffer[i] * scale;
            bridge.writeBuffer(bufferName, normalized);
          }
        });
      })
      .otherwise(() => {});
  };

  // --- Canvas rendering ---
  const CANVAS_W = 200;
  const CANVAS_H = 60;

  const zoom = useWaveformZoom();

  function startVisualization() {
    if (bridge.isSharedMemory) {
      function loop() {
        const buffer = bridge.readBuffer(bufferName);
        if (canvas && buffer) drawWaveform(canvas, buffer, zoom.view);
        rafId = requestAnimationFrame(loop);
      }
      rafId = requestAnimationFrame(loop);
    } else {
      pollTimer = setInterval(() => {
        bridge.readBufferAsync(bufferName).then((buf) => {
          if (canvas && buf) drawWaveform(canvas, buf, zoom.view);
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
    if (canvas) setupDprCanvas(canvas, CANVAS_W, CANVAS_H);
  });

  $effect(() => {
    if (showVisual) {
      startVisualization();
    } else {
      stopVisualization();
    }
    return () => stopVisualization();
  });

  onMount(async () => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    if (!bridge.getBufferInfo(bufferName)) {
      bridge.createBuffer(bufferName, bufferSize);
    }

    if (data.vfsPath) {
      await vfsMedia.loadFromVfsPath(data.vfsPath);
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

        {#if isEditing}
          <div class={['w-fit rounded-lg border', textualContainerClass]}>
            <input
              bind:this={inputElement}
              bind:value={editValue}
              onkeydown={handleKeydown}
              onblur={handleBlur}
              placeholder="name size"
              class="nodrag bg-transparent px-3 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none"
            />
          </div>
        {:else if showVisual}
          <div
            class={[
              'rounded-lg border bg-zinc-950',
              selected ? 'border-zinc-700' : 'border-zinc-800'
            ]}
            ondblclick={enterEditingMode}
            ondragover={vfsMedia.handleDragOver}
            ondragleave={vfsMedia.handleDragLeave}
            ondrop={vfsMedia.handleDrop}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && enterEditingMode()}
          >
            <div class="px-2 pt-1.5 pb-1 font-mono text-[10px] text-zinc-500">
              {bufferName}

              <span class="text-zinc-600">({bufferSize})</span>
            </div>

            {#if vfsMedia.needsFolderRelink || vfsMedia.needsReselect}
              <VfsRelinkOverlay
                needsReselect={vfsMedia.needsReselect}
                needsFolderRelink={vfsMedia.needsFolderRelink}
                linkedFolderName={vfsMedia.linkedFolderName}
                vfsPath={data.vfsPath}
                width={CANVAS_W}
                height={CANVAS_H}
                isDragging={vfsMedia.isDragging}
                onRequestPermission={vfsMedia.requestFilePermission}
                onDragOver={vfsMedia.handleDragOver}
                onDragLeave={vfsMedia.handleDragLeave}
                onDrop={vfsMedia.handleDrop}
              />
            {:else}
              <canvas
                bind:this={canvas}
                class="nowheel block rounded-b-lg"
                onwheel={zoom.handleWheel}
              ></canvas>
            {/if}
          </div>
        {:else}
          <div
            class={[
              'w-fit cursor-pointer rounded-lg border px-3 pt-0.5 pb-1.5',
              vfsMedia.isDragging ? 'border-blue-400 bg-blue-50/10' : textualContainerClass
            ]}
            ondblclick={enterEditingMode}
            ondragover={vfsMedia.handleDragOver}
            ondragleave={vfsMedia.handleDragLeave}
            ondrop={vfsMedia.handleDrop}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && enterEditingMode()}
          >
            {#if vfsMedia.isDragging}
              <span class="font-mono text-xs text-blue-400">Drop audio file</span>
            {:else}
              <span class="font-mono text-xs text-zinc-200">table</span>

              <Tooltip.Root>
                <Tooltip.Trigger>
                  <span
                    class="ml-0.5 font-mono text-xs text-zinc-400 underline-offset-2 hover:text-blue-500 hover:underline"
                  >
                    {bufferName}
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Content>
                  <p class="font-semibold">Buffer name</p>
                  <p class="text-xs text-zinc-500">Reference with tabread~, tabwrite~, tabosc4~</p>
                </Tooltip.Content>
              </Tooltip.Root>

              <Tooltip.Root>
                <Tooltip.Trigger>
                  <span
                    class="ml-0.5 font-mono text-xs text-zinc-400 underline-offset-2 hover:text-yellow-500 hover:underline"
                  >
                    {bufferSize}
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Content>
                  <p class="font-semibold">Size</p>
                  <p class="text-xs text-zinc-500">{bufferSize} samples</p>
                </Tooltip.Content>
              </Tooltip.Root>
            {/if}
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

<!-- Hidden file input -->
<input
  bind:this={vfsMedia.fileInputRef}
  type="file"
  accept="audio/*"
  onchange={vfsMedia.handleFileSelect}
  class="hidden"
/>
