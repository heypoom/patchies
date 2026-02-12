<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas/common';
  import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import type {
    NodePortCountUpdateEvent,
    NodeTitleUpdateEvent,
    NodeHidePortsUpdateEvent,
    NodeInteractionUpdateEvent,
    NodeVideoOutputEnabledUpdateEvent,
    ConsoleOutputEvent
  } from '$lib/eventbus/events';
  import { logger } from '$lib/utils/logger';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title: string;
      code: string;
      messageInletCount?: number;
      messageOutletCount?: number;
      videoInletCount?: number;
      videoOutletCount?: number;
      hidePorts?: boolean;
      executeCode?: number;
      showConsole?: boolean;
    };
    selected?: boolean;
  } = $props();

  let consoleRef: VirtualConsole | null = $state(null);

  // Track error line numbers for code highlighting
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);
  const eventBus = PatchiesEventBus.getInstance();

  // Listen for console output events to capture lineErrors
  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    // If this error has lineErrors, update state for code highlighting
    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  let glSystem = GLSystem.getInstance();
  let audioAnalysisSystem: AudioAnalysisSystem;
  let messageContext: MessageContext;
  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewBitmapContext: ImageBitmapRenderingContext;
  let dragEnabled = $state(true);
  let panEnabled = $state(true);
  let wheelEnabled = $state(true);
  let videoOutputEnabled = $state(true);
  let editorReady = $state(false);

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const [outputWidth, outputHeight] = glSystem.outputSize;
  const [previewWidth, previewHeight] = glSystem.previewSize;

  let messageInletCount = $derived(data.messageInletCount ?? 1);
  let messageOutletCount = $derived(data.messageOutletCount ?? 0);
  let videoInletCount = $derived(data.videoInletCount ?? 1);
  let videoOutletCount = $derived(data.videoOutletCount ?? 1);
  let previousExecuteCode = $state<number | undefined>(undefined);

  // Watch for executeCode timestamp changes and re-run when it changes
  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      updateThree();
    }
  });

  // Event handlers for worker messages
  function handlePortCountUpdate(e: NodePortCountUpdateEvent) {
    if (e.nodeId !== nodeId) return;

    match(e)
      .with({ portType: 'message' }, (m) => {
        updateNodeData(nodeId, {
          messageInletCount: m.inletCount,
          messageOutletCount: m.outletCount
        });
      })
      .with({ portType: 'video' }, (m) => {
        updateNodeData(nodeId, {
          videoInletCount: m.inletCount,
          videoOutletCount: m.outletCount
        });
      })
      .exhaustive();

    updateNodeInternals(nodeId);
  }

  function handleTitleUpdate(e: NodeTitleUpdateEvent) {
    if (e.nodeId !== nodeId) return;
    updateNodeData(nodeId, { title: e.title });
  }

  function handleHidePortsUpdate(e: NodeHidePortsUpdateEvent) {
    if (e.nodeId !== nodeId) return;
    updateNodeData(nodeId, { hidePorts: e.hidePorts });
  }

  function handleInteractionUpdate(e: NodeInteractionUpdateEvent) {
    if (e.nodeId !== nodeId) return;

    match(e.mode)
      .with('drag', () => {
        dragEnabled = e.enabled;
      })
      .with('pan', () => {
        panEnabled = e.enabled;
      })
      .with('wheel', () => {
        wheelEnabled = e.enabled;
      })
      .with('interact', () => {
        dragEnabled = e.enabled;
        panEnabled = e.enabled;
        wheelEnabled = e.enabled;
      })
      .exhaustive();
  }

  function handleVideoOutputEnabledUpdate(e: NodeVideoOutputEnabledUpdateEvent) {
    if (e.nodeId !== nodeId) return;
    videoOutputEnabled = e.videoOutputEnabled;
    updateNodeInternals(nodeId);
  }

  const setCodeAndUpdate = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });
    setTimeout(() => updateThree());
  };

  const handleMessage: MessageCallbackFn = (message, meta) => {
    try {
      match(message)
        .with(messages.setCode, ({ value }) => {
          setCodeAndUpdate(value);
        })
        .with(messages.run, () => {
          updateThree();
        })
        .otherwise(() => {
          glSystem.sendMessageToNode(nodeId, { ...meta, data: message });
        });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    audioAnalysisSystem = AudioAnalysisSystem.getInstance();

    // Listen for updates from the worker
    const glEventBus = glSystem.eventBus;
    glEventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);
    glEventBus.addEventListener('nodeTitleUpdate', handleTitleUpdate);
    glEventBus.addEventListener('nodeHidePortsUpdate', handleHidePortsUpdate);
    glEventBus.addEventListener('nodeInteractionUpdate', handleInteractionUpdate);
    glEventBus.addEventListener('nodeVideoOutputEnabledUpdate', handleVideoOutputEnabledUpdate);

    // Listen for console output events to capture lineErrors
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    if (previewCanvas) {
      previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
    }

    glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;

    glSystem.upsertNode(nodeId, 'three', { code: data.code });

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
      updateThree();
    }, 50);
  });

  onDestroy(() => {
    const glEventBus = glSystem?.eventBus;
    if (glEventBus) {
      glEventBus.removeEventListener('nodePortCountUpdate', handlePortCountUpdate);
      glEventBus.removeEventListener('nodeTitleUpdate', handleTitleUpdate);
      glEventBus.removeEventListener('nodeHidePortsUpdate', handleHidePortsUpdate);
      glEventBus.removeEventListener('nodeInteractionUpdate', handleInteractionUpdate);
      glEventBus.removeEventListener(
        'nodeVideoOutputEnabledUpdate',
        handleVideoOutputEnabledUpdate
      );
    }

    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);

    audioAnalysisSystem?.disableFFT(nodeId);
    glSystem?.removeNode(nodeId);
    messageContext?.destroy();
  });

  const handleClass = $derived.by(() => {
    // only apply the custom handles if setHidePorts(true) is set
    if (!data.hidePorts) return '';

    if (!selected && $shouldShowHandles) {
      return 'z-1 transition-opacity';
    }

    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });

  function updateThree() {
    // Clear console and error highlighting on re-run
    consoleRef?.clearConsole();
    lineErrors = undefined;

    try {
      messageContext?.clearTimers();
      audioAnalysisSystem?.disableFFT(nodeId);

      const isUpdated = glSystem.upsertNode(nodeId, 'three', { code: data.code });

      // If the code hasn't changed, the code will not be re-run.
      // This allows us to forcibly re-run to update FFT.
      if (!isUpdated) glSystem.send('updateThree', { nodeId });
    } catch (error) {
      logger.error(`[three] update three error:`, error);
    }
  }
