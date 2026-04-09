<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
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
  import { SettingsManager } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import type { SettingsSchema } from '$lib/settings';

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
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
    };
    selected?: boolean;
  } = $props();

  let consoleRef: VirtualConsole | null = $state(null);

  // Track error line numbers for code highlighting
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);
  const eventBus = PatchiesEventBus.getInstance();

  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  let glSystem = GLSystem.getInstance();

  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(nodeId, { settings, settingsSchema: schema }),
    createKVStore(nodeId)
  );

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

  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      updateRegl();
    }
  });

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
        glSystem.upsertNode(nodeId, 'regl', { code: data.code, videoOutletCount: m.outletCount });
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
    setTimeout(() => updateRegl());
  };

  const handleMessage: MessageCallbackFn = (message, meta) => {
    try {
      match(message)
        .with(messages.setCode, ({ value }) => {
          setCodeAndUpdate(value);
        })
        .with(messages.run, () => {
          updateRegl();
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

    const glEventBus = glSystem.eventBus;
    glEventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);
    glEventBus.addEventListener('nodeTitleUpdate', handleTitleUpdate);
    glEventBus.addEventListener('nodeHidePortsUpdate', handleHidePortsUpdate);
    glEventBus.addEventListener('nodeInteractionUpdate', handleInteractionUpdate);
    glEventBus.addEventListener('nodeVideoOutputEnabledUpdate', handleVideoOutputEnabledUpdate);

    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    if (previewCanvas) {
      previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
    }

    glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;

    glSystem.registerSettingsCallbacks(nodeId, {
      onDefine: async (requestId, schema) => {
        await settingsManager.define(schema as SettingsSchema);
        glSystem.sendSettingsValues(nodeId, requestId, settingsManager.getAll());
      },
      onClear: () => {
        settingsManager.clear();
      }
    });

    glSystem.upsertNode(nodeId, 'regl', {
      code: data.code,
      videoOutletCount: data.videoOutletCount ?? 1
    });

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
      updateRegl();
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

    glSystem?.unregisterSettingsCallbacks(nodeId);
    audioAnalysisSystem?.disableFFT(nodeId);
    glSystem?.removeNode(nodeId);
    messageContext?.destroy();
  });

  const handleClass = $derived.by(() => {
    if (!data.hidePorts) return '';

    if (!selected && $shouldShowHandles) {
      return 'z-1 transition-opacity';
    }

    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });

  function updateRegl() {
    consoleRef?.clearConsole();
    lineErrors = undefined;

    try {
      messageContext?.clearTimers();
      audioAnalysisSystem?.disableFFT(nodeId);

      glSystem.upsertNode(nodeId, 'regl', {
        code: data.code,
        videoOutletCount: data.videoOutletCount ?? 1,
        _runRevision: Date.now()
      });
    } catch (error) {
      logger.error(`[regl] update regl error:`, error);
    }
  }
</script>

<CanvasPreviewLayout
  title={data.title ?? 'regl'}
  objectType="regl"
  {nodeId}
  onrun={updateRegl}
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
  settingsSchema={data.settingsSchema}
  settingsValues={data.settings ?? {}}
  onSettingsValueChange={(key, value) => {
    settingsManager.setValue(key, value);
    glSystem.sendSettingsValueChanged(nodeId, key, value);
  }}
  onSettingsRevertAll={() => {
    settingsManager.revertAll();

    for (const [key, value] of Object.entries(settingsManager.getAll())) {
      glSystem.sendSettingsValueChanged(nodeId, key, value);
    }
  }}
>
  {#snippet topHandle()}
    {#each Array.from({ length: videoInletCount }) as _, index (index)}
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'video', handleId: index.toString() }}
        title={`Video Inlet ${index}`}
        total={messageInletCount + videoInletCount}
        {index}
        class={handleClass}
        {nodeId}
      />
    {/each}

    {#each Array.from({ length: messageInletCount }) as _, index (index)}
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'message', handleId: index }}
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
        <TypedHandle
          port="outlet"
          spec={{ handleType: 'video', handleId: index.toString() }}
          title={`Video Outlet ${index}`}
          total={messageOutletCount + videoOutletCount}
          {index}
          class={handleClass}
          {nodeId}
        />
      {/each}
    {/if}

    {#each Array.from({ length: messageOutletCount }) as _, index (index)}
      <TypedHandle
        port="outlet"
        spec={{ handleType: 'message', handleId: index }}
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
      nodeType="regl"
      placeholder="Write your regl code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={updateRegl}
      onchange={(newCode) => {
        updateNodeData(nodeId, { code: newCode });
      }}
      onready={() => (editorReady = true)}
      {lineErrors}
      {nodeId}
    />
  {/snippet}

  {#snippet console()}
    <div class="mt-3 w-full" class:hidden={!data.showConsole}>
      <VirtualConsole
        bind:this={consoleRef}
        {nodeId}
        placeholder="regl output will appear here."
        maxHeight="200px"
      />
    </div>
  {/snippet}
</CanvasPreviewLayout>
