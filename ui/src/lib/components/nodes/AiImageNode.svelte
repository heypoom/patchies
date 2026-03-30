<script lang="ts">
  import { Image as ImageIcon, Loader, CircleAlert } from '@lucide/svelte/icons';
  import { useNodeConnections, useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { generateImageWithGemini, generateImageWithOpenRouter } from '$lib/ai/google';
  import { requireGeminiApiKey } from '$lib/ai/providers';
  import { get } from 'svelte/store';
  import { aiSettings } from '../../../stores/ai-settings.store';
  import { EditorView } from 'codemirror';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import ObjectPreviewLayout from '../ObjectPreviewLayout.svelte';
  import { match } from 'ts-pattern';
  import { aiImgMessages } from '$lib/objects/schemas';
  import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';

  let { id: nodeId, data }: { id: string; data: { prompt: string; model?: string } } = $props();

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

  const defaultModelPlaceholder = $derived(
    $aiSettings.provider === 'openrouter' ? $aiSettings.openRouterModel : 'gemini-2.5-flash-image'
  );

  const [width, height] = [800 * 1.2, 600 * 1.2];

  const [previewWidth, previewHeight] = [
    width / PREVIEW_SCALE_FACTOR,
    height / PREVIEW_SCALE_FACTOR
  ];

  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(aiImgMessages.string, (text) => {
        setPrompt(text);
        setTimeout(() => generateImage());
      })
      .with(aiImgMessages.generate, ({ prompt }) => {
        setPrompt(prompt);
        setTimeout(() => generateImage());
      })
      .with(aiImgMessages.set, ({ value }) => {
        setPrompt(value);
      })
      .with(aiImgMessages.bang, generateImage);
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
      abortController = new AbortController();
      const settings = get(aiSettings);
      const nodeModel = data.model?.trim() || undefined;

      const imageNodeId = targetConnections.current.find((conn) =>
        conn.targetHandle?.startsWith('video-in')
      )?.source;

      let image: ImageBitmap;

      if (settings.provider === 'openrouter') {
        if (!settings.openRouterApiKey) {
          throw new Error('OpenRouter API key is not set. Please configure it in AI settings.');
        }
        image = await generateImageWithOpenRouter(prompt, {
          apiKey: settings.openRouterApiKey,
          model: nodeModel ?? settings.openRouterModel,
          abortSignal: abortController.signal
        });
      } else {
        const apiKey = requireGeminiApiKey();
        image = await generateImageWithGemini(prompt, {
          apiKey,
          model: nodeModel,
          abortSignal: abortController.signal,
          inputImageNodeId: imageNodeId
        });
      }

      const previewBitmap = await createImageBitmap(image);
      const flippedBitmap = await createImageBitmap(image);
      glSystem.setBitmap(nodeId, flippedBitmap);

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

<ObjectPreviewLayout title="ai.img" objectType="ai.img" onrun={generateImage} {editorReady}>
  {#snippet topHandle()}
    <TypedHandle
      port="inlet"
      spec={{ handleType: 'video', handleId: '0' }}
      title="Image input (Optional)"
      total={2}
      index={0}
      {nodeId}
    />

    <TypedHandle
      port="inlet"
      spec={{ handleType: 'message', handleId: '1' }}
      title="Message input"
      total={2}
      index={1}
      {nodeId}
    />
  {/snippet}

  {#snippet preview()}
    <div class={['relative', !!errorMessage && 'nowheel']}>
      {#if !hasImage || isLoading}
        <div
          class={[
            'absolute h-full w-full',
            !!errorMessage && 'rounded-md border border-red-300 bg-zinc-900',
            !errorMessage && 'pointer-events-none'
          ]}
        >
          <div
            class={[
              'flex h-full items-center',
              !!errorMessage ? 'justify-start' : 'justify-center'
            ]}
          >
            {#if errorMessage}
              <div class="max-h-full overflow-y-auto px-5 text-red-300">
                <CircleAlert />

                <div
                  class="nodrag nopan nowheel mt-2 max-h-24 overflow-y-auto font-mono text-[10px]"
                >
                  {errorMessage}
                </div>
              </div>
            {:else}
              <svelte:component
                this={isLoading ? Loader : ImageIcon}
                class={`h-8 w-8 text-zinc-300 ${isLoading ? 'animate-spin' : ''}`}
              />
            {/if}
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
    <TypedHandle
      port="outlet"
      spec={{ handleType: 'video', handleId: '0' }}
      title="Video output"
      total={2}
      index={0}
      {nodeId}
    />

    <TypedHandle
      port="outlet"
      spec={{ handleType: 'message', handleId: '1' }}
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
        {nodeId}
        dataKey="prompt"
      />
      <div class="mt-2 flex items-center gap-2">
        <span class="shrink-0 text-xs text-zinc-500">Model</span>
        <input
          type="text"
          value={data.model ?? ''}
          oninput={(e) => updateNodeData(nodeId, { model: (e.target as HTMLInputElement).value })}
          placeholder={defaultModelPlaceholder}
          class="nodrag min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 font-mono text-xs text-zinc-300 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </div>
    </div>
  {/snippet}
</ObjectPreviewLayout>
