<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { swglSchema } from '$lib/objects/schemas/swgl';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas/common';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import { SettingsManager } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import type { SettingsSchema } from '$lib/settings';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';
  import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
  import { logger } from '$lib/utils/logger';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    type: string;
    data: {
      code: string;
      showConsole?: boolean;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
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

    // Listen for console output events to capture lineErrors
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

    glSystem.upsertNode(nodeId, 'swgl', { code });

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
    }, 10);
  });

  onDestroy(() => {
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

      const isUpdated = glSystem.upsertNode(nodeId, 'swgl', { code });

      // If code hasn't changed, force re-run
      if (!isUpdated) glSystem.send('updateSwgl', { nodeId });
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
    <TypedHandle
      port="inlet"
      spec={swglSchema.inlets[0].handle!}
      title="Message input"
      total={1}
      index={0}
      {nodeId}
    />
  {/snippet}

  {#snippet bottomHandle()}
    <TypedHandle
      port="outlet"
      spec={swglSchema.outlets[0].handle!}
      title="Video output"
      total={2}
      index={0}
      {nodeId}
    />

    <TypedHandle
      port="outlet"
      spec={swglSchema.outlets[1].handle!}
      title="Message output"
      total={2}
      index={1}
      {nodeId}
    />
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
