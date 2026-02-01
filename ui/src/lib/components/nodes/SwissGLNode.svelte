<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';

  let {
    id: nodeId,
    data,
    selected
  }: { id: string; type: string; data: { code: string }; selected: boolean } = $props();

  const { updateNodeData } = useSvelteFlow();

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
        .with({ type: 'setCode', code: P.string }, ({ code }) => {
          setCodeAndUpdate(code);
        })
        .with({ type: 'run' }, updateSwissGL)
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
    glSystem.upsertNode(nodeId, 'swgl', { code });

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
    }, 10);
  });

  onDestroy(() => {
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
</script>

<CanvasPreviewLayout
  title="swgl"
  onrun={updateSwissGL}
  onPlaybackToggle={togglePause}
  paused={isPaused}
  showPauseButton={true}
  {selected}
  {editorReady}
  {errorMessage}
  bind:previewCanvas
>
  {#snippet topHandle()}
    <StandardHandle
      port="inlet"
      type="message"
      id="0"
      title="Message input"
      total={1}
      index={0}
      {nodeId}
    />
  {/snippet}

  {#snippet bottomHandle()}
    <StandardHandle
      port="outlet"
      type="video"
      id="0"
      title="Video output"
      total={2}
      index={0}
      {nodeId}
    />

    <StandardHandle
      port="outlet"
      type="message"
      id="1"
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
    />
  {/snippet}
</CanvasPreviewLayout>
