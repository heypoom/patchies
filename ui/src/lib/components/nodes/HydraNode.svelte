<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals, type NodeProps } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { CanvasMouseHandler, type MouseScope } from '$lib/canvas/CanvasMouseHandler';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
  import type {
    NodePortCountUpdateEvent,
    NodeTitleUpdateEvent,
    NodeMouseScopeUpdateEvent,
    ConsoleOutputEvent
  } from '$lib/eventbus/events';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import { SettingsManager } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import type { SettingsSchema } from '$lib/settings';
  import { useNodeSetPaused } from '$lib/canvas/use-node-set-paused.svelte';

  let {
    id: nodeId,
    data,
    selected
  }: NodeProps & {
    data: {
      title?: string;
      code: string;
      messageInletCount?: number;
      messageOutletCount?: number;
      videoInletCount?: number;
      videoOutletCount?: number;
      executeCode?: number;
      showConsole?: boolean;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
    };
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  let eventBus = PatchiesEventBus.getInstance();
  let glSystem: GLSystem;

  // Settings manager — persists across code re-runs
  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(nodeId, { settings, settingsSchema: schema }),
    createKVStore(nodeId)
  );

  let audioAnalysisSystem: AudioAnalysisSystem;
  let messageContext: MessageContext;
  let mouseHandler: CanvasMouseHandler | null = null;
  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewBitmapContext: ImageBitmapRenderingContext;
  let isPaused = $state(false);
  let editorReady = $state(false);
  let consoleRef: VirtualConsole | null = $state(null);
  let lineErrors: Record<number, string[]> | undefined = $state(undefined);
  let previousExecuteCode = $state<number | undefined>(undefined);

  const code = $derived(data.code || '');
  const errorLines = $derived(
    lineErrors
      ? Object.keys(lineErrors)
          .map(Number)
          .sort((a, b) => a - b)
      : undefined
  );

  // Mouse scope: 'local' (canvas-relative) or 'global' (screen-relative)
  let mouseScope = $state<MouseScope>('local');

  // Detect if Hydra code uses mouse variable (ignore comments)
  const usesMouseVariable = $derived.by(() => {
    // Remove single-line comments
    const codeWithoutComments = code.replace(/\/\/.*$/gm, '');

    return codeWithoutComments.includes('mouse');
  });

  // Watch for executeCode timestamp changes and re-run when it changes
  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      updateHydra();
    }
  });

  // Store event handler for cleanup
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

  function handleMouseScopeUpdate(e: NodeMouseScopeUpdateEvent) {
    if (e.nodeId !== nodeId) return;

    mouseScope = e.scope;
    mouseHandler?.setScope(e.scope);
  }

  let messageInletCount = $derived(data.messageInletCount ?? 1);
  let messageOutletCount = $derived(data.messageOutletCount ?? 0);
  let videoInletCount = $derived(data.videoInletCount ?? 1);
  let videoOutletCount = $derived(data.videoOutletCount ?? 1);

  const setCodeAndUpdate = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });
    setTimeout(() => updateHydra());
  };

  const handleMessage: MessageCallbackFn = (message, meta) => {
    match(message)
      .with(messages.setCode, ({ value }) => {
        setCodeAndUpdate(value);
      })
      .with(messages.run, () => {
        updateHydra();
      })
      .otherwise(() => {
        glSystem.sendMessageToNode(nodeId, { ...meta, data: message });
      });
  };

  onMount(() => {
    glSystem = GLSystem.getInstance();
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    audioAnalysisSystem = AudioAnalysisSystem.getInstance();

    // Listen for port count updates from the worker
    const eventBus = glSystem.eventBus;

    eventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);
    eventBus.addEventListener('nodeTitleUpdate', handleTitleUpdate);
    eventBus.addEventListener('nodeMouseScopeUpdate', handleMouseScopeUpdate);

    if (previewCanvas) {
      previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;

      const [previewWidth, previewHeight] = glSystem.previewSize;

      previewCanvas.width = previewWidth;
      previewCanvas.height = previewHeight;
    }

    glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;

    // Register settings callbacks — bridging worker settings.define() to main-thread SettingsManager
    glSystem.registerSettingsCallbacks(nodeId, {
      onDefine: async (requestId, schema) => {
        await settingsManager.define(schema as SettingsSchema);

        glSystem.sendSettingsValues(nodeId, requestId, settingsManager.getAll());
      },
      onClear: () => {
        settingsManager.clear();
      }
    });

    glSystem.upsertNode(nodeId, 'hydra', { code });

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
    }, 10);
  });

  onDestroy(() => {
    messageContext.destroy();
    glSystem.unregisterSettingsCallbacks(nodeId);
    glSystem.removeNode(nodeId);
    glSystem.removePreviewContext(nodeId, previewBitmapContext);
    mouseHandler?.detach();

    // Clean up event listeners
    const eventBus = glSystem.eventBus;
    eventBus.removeEventListener('nodePortCountUpdate', handlePortCountUpdate);
    eventBus.removeEventListener('nodeTitleUpdate', handleTitleUpdate);
    eventBus.removeEventListener('nodeMouseScopeUpdate', handleMouseScopeUpdate);
  });

  useNodeSetPaused(nodeId, () => isPaused, togglePause);

  function updateHydra() {
    // Clear console and error line highlighting on re-run
    consoleRef?.clearConsole();
    lineErrors = undefined;

    // Reset mouse scope to local (worker also resets on code update)
    mouseScope = 'local';
    mouseHandler?.setScope('local');

    if (!messageContext) return;

    try {
      messageContext.clearTimers();
      audioAnalysisSystem.disableFFT(nodeId);

      const isUpdated = glSystem.upsertNode(nodeId, 'hydra', { code });

      // If the code hasn't changed, the code will not be re-run.
      // This allows us to forcibly re-run hydra to update FFT.
      if (!isUpdated) glSystem.send('updateHydra', { nodeId });
    } catch (error) {
      // Note: Most errors will be caught by the worker and sent via consoleOutput
      console.error('Hydra update error:', error);
    }
  }

  function togglePause() {
    isPaused = !isPaused;
    glSystem.toggleNodePause(nodeId);
  }

  // Attach mouse event listeners based on scope
  $effect(() => {
    if (!usesMouseVariable || !previewCanvas || !glSystem) return;

    const [outputWidth, outputHeight] = glSystem.outputSize;

    mouseHandler = new CanvasMouseHandler({
      type: 'simple',
      nodeId,
      canvas: previewCanvas,
      outputWidth,
      outputHeight,
      scope: mouseScope
    });

    mouseHandler.attach();

    return () => {
      mouseHandler?.detach();
    };
  });

  // Listen for console output events to capture lineErrors for code highlighting
  $effect(() => {
    const handleConsoleOutput = (event: ConsoleOutputEvent) => {
      if (event.nodeId !== nodeId || event.messageType !== 'error') return;

      lineErrors = event.lineErrors;
    };

    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    return () => {
      eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
    };
  });
