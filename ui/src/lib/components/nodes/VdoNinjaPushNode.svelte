<script lang="ts">
  import { Settings, X, Video, Info, Dice5, ExternalLink } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { onMount, onDestroy, untrack } from 'svelte';
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { match, P } from 'ts-pattern';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { VdoNinjaPushNode as VdoNinjaPushAudioNode } from '$lib/audio/v2/nodes/VdoNinjaPushNode';
  import { capturePreviewFrame } from '$lib/ai/google';
  import { loadVdoNinjaSdk, createVdoNinjaInstance, type VDONinjaSDK } from '$lib/vdo-ninja/sdk';
  import VdoNinjaParamsInput, { parseVdoNinjaParams } from './VdoNinjaParamsInput.svelte';

  export type VdoNinjaNodeData = {
    room?: string;
    streamId?: string;
    dataOnly?: boolean;
    params?: string;
  };

  type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

  // Generate random alphanumeric IDs (no dashes or special chars)
  const generateRandomId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
      ''
    );
  };

  // Sanitize input to only allow alphanumeric characters
  const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '');

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: VdoNinjaNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  let showSettings = $state(false);
  let connectionStatus = $state<ConnectionStatus>('disconnected');
  let errorMessage = $state('');

  // VDO.Ninja state
  let vdo: VDONinjaSDK | null = $state(null);
  let sdkLoaded = $state(false);

  // Local state
  let room = $state(data.room ?? '');
  let streamId = $state(data.streamId ?? '');
  let dataOnly = $state(data.dataOnly ?? false);
  let params = $state(data.params ?? '');

  let parsedParams = $derived.by(() => parseVdoNinjaParams(params).params);

  // Message context for inlet/outlet communication
  let messageContext: MessageContext;

  // Audio/Video streaming
  let glSystem = GLSystem.getInstance();
  let audioService = AudioService.getInstance();
  let mediaStream: MediaStream | null = null;
  let videoCanvas: HTMLCanvasElement | null = null;
  let videoCtx: CanvasRenderingContext2D | null = null;
  let frameLoopId: number | null = null;
  let audioNode: VdoNinjaPushAudioNode | null = null;
  let isStreaming = $state(false);
  let isStartingStream = false; // Guard against concurrent startStreaming calls

  // Track connected inlets
  let hasVideoInlet = $state(false);
  let hasAudioInlet = $state(false);

  const containerClass = $derived.by(() => {
    const baseClass = selected ? 'object-container-selected' : 'object-container';

    const statusClass = match(connectionStatus)
      .with('connected', () => 'border-green-500')
      .with('error', () => 'border-red-500')
      .with('connecting', () => 'border-yellow-500')
      .otherwise(() => '');

    return [baseClass, statusClass];
  });

  const statusDot = $derived.by(() =>
    match(connectionStatus)
      .with('connected', () => 'bg-green-500')
      .with('error', () => 'bg-red-500')
      .with('connecting', () => 'bg-yellow-500 animate-pulse')
      .otherwise(() => 'bg-zinc-500')
  );

  onMount(async () => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    // Create video canvas for frame capture
    videoCanvas = document.createElement('canvas');
    const [width, height] = glSystem.outputSize;
    videoCanvas.width = width;
    videoCanvas.height = height;
    videoCtx = videoCanvas.getContext('2d');

    // Create audio node for capturing audio from the pipeline
    const node = await audioService.createNode(nodeId, 'vdo.ninja.push');
    if (node && node instanceof VdoNinjaPushAudioNode) {
      audioNode = node;
    }

    // Load VDO.Ninja SDK
    try {
      await loadVdoNinjaSdk();
      sdkLoaded = true;
    } catch (err) {
      connectionStatus = 'error';
      errorMessage = 'Failed to load VDO.Ninja SDK';
      messageContext.send({ type: 'error', message: errorMessage });
    }
  });

  onDestroy(() => {
    disconnect();
    stopStreaming();
    audioService.removeNodeById(nodeId);
    if (messageContext) {
      messageContext.queue.removeCallback(handleMessage);
      messageContext.destroy();
    }
  });

  function handleConnectedEvent() {
    connectionStatus = 'connected';
    messageContext.send({ type: 'connected', room });

    // Start streaming now that we're connected (if not in data-only mode)
    if (!dataOnly) {
      startStreaming();
    }
  }

  function handleErrorEvent(event: CustomEvent) {
    connectionStatus = 'error';
    errorMessage = event.detail?.error?.message ?? 'Connection error';
    messageContext.send({ type: 'error', message: errorMessage });
  }

  async function connect() {
    if (!sdkLoaded) return;
    // In normal mode: need either room or streamId
    // In data-only mode: need room for mesh networking
    if (!dataOnly && !room && !streamId) return;
    if (dataOnly && !room) return;

    disconnect();
    connectionStatus = 'connecting';
    errorMessage = '';

    try {
      vdo = createVdoNinjaInstance();

      // Set up event listeners
      vdo.addEventListener('connected', handleConnectedEvent);
      vdo.addEventListener('data', handleDataEvent);
      vdo.addEventListener('dataReceived', handleDataEvent);
      vdo.addEventListener('track', handleTrackEvent);
      vdo.addEventListener('error', handleErrorEvent);

      if (dataOnly) {
        // Use autoConnect for data-only mode - simpler mesh networking
        await vdo.autoConnect(room || undefined, { streamID: streamId || undefined });
      } else {
        await vdo.connect();

        if (room) {
          await vdo.joinRoom({ room });
          console.log('[push] joined room', room);
        }

        // Announce with streamId (required for others to view)
        if (streamId) {
          await vdo.announce({ streamID: streamId });
          console.log('[push] announced stream id', streamId);
        }

        // startStreaming() is called from handleConnectedEvent() once connection is established
      }

      // Save room/streamId/dataOnly/params to node data
      updateNodeData(nodeId, { room, streamId, dataOnly, params });
    } catch (err) {
      connectionStatus = 'error';
      errorMessage = err instanceof Error ? err.message : 'Connection failed';
      messageContext.send({ type: 'error', message: errorMessage });
    }
  }

  function disconnect() {
    const wasConnected = connectionStatus === 'connected';

    stopStreaming();

    if (vdo) {
      vdo.removeEventListener('connected', handleConnectedEvent);
      vdo.removeEventListener('data', handleDataEvent);
      vdo.removeEventListener('dataReceived', handleDataEvent);
      vdo.removeEventListener('track', handleTrackEvent);
      vdo.removeEventListener('error', handleErrorEvent);
      vdo.disconnect();
      vdo = null;
    }

    connectionStatus = 'disconnected';

    if (wasConnected) {
      messageContext.send({ type: 'disconnected' });
    }
  }

  function handleDataEvent(event: CustomEvent) {
    const { data: receivedData, uuid } = event.detail;

    messageContext.send({ type: 'data', data: receivedData, uuid });
  }

  function handleTrackEvent(event: CustomEvent) {
    const { track, uuid } = event.detail;

    messageContext.send({ type: 'track', kind: track.kind, uuid });
  }

  async function startStreaming() {
    if (!vdo || connectionStatus !== 'connected' || isStreaming || isStartingStream) return;
    isStartingStream = true;

    // Check current inlet connections using getEdges()
    const edges = getEdges();
    const currentHasVideo = edges.some(
      (e) => e.target === nodeId && e.targetHandle?.startsWith('video-in')
    );

    const currentHasAudio = edges.some(
      (e) => e.target === nodeId && e.targetHandle?.startsWith('audio-in')
    );

    hasVideoInlet = currentHasVideo;
    hasAudioInlet = currentHasAudio;

    // Create combined media stream
    mediaStream = new MediaStream();

    // Get audio from the audio node (connected via AudioService edges)
    if (currentHasAudio && audioNode) {
      const audioTracks = audioNode.getAudioTracks();

      if (audioTracks.length > 0) {
        mediaStream.addTrack(audioTracks[0]);
      }
    }

    // Set up video stream from canvas
    if (currentHasVideo && videoCanvas) {
      const videoStream = videoCanvas.captureStream(30); // 30 fps
      const videoTrack = videoStream.getVideoTracks()[0];

      if (videoTrack) {
        mediaStream.addTrack(videoTrack);
      }
    }

    // Publish stream if we have tracks
    if (mediaStream.getTracks().length > 0) {
      try {
        await vdo.publish(mediaStream, {
          streamID: streamId || undefined,
          ...parsedParams
        });

        isStreaming = true;
        messageContext.send({ type: 'streaming', tracks: mediaStream.getTracks().length });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to publish stream';
        // Don't report "already publishing" as an error state - it's expected on reconnect
        if (errMsg.includes('Already publishing')) {
          isStreaming = true; // We're already streaming
        } else {
          errorMessage = errMsg;
          messageContext.send({ type: 'error', message: errMsg });
        }
      }
    }

    // Always start frame capture loop when connected (to detect future inlet connections)
    if (frameLoopId === null) {
      frameLoopId = requestAnimationFrame(captureFrameLoop);
    }

    isStartingStream = false;
  }

  function stopStreaming() {
    if (frameLoopId !== null) {
      cancelAnimationFrame(frameLoopId);
      frameLoopId = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }

    isStreaming = false;
  }

  async function captureFrameLoop() {
    if (connectionStatus !== 'connected') {
      frameLoopId = requestAnimationFrame(captureFrameLoop);
      return;
    }

    // Check if we have incoming video/audio connections using reactive getEdges()
    const edges = getEdges();
    const videoInletEdge = edges.find(
      (e) => e.target === nodeId && e.targetHandle?.startsWith('video-in')
    );
    const audioInletEdge = edges.find(
      (e) => e.target === nodeId && e.targetHandle?.startsWith('audio-in')
    );

    // Update hasVideoInlet state
    const currentHasVideo = !!videoInletEdge;
    if (currentHasVideo !== hasVideoInlet) {
      hasVideoInlet = currentHasVideo;
      // If we just got a video inlet and not streaming, try to start
      if (hasVideoInlet && !isStreaming) {
        await startStreaming();
      }
    }

    // Update hasAudioInlet state and handle late audio connections
    const currentHasAudio = !!audioInletEdge;
    if (currentHasAudio !== hasAudioInlet) {
      const justConnectedAudio = currentHasAudio && !hasAudioInlet;
      hasAudioInlet = currentHasAudio;

      // If audio was just connected and we're already streaming, add audio track
      if (justConnectedAudio && isStreaming && mediaStream && audioNode) {
        // Resume audio context if needed
        const audioContext = audioService.getAudioContext();

        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('[push] resumed audio context');
        }

        // Check if we already have audio tracks
        const existingAudioTracks = mediaStream.getAudioTracks();

        if (existingAudioTracks.length === 0) {
          const audioTracks = audioNode.getAudioTracks();
          if (audioTracks.length > 0) {
            mediaStream.addTrack(audioTracks[0]);
            messageContext.send({ type: 'audio_added' });
            console.log('[push] added audio track to existing stream');
          }
        }
      }

      // If we just got audio inlet and not streaming yet, try to start
      if (justConnectedAudio && !isStreaming) {
        await startStreaming();
      }
    }

    if (!videoInletEdge) {
      frameLoopId = requestAnimationFrame(captureFrameLoop);
      return;
    }

    if (videoInletEdge && videoCanvas && videoCtx) {
      const sourceNodeId = videoInletEdge.source;

      // Capture frame from source node
      const bitmap = await capturePreviewFrame(sourceNodeId, { timeout: 100 });

      if (bitmap && videoCtx) {
        // Resize canvas if needed
        if (videoCanvas.width !== bitmap.width || videoCanvas.height !== bitmap.height) {
          videoCanvas.width = bitmap.width;
          videoCanvas.height = bitmap.height;
        }

        videoCtx.drawImage(bitmap, 0, 0);
        bitmap.close();
      }
    }

    frameLoopId = requestAnimationFrame(captureFrameLoop);
  }

  const handleMessage = (msg: unknown) =>
    match(msg)
      .with(
        { type: 'connect', room: P.optional(P.string), streamId: P.optional(P.string) },
        (m) => {
          if (m.room !== undefined) room = m.room;
          if (m.streamId !== undefined) streamId = m.streamId;

          updateNodeData(nodeId, { room, streamId });
          connect();
        }
      )
      .with({ type: 'disconnect' }, () => {
        disconnect();
      })
      .otherwise((m) => {
        if (vdo && connectionStatus === 'connected') {
          vdo.sendData(m);
        }
      });

  function randomizeStreamId() {
    streamId = 's' + generateRandomId();
  }

  function randomizeRoom() {
    room = 'p' + generateRandomId();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (document.activeElement?.getAttribute('data-room-input')) {
        connect();
      } else {
        showSettings = false;
      }
    } else if (e.key === 'Escape') {
      showSettings = false;
    }
  }

  // Start frame loop when connected (inlet detection happens in the loop)
  // Skip if data only mode
  $effect(() => {
    if (connectionStatus === 'connected' && frameLoopId === null && !dataOnly) {
      frameLoopId = requestAnimationFrame(captureFrameLoop);
    }
  });

  // Track previous dataOnly value to detect actual changes
  let prevDataOnly: boolean | null = null;

  // Handle dataOnly toggle - update node internals, remove stale edges, and reconnect
  $effect(() => {
    // Track dataOnly to trigger effect
    const isDataOnly = dataOnly;

    updateNodeInternals(nodeId);

    // Skip on initial mount
    if (prevDataOnly === null) {
      prevDataOnly = isDataOnly;
      return;
    }

    // Skip if dataOnly hasn't actually changed
    if (prevDataOnly === isDataOnly) {
      return;
    }

    prevDataOnly = isDataOnly;

    // When switching to data-only mode, remove video/audio edges
    if (isDataOnly) {
      const edges = getEdges();
      const staleEdges = edges.filter(
        (e) =>
          e.target === nodeId &&
          (e.targetHandle?.startsWith('video-in') || e.targetHandle?.startsWith('audio-in'))
      );

      if (staleEdges.length > 0) {
        deleteElements({ edges: staleEdges });
      }
    }

    // Reconnect if currently connected to apply new mode
    const wasConnected = untrack(() => connectionStatus === 'connected');

    if (wasConnected) {
      disconnect();
      connect();
    }
  });

  // Save params when changed
  let prevParams: string | null = null;
  $effect(() => {
    if (prevParams === null) {
      prevParams = params;
      return;
    }
    if (prevParams !== params) {
      prevParams = params;
      updateNodeData(nodeId, { params });
    }
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>
        <div>
          <button
            class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showSettings = !showSettings;
            }}
            title="Configure VDO.Ninja"
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      <div class="relative">
        <!-- Message Inlet -->
        <StandardHandle
          port="inlet"
          type="message"
          id="0"
          title="send data to peers"
          total={dataOnly ? 1 : 3}
          index={0}
          class="top-0"
          {nodeId}
        />

        {#if !dataOnly}
          <!-- Video Inlet -->
          <StandardHandle
            port="inlet"
            type="video"
            id="0"
            title="video to stream"
            total={3}
            index={1}
            {nodeId}
          />

          <!-- Audio Inlet -->
          <StandardHandle
            port="inlet"
            type="audio"
            id="0"
            title="audio to stream"
            total={3}
            index={2}
            {nodeId}
          />
        {/if}

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          title={errorMessage || `VDO.Ninja ${connectionStatus}`}
        >
          <div class="flex items-center justify-center gap-2">
            <div class="relative">
              <Video class="h-4 w-4 text-zinc-500" />
            </div>

            <div class="font-mono text-xs text-zinc-300">vdo.ninja.push</div>
          </div>
        </button>

        <!-- Message Outlet -->
        <StandardHandle
          port="outlet"
          type="message"
          id="0"
          title="received data from peers"
          total={1}
          index={0}
          class="bottom-0"
          {nodeId}
        />
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute left-38">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="nodrag ml-2 w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl"
        onkeydown={handleKeydown}
      >
        <div class="space-y-3">
          <!-- Connection Status -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class={['h-2 w-2 rounded-full', statusDot]}></div>
              <span class="text-xs text-zinc-400">
                {match(connectionStatus)
                  .with('connected', () =>
                    room ? `Connected to ${room}` : `Streaming as ${streamId}`
                  )
                  .with('connecting', () => 'Connecting...')
                  .with('error', () => errorMessage || 'Error')
                  .otherwise(() => 'Disconnected')}
              </span>
            </div>

            <!-- Message API hint -->
            <div class="group/info relative">
              <Info class="h-3 w-3 cursor-help text-zinc-500 hover:text-zinc-300" />
              <div
                class="pointer-events-none absolute top-5 right-0 z-50 hidden w-56 rounded border border-zinc-600 bg-zinc-800 p-2 text-[9px] shadow-lg group-hover/info:block"
              >
                <div class="mb-1.5 font-semibold text-zinc-300">Inlet Messages</div>
                <div class="space-y-1 text-zinc-400">
                  <div><span class="text-green-400">connect</span> {`{room?, streamId?}`}</div>
                  <div><span class="text-green-400">disconnect</span></div>
                  <div class="text-zinc-500 italic">other messages → sent to peers</div>
                </div>
                <div class="mt-2 mb-1.5 font-semibold text-zinc-300">Outlet Messages</div>
                <div class="space-y-1 text-zinc-400">
                  <div><span class="text-blue-400">connected</span> {`{room}`}</div>
                  <div><span class="text-blue-400">disconnected</span></div>
                  <div><span class="text-blue-400">data</span> {`{data, uuid}`}</div>
                  <div><span class="text-blue-400">track</span> {`{kind, uuid}`}</div>
                  <div><span class="text-blue-400">error</span> {`{message}`}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Stream ID (only shown in normal mode) -->
          {#if !dataOnly}
            <div>
              <div class="mb-1 flex items-center justify-between">
                <span class="text-[8px] text-zinc-400">Stream ID</span>
                <div class="flex gap-1">
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <button
                        onclick={() =>
                          streamId && window.open(`https://vdo.ninja/?pull=${streamId}`, '_blank')}
                        disabled={!streamId}
                        class="flex cursor-pointer items-center gap-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[8px] text-zinc-300 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ExternalLink class="h-2.5 w-2.5" />
                        View
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>View stream in VDO.Ninja</Tooltip.Content>
                  </Tooltip.Root>
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <button
                        onclick={randomizeStreamId}
                        class="flex cursor-pointer items-center gap-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[8px] text-zinc-300 hover:bg-zinc-600"
                      >
                        <Dice5 class="h-2.5 w-2.5" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Generate random stream ID</Tooltip.Content>
                  </Tooltip.Root>
                </div>
              </div>
              <input
                type="text"
                bind:value={streamId}
                oninput={(e) => (streamId = sanitizeId(e.currentTarget.value))}
                placeholder="mystreamid"
                class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
              />
            </div>
          {/if}

          <!-- Room Name -->
          <div>
            <div class="mb-1 flex items-center justify-between">
              <span class="text-[8px] text-zinc-400">Room Name{dataOnly ? ' (required)' : ''}</span>
              <div class="flex gap-1">
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      onclick={() =>
                        room && window.open(`https://vdo.ninja/?room=${room}`, '_blank')}
                      disabled={!room}
                      class="flex cursor-pointer items-center gap-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[8px] text-zinc-300 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ExternalLink class="h-2.5 w-2.5" />
                      View
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>View room in VDO.Ninja</Tooltip.Content>
                </Tooltip.Root>
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      onclick={randomizeRoom}
                      class="flex cursor-pointer items-center gap-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[8px] text-zinc-300 hover:bg-zinc-600"
                    >
                      <Dice5 class="h-2.5 w-2.5" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Generate random room name</Tooltip.Content>
                </Tooltip.Root>
              </div>
            </div>
            <input
              type="text"
              bind:value={room}
              oninput={(e) => (room = sanitizeId(e.currentTarget.value))}
              data-room-input="true"
              placeholder="myroomname"
              class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <!-- Data Only Toggle -->
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[10px] text-zinc-300">Data Only</span>
              <div class="text-[8px] text-zinc-500">Disable video/audio streaming</div>
            </div>
            <button
              aria-label="Toggle data only mode"
              onclick={() => {
                dataOnly = !dataOnly;
                updateNodeData(nodeId, { dataOnly });
              }}
              class={[
                'relative h-5 w-9 rounded-full transition-colors',
                dataOnly ? 'bg-green-600' : 'bg-zinc-600'
              ]}
            >
              <div
                class={[
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                  dataOnly ? 'translate-x-4' : 'translate-x-0.5'
                ]}
              ></div>
            </button>
          </div>

          <!-- Advanced Parameters (only shown in normal mode) -->
          {#if !dataOnly}
            <VdoNinjaParamsInput bind:value={params} />
          {/if}

          <!-- Streaming Status -->
          {#if connectionStatus === 'connected' && !dataOnly}
            <div class="rounded bg-zinc-800 p-2 text-[10px] text-zinc-400">
              <div class="flex items-center gap-2">
                <div
                  class={['h-1.5 w-1.5 rounded-full', isStreaming ? 'bg-green-500' : 'bg-zinc-500']}
                ></div>
                <span>{isStreaming ? 'Streaming' : 'Not streaming'}</span>
              </div>
              {#if hasVideoInlet || hasAudioInlet}
                <div class="mt-1 text-zinc-500">
                  {[hasVideoInlet && 'video', hasAudioInlet && 'audio'].filter(Boolean).join(' + ')} connected
                </div>
              {:else}
                <div class="mt-1 text-zinc-500">Connect video/audio inlets to stream</div>
              {/if}
            </div>
          {/if}

          <!-- Connect/Disconnect button -->
          <div>
            {#if connectionStatus === 'connected'}
              <button
                onclick={disconnect}
                class="w-full rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500"
              >
                Disconnect
              </button>
            {:else}
              <button
                onclick={connect}
                disabled={!sdkLoaded ||
                  connectionStatus === 'connecting' ||
                  (!dataOnly && !room && !streamId) ||
                  (dataOnly && !room)}
                class="w-full cursor-pointer rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {#if !sdkLoaded}
                  Loading SDK...
                {:else if connectionStatus === 'connecting'}
                  Connecting...
                {:else}
                  Connect
                {/if}
              </button>
            {/if}

            {#if connectionStatus !== 'connected' && !dataOnly && !room && !streamId}
              <div class="mt-2 text-center text-[9px] text-zinc-500">
                Enter a stream id or room name to connect
              </div>
            {:else if connectionStatus !== 'connected' && dataOnly && !room}
              <div class="mt-2 text-center text-[9px] text-zinc-500">
                Enter a room name to connect
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