</script>

<CanvasPreviewLayout
  title={data.title ?? 'three'}
  {nodeId}
  onrun={updateThree}
  bind:previewCanvas
  nodrag={!dragEnabled}
  nopan={!panEnabled}
  nowheel={!wheelEnabled}
  width={outputWidth}
  height={outputHeight}
  style={`width: ${previewWidth}px; height: ${previewHeight}px;`}
  {selected}
  {editorReady}
  hasError={lineErrors !== undefined}
>
  {#snippet topHandle()}
    {#each Array.from({ length: videoInletCount }) as _, index (index)}
      <StandardHandle
        port="inlet"
        type="video"
        id={index.toString()}
        title={`Video Inlet ${index}`}
        total={messageInletCount + videoInletCount}
        {index}
        class={handleClass}
        {nodeId}
      />
    {/each}

    {#each Array.from({ length: messageInletCount }) as _, index (index)}
      <StandardHandle
        port="inlet"
        type="message"
        id={index + videoInletCount}
        title={`Message Inlet ${index}`}
        total={messageInletCount + videoInletCount}
        index={index + videoInletCount}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet bottomHandle()}
    {#if videoOutputEnabled}
      {#each Array.from({ length: videoOutletCount }) as _, index (index)}
        <StandardHandle
          port="outlet"
          type="video"
          id={index.toString()}
          title={`Video Outlet ${index}`}
          total={messageOutletCount + videoOutletCount}
          {index}
          class={handleClass}
          {nodeId}
        />
      {/each}
    {/if}

    {#each Array.from({ length: messageOutletCount }) as _, index (index)}
      <StandardHandle
        port="outlet"
        type="message"
        id={index + videoOutletCount}
        title={`Message Outlet ${index}`}
        total={messageOutletCount + videoOutletCount}
        index={index + videoOutletCount}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet codeEditor()}
    <CodeEditor
      value={data.code}
      language="javascript"
      nodeType="three"
      placeholder="Write your Three.js code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={updateThree}
      onchange={(newCode) => {
        updateNodeData(nodeId, { code: newCode });
      }}
      onready={() => (editorReady = true)}
      {lineErrors}
      {nodeId}
    />
  {/snippet}

  {#snippet console()}
    <!-- Always render VirtualConsole so it receives events even when hidden -->
    <div class="mt-3 w-full" class:hidden={!data.showConsole}>
      <VirtualConsole
        bind:this={consoleRef}
        {nodeId}
        placeholder="Three.js output will appear here."
        maxHeight="200px"
      />
    </div>
  {/snippet}
</CanvasPreviewLayout>