</script>

<CanvasPreviewLayout
  title={data.title ?? 'hydra'}
  objectType="hydra"
  {nodeId}
  onrun={updateHydra}
  onPlaybackToggle={togglePause}
  paused={isPaused}
  showPauseButton={true}
  nodrag={usesMouseVariable}
  nopan={usesMouseVariable}
  nowheel={usesMouseVariable}
  {selected}
  {editorReady}
  bind:previewCanvas
  hasError={errorLines !== undefined && errorLines.length > 0}
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
        total={messageOutletCount + videoOutletCount}
        {index}
        {nodeId}
      />
    {/each}

    {#each Array.from({ length: messageOutletCount }) as _, index (index)}
      <TypedHandle
        port="outlet"
        spec={{ handleType: 'message', handleId: index }}
        title={`Outlet ${index}`}
        total={messageOutletCount + videoOutletCount}
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
      nodeType="hydra"
      placeholder="Write your Hydra code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={updateHydra}
      onready={() => (editorReady = true)}
      {lineErrors}
      {nodeId}
    />
  {/snippet}

  {#snippet console()}
    <!-- Always render VirtualConsole so it receives events even when hidden -->
    <!-- We already have in-gutter errors, so we don't auto-show the console on new errors -->
    <div class="mt-3 w-full" class:hidden={!data.showConsole}>
      <VirtualConsole
        bind:this={consoleRef}
        {nodeId}
        placeholder="Hydra errors will appear here."
        maxHeight="200px"
        shouldAutoShowConsoleOnError={false}
      />
    </div>
  {/snippet}
</CanvasPreviewLayout>
