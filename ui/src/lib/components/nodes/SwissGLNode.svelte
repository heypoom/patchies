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
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import { SettingsManager } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import type { SettingsSchema } from '$lib/settings';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    type: string;
    data: { code: string; settingsSchema?: SettingsSchema; settings?: Record<string, unknown> };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(nodeId, { settings, settingsSchema: schema }),
    createKVStore(nodeId)
  );

  let glSystem: GLSystem;
  let messageContext: MessageContext;
  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewBitmapContext: ImageBitmapRenderingContext;
  let isPaused = $state(false);
  let editorReady = $state(false);
  let errorMessage = $state<string | null>(null);

  const code = $derived(data.code || '');

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
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  };

  onMount(() => {
    glSystem = GLSystem.getInstance();
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    if (previewCanvas) {
      previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;

      const [previewWidth, previewHeight] = glSystem.previewSize;
      previewCanvas.width = previewWidth;
      previewCanvas.height = previewHeight;
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

    glSystem.upsertNode(nodeId, 'swgl', { code });

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
    }, 10);
  });

  onDestroy(() => {
    glSystem.unregisterSettingsCallbacks(nodeId);
    messageContext.destroy();
    glSystem.removeNode(nodeId);
    glSystem.removePreviewContext(nodeId, previewBitmapContext);
  });

  function updateSwissGL() {
    try {
      messageContext.clearTimers();
      glSystem.upsertNode(nodeId, 'swgl', { code });

      errorMessage = null;
    } catch (error) {
      // Capture compilation/setup errors
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function togglePause() {
    isPaused = !isPaused;
    glSystem.toggleNodePause(nodeId);
  }

  $effect(() => {
    const eventBus = PatchiesEventBus.getInstance();
    const handle = (event: { nodeId: string; paused: boolean }) => {
      if (event.nodeId !== nodeId) return;
      if (event.paused !== isPaused) togglePause();
    };
    eventBus.addEventListener('nodeSetPaused', handle);
    return () => eventBus.removeEventListener('nodeSetPaused', handle);
  });
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
  hasError={errorMessage !== null}
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
      {nodeId}
    />
  {/snippet}
</CanvasPreviewLayout>
