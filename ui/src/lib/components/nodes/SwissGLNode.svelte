<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { removeExcessVideoOutletEdges } from './outlet-edges';
  import { messages } from '$lib/objects/schemas/common';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import { SettingsManager } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import type { SettingsSchema } from '$lib/settings';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent, NodePortCountUpdateEvent } from '$lib/eventbus/events';
  import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
  import { logger } from '$lib/utils/logger';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      code: string;
      showConsole?: boolean;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
      videoInletCount?: number;
      videoOutletCount?: number;
      messageInletCount?: number;
      messageOutletCount?: number;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();

  const updateNodeInternals = useUpdateNodeInternals();
  const eventBus = PatchiesEventBus.getInstance();

  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(nodeId, { settings, settingsSchema: schema }),
    createKVStore(nodeId)
  );

  let glSystem: GLSystem;
  let audioAnalysisSystem: AudioAnalysisSystem;
  let messageContext: MessageContext;
  let consoleRef: VirtualConsole | null = $state(null);
  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewBitmapContext: ImageBitmapRenderingContext;
  let isPaused = $state(false);
  let editorReady = $state(false);

  // Track error line numbers for code highlighting
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);

  const code = $derived(data.code || '');

  let videoInletCount = $derived(data.videoInletCount ?? 0);
  let videoOutletCount = $derived(data.videoOutletCount ?? 1);
  let messageInletCount = $derived(data.messageInletCount ?? 1);

  $effect(() => {
    removeExcessVideoOutletEdges(nodeId, videoOutletCount, getEdges, deleteElements);
  });

  let messageOutletCount = $derived(data.messageOutletCount ?? 1);

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

        glSystem.upsertNode(nodeId, 'swgl', {
          code,
          mrtCount: m.outletCount
        });
      })
      .exhaustive();

    updateNodeInternals(nodeId);
  }

  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  const setCodeAndUpdate = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });
    setTimeout(() => updateSwissGL());
  };

  const handleMessage: MessageCallbackFn = (message, meta) => {
    try {
      match(message)
        .with(messages.setCode, ({ value }) => {
          setCodeAndUpdate(value);
        })
        .with(messages.run, updateSwissGL)
        .otherwise(() => {
          glSystem.sendMessageToNode(nodeId, { ...meta, data: message });
        });
    } catch (error) {
      logger.error('[swgl] message error:', error);
    }
  };

  onMount(() => {
    glSystem = GLSystem.getInstance();
    audioAnalysisSystem = AudioAnalysisSystem.getInstance();
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    if (previewCanvas) {
      previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;

      const [previewWidth, previewHeight] = glSystem.previewSize;
      previewCanvas.width = previewWidth;
      previewCanvas.height = previewHeight;
    }

    glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;

    // Listen for console output and port count events
    glSystem.eventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    glSystem.registerSettingsCallbacks(nodeId, {
      onDefine: async (requestId, schema) => {
        await settingsManager.define(schema as SettingsSchema);

        glSystem.sendSettingsValues(nodeId, requestId, settingsManager.getAll());
      },
      onClear: () => {
        settingsManager.clear();
      }
    });

    glSystem.upsertNode(nodeId, 'swgl', {
      code,
      mrtCount: data.videoOutletCount ?? 1
    });

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
    }, 10);
  });

  onDestroy(() => {
    glSystem?.eventBus.removeEventListener('nodePortCountUpdate', handlePortCountUpdate);
    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
    glSystem?.unregisterSettingsCallbacks(nodeId);
    audioAnalysisSystem?.disableFFT(nodeId);
    messageContext?.destroy();
    glSystem?.removeNode(nodeId);
    glSystem?.removePreviewContext(nodeId, previewBitmapContext);
  });

  function updateSwissGL() {
    // Clear console and error highlighting on re-run
    consoleRef?.clearConsole();
    lineErrors = undefined;

    try {
      messageContext?.clearTimers();
      audioAnalysisSystem?.disableFFT(nodeId);

      glSystem.upsertNode(nodeId, 'swgl', {
        code,
        mrtCount: data.videoOutletCount ?? 1,
        _runRevision: Date.now()
      });
    } catch (error) {
      logger.error('[swgl] update error:', error);
    }
  }

  function togglePause() {
    isPaused = !isPaused;
    glSystem.toggleNodePause(nodeId);
  }
</script>

<CanvasPreviewLayout
  title="swgl"
  objectType="swgl"
  {nodeId}
  onrun={updateSwissGL}
  onPlaybackToggle={togglePause}
  paused={isPaused}
  showPauseButton={true}
  {selected}
  {editorReady}
  hasError={lineErrors !== undefined}
  bind:previewCanvas
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
        total={videoInletCount + messageInletCount}
        {index}
        {nodeId}
      />
    {/each}

    {#each Array.from({ length: messageInletCount }) as _, index (index)}
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'message', handleId: index }}
        title={`Message Inlet ${index}`}
        total={videoInletCount + messageInletCount}
        index={index + videoInletCount}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet bottomHandle()}
    {#each Array.from({ length: videoOutletCount }) as _, index (index)}
      <TypedHandle
        port="outlet"
        spec={{ handleType: 'video', handleId: index.toString() }}
        title={`Video Outlet ${index}`}
        total={videoOutletCount + messageOutletCount}
        {index}
        {nodeId}
      />
    {/each}

    {#each Array.from({ length: messageOutletCount }) as _, index (index)}
      <TypedHandle
        port="outlet"
        spec={{ handleType: 'message', handleId: index }}
        title={`Message Outlet ${index}`}
        total={videoOutletCount + messageOutletCount}
        index={index + videoOutletCount}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet codeEditor()}
    <CodeEditor
      value={code}
      onchange={(newCode) => {
        updateNodeData(nodeId, { code: newCode });
      }}
      language="javascript"
      nodeType="swgl"
      placeholder="Write your SwissGL code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={updateSwissGL}
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
        placeholder="SwissGL output will appear here."
        maxHeight="200px"
      />
    </div>
  {/snippet}
</CanvasPreviewLayout>
