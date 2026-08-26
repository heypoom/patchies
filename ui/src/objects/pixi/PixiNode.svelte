<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { match } from 'ts-pattern';

  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { messages } from '$lib/objects/schemas/common';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent, NodeTitleUpdateEvent } from '$lib/eventbus/events';
  import { SettingsManager, createWorkerSettingsCallbacks } from '$lib/settings';
  import type { SettingsSchema } from '$lib/settings';
  import { createKVStore } from '$lib/storage';

  import {
    outputHeight,
    outputWidth,
    previewHeight,
    previewWidth
  } from '../../stores/renderer.store';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title?: string;
      code: string;
      showConsole?: boolean;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
    };
    selected?: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const glSystem = GLSystem.getInstance();
  const eventBus = PatchiesEventBus.getInstance();

  function initialNodeId() {
    return nodeId;
  }

  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(initialNodeId(), { settings, settingsSchema: schema }),
    createKVStore(initialNodeId())
  );

  let previewCanvas = $state<HTMLCanvasElement>();
  let consoleRef: VirtualConsole | null = $state(null);
  let previewBitmapContext: ImageBitmapRenderingContext | null = null;
  let messageContext: MessageContext | null = null;
  let editorReady = $state(false);
  let isPaused = $state(false);
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);

  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;
    if (event.messageType === 'error' && event.lineErrors) lineErrors = event.lineErrors;
  }

  function handleNodeTitleUpdate(event: NodeTitleUpdateEvent) {
    if (event.nodeId !== nodeId) return;

    updateNodeData(nodeId, { title: event.title });
  }

  function run(code = data.code) {
    consoleRef?.clearConsole();
    lineErrors = undefined;

    glSystem.upsertNode(nodeId, 'pixi', { code, _runRevision: Date.now() });
  }

  function togglePause() {
    isPaused = !isPaused;
    glSystem.toggleNodePause(nodeId);
  }

  const handleMessage: MessageCallbackFn = (message, meta) => {
    match(message)
      .with(messages.setCode, ({ value }) => {
        updateNodeData(nodeId, { code: value });
        run(value);
      })
      .with(messages.run, () => run())
      .otherwise(() => glSystem.sendMessageToNode(nodeId, { ...meta, data: message }));
  };

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    previewBitmapContext = previewCanvas?.getContext('bitmaprenderer') ?? null;

    if (previewBitmapContext) {
      glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
    }

    eventBus.addEventListener('consoleOutput', handleConsoleOutput);
    eventBus.addEventListener('nodeTitleUpdate', handleNodeTitleUpdate);

    glSystem.registerSettingsCallbacks(
      nodeId,
      createWorkerSettingsCallbacks(settingsManager, (requestId, values) =>
        glSystem.sendSettingsValues(nodeId, requestId, values)
      )
    );

    glSystem.upsertNode(nodeId, 'pixi', { code: data.code });

    const runTimer = window.setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
      run();
    }, 50);

    return () => window.clearTimeout(runTimer);
  });

  onDestroy(() => {
    messageContext?.destroy();
    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
    eventBus.removeEventListener('nodeTitleUpdate', handleNodeTitleUpdate);
    glSystem.unregisterSettingsCallbacks(nodeId);

    if (previewBitmapContext) {
      glSystem.removePreviewContext(nodeId, previewBitmapContext);
    }

    glSystem.removeNode(nodeId);
  });
</script>

<CanvasPreviewLayout
  title={data.title ?? 'pixi'}
  objectType="pixi"
  codePlaceholder="Write PixiJS code here..."
  onCodeChange={(code) => updateNodeData(nodeId, { code })}
  {nodeId}
  onrun={run}
  onPlaybackToggle={togglePause}
  paused={isPaused}
  showPauseButton={true}
  bind:previewCanvas
  width={$outputWidth}
  height={$outputHeight}
  style={`width: ${$previewWidth}px; height: ${$previewHeight}px;`}
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
    <TypedHandle
      port="inlet"
      spec={{ handleType: 'message', handleId: '0' }}
      title="Control messages"
      total={1}
      index={0}
      {nodeId}
    />
  {/snippet}

  {#snippet bottomHandle()}
    <TypedHandle
      port="outlet"
      spec={{ handleType: 'video', handleId: '0' }}
      title="Video output"
      total={1}
      index={0}
      {nodeId}
    />
  {/snippet}

  {#snippet codeEditor()}
    <CodeEditor
      value={data.code}
      language="javascript"
      nodeType="pixi"
      placeholder="Write PixiJS code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={run}
      onchange={(code) => updateNodeData(nodeId, { code })}
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
        placeholder="PixiJS output will appear here."
        maxHeight="200px"
      />
    </div>
  {/snippet}
</CanvasPreviewLayout>
