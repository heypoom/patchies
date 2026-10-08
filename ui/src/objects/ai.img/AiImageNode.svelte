<script lang="ts">
  import {
    Image as ImageIcon,
    Loader,
    CircleAlert,
    Bot,
    SlidersHorizontal,
    ChevronDown,
    Scaling
  } from '@lucide/svelte/icons';
  import { NodeResizer, useNodeConnections, useSvelteFlow } from '@xyflow/svelte';
  import { useNodeDataTracker } from '$lib/history';
  import { onMount, onDestroy, tick } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { generateImageWithGemini, generateImageWithOpenRouter } from '$lib/ai/google';
  import { requireGeminiApiKey } from '$lib/ai/providers';
  import { get } from 'svelte/store';
  import { aiSettings } from '../../stores/ai-settings.store';
  import { EditorView } from 'codemirror';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import ObjectPreviewLayout from '$lib/components/ObjectPreviewLayout.svelte';
  import { match } from 'ts-pattern';
  import { aiImgMessages } from '$lib/objects/schemas';
  import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';

  import ImageGenerationSettings from '$objects/ai.img/ImageGenerationSettings.svelte';
  import type { ImageGenerationOptions } from '$lib/ai/image-generation-options';

  let {
    id: nodeId,
    data,
    selected,
    width: nodeWidth,
    height: nodeHeight
  }: {
    id: string;
    data: {
      prompt: string;
      model?: string;
      resizable?: boolean;
      geminiOptions?: ImageGenerationOptions;
      openRouterOptions?: ImageGenerationOptions;
    };
    selected?: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  const targetConnections = useNodeConnections({ id: (() => nodeId)(), handleType: 'target' });

  let canvasElement: HTMLCanvasElement;
  let glSystem = GLSystem.getInstance();
  let errorMessage = $state<string | null>(null);
  let isLoading = $state(false);
  let hasImage = $state(false);
  let abortController: AbortController | null = null;
  let editorReady = $state(false);
  let showModelSettings = $state(false);

  const tracker = $derived.by(() => useNodeDataTracker(nodeId));
  const modelTracker = $derived.by(() => tracker.track('model', () => data.model ?? ''));

  const prompt = $derived(data.prompt || '');
  const setPrompt = (prompt: string) => updateNodeData(nodeId, { prompt });

  const defaultModelPlaceholder = $derived(
    $aiSettings.provider === 'openrouter'
      ? $aiSettings.openRouterImageModel
      : $aiSettings.geminiImageModel
  );

  const isResizable = $derived(data.resizable ?? true);
  const previewWidth = $derived(nodeWidth ?? 960 / PREVIEW_SCALE_FACTOR);
  const previewHeight = $derived(nodeHeight ?? 720 / PREVIEW_SCALE_FACTOR);
  let imageWidth = $state(960);
  let imageHeight = $state(720);

  function toggleResizable() {
    const previous = isResizable;
    const next = !previous;

    updateNodeData(nodeId, { resizable: next });
    tracker.commit('resizable', previous, next);
  }

  const displayExtraMenuItems = $derived([
    {
      label: isResizable ? 'Disable resizing' : 'Enable resizing',
      icon: Scaling,
      onclick: toggleResizable
    }
  ]);

  let messageContext: MessageContext;

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
    messageContext = new MessageContext(nodeId);
    glSystem.upsertNode(nodeId, 'img', {});
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    glSystem.removeNode(nodeId);
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
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
          model: nodeModel ?? settings.openRouterImageModel,
          abortSignal: abortController.signal,
          inputImageNodeId: imageNodeId,
          options: data.openRouterOptions
        });
      } else {
        const apiKey = requireGeminiApiKey();

        image = await generateImageWithGemini(prompt, {
          apiKey,
          model: nodeModel ?? settings.geminiImageModel,
          abortSignal: abortController.signal,
          inputImageNodeId: imageNodeId,
          options: data.geminiOptions
        });
      }

      imageWidth = image.width;
      imageHeight = image.height;

      // Changing the backing dimensions clears the canvas; wait for Svelte to apply them.
      await tick();

      canvasElement.getContext('2d')?.drawImage(image, 0, 0);
      glSystem.setBitmap(nodeId, image);

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

{#if isResizable}
  <NodeResizer class="z-1" isVisible={selected} minWidth={120} minHeight={90} />
{/if}

<ObjectPreviewLayout
  title="ai.img"
  objectType="ai.img"
  {nodeId}
  {previewWidth}
  {displayExtraMenuItems}
  onrun={generateImage}
  {editorReady}
  codeDataKey="prompt"
  codeLanguage="plain"
  onCodeChange={setPrompt}
>
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
    <div
      class={['relative', !!errorMessage && 'nowheel']}
      style:width={`${previewWidth}px`}
      style:height={`${previewHeight}px`}
    >
      {#if !hasImage || isLoading}
        <div
          class={[
            'absolute h-full w-full',
            !!errorMessage && 'rounded-md border border-red-300 bg-zinc-900',
            !errorMessage && 'pointer-events-none'
          ]}
        >
          <div
            class={['flex h-full items-center', errorMessage ? 'justify-start' : 'justify-center']}
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
              {@const PreviewIcon = isLoading ? Loader : ImageIcon}
              <PreviewIcon class={`h-8 w-8 text-zinc-300 ${isLoading ? 'animate-spin' : ''}`} />
            {/if}
          </div>
        </div>
      {/if}

      <canvas
        bind:this={canvasElement}
        width={imageWidth}
        height={imageHeight}
        class="h-full w-full rounded-md bg-zinc-900 object-contain"
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
      <ImageGenerationSettings
        {nodeId}
        provider={$aiSettings.provider === 'openrouter' ? 'openrouter' : 'gemini'}
        model={data.model?.trim() || defaultModelPlaceholder}
        options={$aiSettings.provider === 'openrouter'
          ? data.openRouterOptions
          : data.geminiOptions}
      />
      <button
        aria-expanded={showModelSettings}
        class="nodrag flex w-full cursor-pointer items-center justify-between border-t border-zinc-700/50 px-2 py-1.5 text-zinc-600 transition-colors hover:text-zinc-400"
        onclick={() => (showModelSettings = !showModelSettings)}
      >
        <div class="flex items-center gap-1.5">
          <SlidersHorizontal class="h-3 w-3" />
          <span class="font-mono text-[10px]">model settings</span>
        </div>

        <ChevronDown class={['h-3 w-3 transition-transform', showModelSettings && 'rotate-180']} />
      </button>

      {#if showModelSettings}
        <div class="px-2 pb-2">
          <div class="flex items-center gap-1.5">
            <Bot class="h-3 w-3 shrink-0 text-zinc-600" />

            <input
              type="text"
              value={data.model ?? ''}
              oninput={(e) =>
                updateNodeData(nodeId, { model: (e.target as HTMLInputElement).value })}
              onfocus={modelTracker.onFocus}
              onblur={modelTracker.onBlur}
              placeholder={defaultModelPlaceholder}
              class="nodrag min-w-0 flex-1 bg-transparent font-mono text-[11px] text-zinc-400 placeholder-zinc-600 focus:outline-none"
            />
          </div>
        </div>
      {/if}
    </div>
  {/snippet}
</ObjectPreviewLayout>
