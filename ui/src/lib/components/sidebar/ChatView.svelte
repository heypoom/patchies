<script lang="ts">
  import { MessageSquare, Send, Trash2 } from '@lucide/svelte/icons';
  import { toast } from 'svelte-sonner';
  import { selectedNodeInfo } from '../../../stores/ui.store';
  import { streamChatMessage, type ChatMessage } from '$lib/ai/chat/resolver';
  import MarkdownContent from '$lib/components/MarkdownContent.svelte';

  let messages = $state<ChatMessage[]>([]);
  let inputText = $state('');
  let isLoading = $state(false);
  let streamingText = $state('');
  let thinkingText = $state('');
  let abortController: AbortController | null = $state(null);
  let messagesEl: HTMLDivElement | undefined = $state();

  const nodeContext = $derived(
    $selectedNodeInfo
      ? { nodeType: $selectedNodeInfo.type, nodeData: $selectedNodeInfo.data }
      : null
  );

  $effect(() => {
    // Re-run when messages or streamingText change, scroll after DOM update
    void messages;
    void streamingText;
    setTimeout(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 0);
  });

  async function handleSubmit() {
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: inputText.trim() };
    const nextMessages = [...messages, userMessage];
    messages = nextMessages;
    inputText = '';
    isLoading = true;
    streamingText = '';
    thinkingText = '';
    abortController = new AbortController();

    try {
      const fullText = await streamChatMessage(
        nextMessages,
        nodeContext,
        (chunk) => {
          streamingText += chunk;
        },
        abortController.signal,
        (thought) => {
          thinkingText += thought;
        }
      );

      messages = [
        ...nextMessages,
        { role: 'model', content: fullText, thinking: thinkingText || undefined }
      ];
      streamingText = '';
      thinkingText = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message !== 'Request cancelled') {
        toast.error(message);
      }
      streamingText = '';
      thinkingText = '';
    } finally {
      isLoading = false;
      abortController = null;
    }
  }

  function handleCancel() {
    abortController?.abort();
    abortController = null;
  }

  function handleClear() {
    messages = [];
    streamingText = '';
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="flex h-full flex-col">
  <!-- Node context banner -->
  {#if nodeContext}
    <div class="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
      <MessageSquare class="h-3 w-3 shrink-0 text-purple-400" />

      <span class="min-w-0 truncate font-mono text-xs text-zinc-400">
        Context: <span class="text-zinc-200">{nodeContext.nodeType}</span>
      </span>
    </div>
  {/if}

  <!-- Messages -->
  <div bind:this={messagesEl} class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
    {#if messages.length === 0 && !isLoading}
      <div class="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
        <MessageSquare class="h-8 w-8" />

        <p class="text-center font-mono text-[10px]">
          Ask anything about Patchies,<br />or get help with your patch
        </p>
      </div>
    {/if}

    {#each messages as message, index (index)}
      {#if message.role === 'user'}
        <div class="flex justify-end">
          <div
            class="max-w-[85%] rounded-lg bg-zinc-800 px-3 py-2 text-xs leading-relaxed text-zinc-200"
          >
            <pre class="font-sans whitespace-pre-wrap">{message.content}</pre>
          </div>
        </div>
      {:else}
        <div class="flex items-start gap-2">
          <div class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600"></div>
          <div class="min-w-0 flex-1">
            {#if message.thinking}
              <details class="mb-2">
                <summary
                  class="cursor-pointer list-none font-mono text-[10px] text-zinc-600 hover:text-zinc-500"
                >
                  Thinking
                </summary>

                <div class="mt-1 text-zinc-700 opacity-60">
                  <MarkdownContent markdown={message.thinking} />
                </div>
              </details>
            {/if}
            <MarkdownContent markdown={message.content} />
          </div>
        </div>
      {/if}
    {/each}

    <!-- Streaming response (in-flight) -->
    {#if isLoading}
      <div class="flex items-start gap-2">
        <div
          class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full {streamingText
            ? 'bg-zinc-600'
            : 'animate-pulse bg-zinc-700'}"
        ></div>
        <div class="min-w-0 flex-1">
          {#if streamingText}
            <MarkdownContent markdown={streamingText} />
          {:else}
            <span class="text-xs text-zinc-500">Thinking...</span>
          {/if}

          {#if thinkingText}
            <details class="mt-2">
              <summary
                class="cursor-pointer list-none font-mono text-[10px] text-zinc-600 hover:text-zinc-500"
              >
                Thinking
              </summary>
              <div class="mt-1 font-mono text-[10px] leading-relaxed text-zinc-700">
                {thinkingText}
              </div>
            </details>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Input area -->
  <div>
    <div class="m-2.5">
      <textarea
        bind:value={inputText}
        onkeydown={handleKeydown}
        placeholder="Ask anything..."
        disabled={isLoading}
        rows="3"
        class="nodrag flex w-full resize-none rounded-sm border-1 border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none focus-within:border-zinc-500 disabled:opacity-50"
      ></textarea>
    </div>

    <div class="mx-2.5 flex items-center justify-between pb-1.5">
      <span class="font-mono text-[10px] text-zinc-700">Shift+Enter for newline</span>

      <div class="flex gap-1.5">
        {#if messages.length > 0 && !isLoading}
          <button
            onclick={handleClear}
            class="cursor-pointer rounded p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
            title="Clear conversation"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        {/if}

        {#if isLoading}
          <button
            onclick={handleCancel}
            class="cursor-pointer rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            Cancel
          </button>
        {:else}
          <button
            onclick={handleSubmit}
            disabled={!inputText.trim() || isLoading}
            class="cursor-pointer rounded bg-zinc-700 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send class="h-3.5 w-3.5" />
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
