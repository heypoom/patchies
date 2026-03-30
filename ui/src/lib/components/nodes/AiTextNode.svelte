<script lang="ts">
  import { Copy, Loader, Bot, SlidersHorizontal, ChevronDown } from '@lucide/svelte/icons';
  import { useNodeConnections, useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { createLLMFunction } from '$lib/ai/google';
  import { EditorView } from 'codemirror';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import ObjectPreviewLayout from '../ObjectPreviewLayout.svelte';
  import { match } from 'ts-pattern';
  import { aiTxtMessages } from '$lib/objects/schemas';
  import { aiSettings } from '../../../stores/ai-settings.store';

  let {
    id: nodeId,
    data
  }: { id: string; data: { prompt: string; model?: string; temperature?: number; topK?: number } } =
    $props();

  const { updateNodeData } = useSvelteFlow();

  const messageContext = new MessageContext(nodeId);

  let errorMessage = $state<string | null>(null);
  let isLoading = $state(false);
  let generatedText = $state<string>('');
  let abortController: AbortController | null = null;
  let editorReady = $state(false);
  let showModelSettings = $state(false);

  const prompt = $derived(data.prompt || '');
  const setPrompt = (prompt: string) => updateNodeData(nodeId, { prompt });

  const defaultModelPlaceholder = $derived(
    $aiSettings.provider === 'openrouter' ? $aiSettings.openRouterModel : 'gemini-3-flash-preview'
  );

  const targetConnections = useNodeConnections({ id: nodeId, handleType: 'target' });

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(aiTxtMessages.string, (prompt) => {
          setPrompt(prompt);
          setTimeout(() => generateText());
        })
        .with(aiTxtMessages.generate, ({ prompt }) => {
          setPrompt(prompt);
          setTimeout(() => generateText());
        })
        .with(aiTxtMessages.set, ({ value }) => {
          setPrompt(value);
        })
        .with(aiTxtMessages.bang, () => {
          generateText();
        });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  };

  onMount(() => {
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });

  async function generateText() {
    if (isLoading) {
      if (abortController) {
        abortController.abort();
      }
      isLoading = false;
      return;
    }

    isLoading = true;
    errorMessage = null;
    generatedText = '';

    try {
      const llmFunction = createLLMFunction();
      abortController = new AbortController();

      const imageNodeId = targetConnections.current.find((conn) =>
        conn.targetHandle?.startsWith('video-in')
      )?.source;

      const llmOutput = await llmFunction(prompt, {
        imageNodeId,
        abortSignal: abortController.signal,
        model: data.model?.trim() || undefined,
        temperature: data.temperature,
        topK: data.topK
      });

      generatedText = llmOutput ?? '';

      messageContext.send(llmOutput);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generatedText);
  }
</script>

<ObjectPreviewLayout title="ai.txt" objectType="ai.txt" onrun={generateText} {editorReady}>
  {#snippet topHandle()}
    <TypedHandle port="inlet" spec={{ handleType: 'message' }} total={2} index={0} {nodeId} />
    <TypedHandle
      port="inlet"
      spec={{ handleType: 'video', handleId: '0' }}
      title="Video input (optional)"
      total={2}
      index={1}
      {nodeId}
    />
  {/snippet}

  {#snippet preview()}
    <div class="relative w-[300px]">
      <div class="rounded-lg border border-zinc-600 bg-zinc-900">
        {#if isLoading}
          <div class="flex h-full min-h-[100px] items-center justify-center">
            <Loader class="h-6 w-6 animate-spin text-zinc-300" />
          </div>
        {:else if generatedText}
          <div class="nodrag nopan nowheel relative">
            <div
              class="max-h-[200px] min-h-[100px] w-full overflow-y-scroll rounded bg-transparent p-3 font-mono text-xs text-zinc-100 select-text focus:border-zinc-500 focus:outline-none"
            >
              {generatedText}
            </div>

            <button
              onclick={copyToClipboard}
              class="absolute top-1 right-1 rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              title="Copy to clipboard"
            >
              <Copy class="h-4 w-4 text-zinc-300" />
            </button>
          </div>
        {:else}
          <div
            class="flex h-full min-h-[100px] items-center justify-center py-2 text-zinc-400"
            ondblclick={generateText}
            role="button"
            tabindex="0"
          >
            {#if data.prompt}
              <span class="font-mono text-xs"
                ><span class="text-zinc-300">double click</span> to run</span
              >
            {:else}
              <span class="font-mono text-xs">set a prompt to continue</span>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet bottomHandle()}
    <TypedHandle port="outlet" spec={{ handleType: 'message' }} total={1} index={0} {nodeId} />
  {/snippet}

  {#snippet codeEditor()}
    <div class="w-[350px]">
      <CodeEditor
        value={prompt}
        onchange={(newPrompt) => {
          updateNodeData(nodeId, { prompt: newPrompt });
        }}
        language="plain"
        placeholder="Write your prompt here..."
        class="nodrag h-64 w-full max-w-[350px] resize-none"
        onrun={generateText}
        onready={() => (editorReady = true)}
        extraExtensions={[EditorView.lineWrapping]}
        {nodeId}
        dataKey="prompt"
      />

      <button
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
        <div class="space-y-1.5 px-2 pb-2">
          <div class="flex items-center gap-1.5">
            <Bot class="h-3 w-3 shrink-0 text-zinc-600" />
            <input
              type="text"
              value={data.model ?? ''}
              oninput={(e) =>
                updateNodeData(nodeId, { model: (e.target as HTMLInputElement).value })}
              placeholder={defaultModelPlaceholder}
              class="nodrag min-w-0 flex-1 bg-transparent font-mono text-[11px] text-zinc-400 placeholder-zinc-600 focus:outline-none"
            />
          </div>
          <div class="flex gap-4">
            <div class="flex items-center gap-1.5">
              <span class="font-mono text-[10px] text-zinc-600">temp</span>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={data.temperature ?? ''}
                oninput={(e) => {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  updateNodeData(nodeId, { temperature: isNaN(v) ? undefined : v });
                }}
                placeholder="1"
                class="nodrag w-14 bg-transparent font-mono text-[11px] text-zinc-400 placeholder-zinc-600 focus:outline-none"
              />
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-mono text-[10px] text-zinc-600">top-k</span>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={data.topK ?? ''}
                oninput={(e) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  updateNodeData(nodeId, { topK: isNaN(v) ? undefined : v });
                }}
                placeholder="40"
                class="nodrag w-14 bg-transparent font-mono text-[11px] text-zinc-400 placeholder-zinc-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
      {/if}

      {#if errorMessage}
        <div class="mt-2 px-2 py-1 font-mono text-xs text-red-300">
          {errorMessage}
        </div>
      {/if}
    </div>
  {/snippet}
</ObjectPreviewLayout>
