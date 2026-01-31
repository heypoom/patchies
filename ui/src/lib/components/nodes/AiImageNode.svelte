<script lang="ts">
  import { Image as ImageIcon, Loader } from '@lucide/svelte/icons';
  import { useNodeConnections, useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { generateImageWithGemini } from '$lib/ai/google';
  import { EditorView } from 'codemirror';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import ObjectPreviewLayout from '../ObjectPreviewLayout.svelte';
  import { match, P } from 'ts-pattern';
  import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';

  let { id: nodeId, data }: { id: string; data: { prompt: string } } = $props();

  const { updateNodeData } = useSvelteFlow();

  const messageContext = new MessageContext(nodeId);
  const targetConnections = useNodeConnections({ id: nodeId, handleType: 'target' });

  let canvasElement: HTMLCanvasElement;
  let glSystem = GLSystem.getInstance();
  let errorMessage = $state<string | null>(null);
  let isLoading = $state(false);
  let hasImage = $state(false);
  let abortController: AbortController | null = null;
  let editorReady = $state(false);

  const prompt = $derived(data.prompt || '');
  const setPrompt = (prompt: string) => updateNodeData(nodeId, { prompt });

  const [width, height] = [800 * 1.2, 600 * 1.2];

  const [previewWidth, previewHeight] = [
    width / PREVIEW_SCALE_FACTOR,
    height / PREVIEW_SCALE_FACTOR
  ];

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(P.string, (text) => {
        setPrompt(text);
        setTimeout(() => generateImage());
      })
      .with({ type: 'generate', prompt: P.string }, ({ prompt }) => {
        setPrompt(prompt);
        setTimeout(() => generateImage());
      })
      .with({ type: 'set', prompt: P.string }, ({ prompt }) => {
        setPrompt(prompt);
      })
      .with({ type: 'bang' }, generateImage);
  };

  onMount(() => {
    glSystem.upsertNode(nodeId, 'img', {});
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    glSystem.removeNode(nodeId);
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });

  async function generateImage() {
    if (isLoading) {
      if (abortController) {
        abortController.abort();
      }

      isLoading = false;

      return;
    }

    hasImage = false;
    isLoading = true;
    errorMessage = null;

    try {
      const apiKey = localStorage.getItem('gemini-api-key');

      if (!apiKey) {
        throw new Error('API key not found. Please set your Gemini API key with CMD+K.');
      }

      abortController = new AbortController();

      const imageNodeId = targetConnections.current.find((conn) =>
        conn.targetHandle?.startsWith('video-in')
      )?.source;

      const image = await generateImageWithGemini(prompt, {
        apiKey,
        abortSignal: abortController.signal,
        inputImageNodeId: imageNodeId
      });

      const previewBitmap = await createImageBitmap(image);
      // Flip when creating bitmap since ImageBitmap doesn't respect flipY in regl
      const flippedBitmap = await createImageBitmap(image, { imageOrientation: 'flipY' });
      glSystem.setPreflippedBitmap(nodeId, flippedBitmap);

      // draw the preview image to the canvas
      canvasElement
        .getContext('2d')
        ?.drawImage(
          previewBitmap,
          0,
          0,
          previewBitmap.width,
          previewBitmap.height,
          0,
          0,
          canvasElement.width,
          canvasElement.height
        );

      hasImage = true;

      // Send bang message when generation finishes
      messageContext.send({ type: 'bang' }, { to: 0 });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      hasImage = false;
    } finally {
      isLoading = false;
    }
  }
</script>

<ObjectPreviewLayout title="ai.img" onrun={generateImage} {editorReady}>
  {#snippet topHandle()}
    <StandardHandle
      port="inlet"
      type="video"
      id="0"
      title="Image input (Optional)"
      total={2}
      index={0}
      class=""
      {nodeId}
    />

    <StandardHandle
      port="inlet"
      type="message"
      id="1"
      title="Message input"
      total={2}
      index={1}
      {nodeId}
    />
  {/snippet}

  {#snippet preview()}
    <div class="relative">
      {#if !hasImage || isLoading}
        <div class="pointer-events-none absolute h-full w-full">
          <div class="flex h-full items-center justify-center">
            <svelte:component
              this={isLoading ? Loader : ImageIcon}
              class={`h-8 w-8 text-zinc-300 ${isLoading ? 'animate-spin' : ''}`}
            />
          </div>
        </div>
      {/if}

      <canvas
        bind:this={canvasElement}
        {width}
        {height}
        style={`width: ${previewWidth}px; height: ${previewHeight}px;`}
        class="rounded-md bg-zinc-900"
      ></canvas>
    </div>
  {/snippet}

  {#snippet bottomHandle()}
    <StandardHandle
      port="outlet"
      type="video"
      id="0"
      title="Video output"
      total={2}
      index={0}
      class=""
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
    <div class="w-[270px]">
      <CodeEditor
        value={prompt}
        onchange={(newPrompt) => {
          updateNodeData(nodeId, { prompt: newPrompt });
        }}
        language="plain"
        placeholder="Write your prompt here..."
        class="nodrag w-full resize-none"
        onrun={generateImage}
        onready={() => (editorReady = true)}
        extraExtensions={[EditorView.lineWrapping]}
      />

      {#if errorMessage}
        <div class="px-4 pb-4 font-mono text-xs text-red-300">
          {errorMessage}
        </div>
      {/if}
    </div>
  {/snippet}
</ObjectPreviewLayout>
