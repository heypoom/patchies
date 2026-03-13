<script lang="ts">
  import { MessageSquare, Send, Trash2, Zap } from '@lucide/svelte/icons';
  import { match } from 'ts-pattern';
  import { logger } from '$lib/utils/logger';
  import { toast } from 'svelte-sonner';
  import { selectedNodeInfo } from '../../../stores/ui.store';
  import {
    streamChatMessage,
    type ChatMessage,
    type ChatAction,
    type ChatNode
  } from '$lib/ai/chat/resolver';
  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
  import MarkdownContent from '$lib/components/MarkdownContent.svelte';
  import ActionCard from './ActionCard.svelte';
  import { SvelteMap } from 'svelte/reactivity';

  let {
    aiCallbacks,
    getNodeById
  }: {
    aiCallbacks?: AiPromptCallbacks;
    getNodeById?: (nodeId: string) => ChatNode | undefined;
  } = $props();

  interface ThreadActionRef {
    id: string;
    type: string;
    summary?: string;
  }

  interface ThreadMessage {
    role: 'user' | 'model';
    content: string;
    thinking?: string;
    actions?: ThreadActionRef[];
  }

  const actions = new SvelteMap<string, ChatAction>();

  let messages = $state<ThreadMessage[]>([]);
  let inputText = $state('');
  let isLoading = $state(false);
  let streamingText = $state('');
  let thinkingText = $state('');
  let pendingActions = $state<string[]>([]);
  let autoApprove = $state(false);
  let abortController: AbortController | null = $state(null);
  let messagesEl: HTMLDivElement | undefined = $state();

  const nodeContext = $derived.by(() => {
    if (!$selectedNodeInfo) return null;

    const errors = logger
      .getNodeLogs($selectedNodeInfo.id)
      .filter((e) => e.level === 'error')
      .map((e) => e.message);

    return {
      nodeId: $selectedNodeInfo.id,
      nodeType: $selectedNodeInfo.type,
      nodeData: $selectedNodeInfo.data,
      consoleErrors: errors.length > 0 ? errors : undefined
    };
  });

  $effect(() => {
    void messages;
    void streamingText;

    setTimeout(() => {
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }, 0);
  });

  function updateActionState(id: string, state: 'applied' | 'dismissed') {
    const action = actions.get(id);
    if (!action) return;

    actions.set(id, { ...action, state });
  }

  function applyAction(action: ChatAction) {
    if (!aiCallbacks) return;

    match(action.result)
      .with({ kind: 'single' }, (r) => aiCallbacks!.onInsertObject(r.type, r.data))
      .with({ kind: 'multi' }, (r) => aiCallbacks!.onInsertMultipleObjects(r.nodes, r.edges))
      .with({ kind: 'edit' }, (r) => aiCallbacks!.onEditObject(r.nodeId, r.data))
      .with({ kind: 'replace' }, (r) =>
        aiCallbacks!.onReplaceObject(r.nodeId, r.newType, r.newData)
      )
      .exhaustive();

    updateActionState(action.id, 'applied');
  }

  async function handleSubmit() {
    if (!inputText.trim() || isLoading) return;

    const userContent = inputText.trim();

    const chatHistory: ChatMessage[] = [
      ...messages.map((m) => {
        let content = m.content;

        if (m.actions && m.actions.length > 0) {
          const actionSummary = m.actions.map((a) => `[Action: ${a.summary ?? a.type}]`).join(' ');

          content = content ? `${content}\n${actionSummary}` : actionSummary;
        }

        return { role: m.role, content };
      }),
      { role: 'user', content: userContent }
    ];

    messages = [...messages, { role: 'user', content: userContent }];
    inputText = '';
    isLoading = true;
    streamingText = '';
    thinkingText = '';
    pendingActions = [];
    abortController = new AbortController();

    try {
      const fullText = await streamChatMessage(
        chatHistory,
        nodeContext,
        (chunk) => {
          streamingText += chunk;
        },
        abortController.signal,
        (thought) => {
          thinkingText += thought;
        },
        getNodeById,
        aiCallbacks
          ? (action) => {
              actions.set(action.id, action);

              pendingActions = [...pendingActions, action.id];

              if (autoApprove) {
                applyAction(action);
              }
            }
          : undefined
      );

      const completedActions: ThreadActionRef[] = pendingActions.map((id) => {
        const action = actions.get(id);
        return {
          id,
          type: action?.mode ?? 'unknown',
          summary: action ? `${action.descriptor.label}: ${action.result.kind}` : undefined
        };
      });

      messages = [
        ...messages,
        {
          role: 'model',
          content: fullText,
          thinking: thinkingText || undefined,
          actions: completedActions.length > 0 ? completedActions : undefined
        }
      ];

      streamingText = '';
      thinkingText = '';
      pendingActions = [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message !== 'Request cancelled') {
        toast.error(message);
      }

      streamingText = '';
      thinkingText = '';
      pendingActions = [];
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
    actions.clear();
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
        Context: <span class="text-zinc-200"
          >{(nodeContext.nodeData?.name as string) ||
            (nodeContext.nodeData?.title as string) ||
            nodeContext.nodeType}</span
        >
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
        <div
          class="max-w-[90%] rounded border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs leading-relaxed text-zinc-200"
        >
          <pre class="font-sans whitespace-pre-wrap">{message.content}</pre>
        </div>
      {:else}
        <div class="flex items-start gap-2">
          {#if !message.actions?.length || message.thinking || message.content}
            <div class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600"></div>
          {/if}

          <div class="min-w-0 flex-1">
            {#if message.thinking}
              <details>
                <summary
                  class="cursor-pointer list-none font-mono text-[10px] text-zinc-600 hover:text-zinc-500"
                >
                  Thinking
                </summary>

                <div class="mt-1 font-mono text-[10px] leading-relaxed text-zinc-700">
                  <MarkdownContent markdown={message.thinking} />
                </div>
              </details>
            {/if}

            {#if message.content}
              <MarkdownContent markdown={message.content} />
            {/if}

            <div
              class={message.actions?.length && (message.thinking || message.content) ? 'mt-2' : ''}
            >
              {#each message.actions ?? [] as ref (ref.id)}
                {@const action = actions.get(ref.id)}

                {#if action && aiCallbacks}
                  <ActionCard
                    {action}
                    callbacks={aiCallbacks}
                    onStateChange={updateActionState}
                    {getNodeById}
                  />
                {/if}
              {/each}
            </div>
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
          {/if}

          {#if thinkingText}
            <details open>
              <summary
                class="cursor-pointer list-none font-mono text-[10px] text-zinc-600 hover:text-zinc-500"
              >
                Thinking
              </summary>

              <div class="mt-1 font-mono text-[10px] leading-relaxed text-zinc-700">
                <MarkdownContent markdown={thinkingText} />
              </div>
            </details>
          {/if}

          <!-- ActionCards visible while response is still streaming -->
          {#each pendingActions as actionId (actionId)}
            {@const action = actions.get(actionId)}

            {#if action && aiCallbacks}
              <ActionCard
                {action}
                callbacks={aiCallbacks}
                onStateChange={updateActionState}
                {getNodeById}
              />
            {/if}
          {/each}
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

      <div class="flex items-center gap-1.5">
        {#if aiCallbacks}
          <button
            onclick={() => (autoApprove = !autoApprove)}
            class="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 font-mono text-[10px] transition-colors {autoApprove
              ? 'bg-purple-900/50 text-purple-400'
              : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
            title={autoApprove ? 'Auto-approve on' : 'Auto-approve off'}
          >
            <Zap class="h-3 w-3" />
            Auto
          </button>
        {/if}

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
