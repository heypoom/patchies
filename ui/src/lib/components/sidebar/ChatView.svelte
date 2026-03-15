<script lang="ts">
  import {
    BotMessageSquare,
    ImagePlus,
    MessageSquare,
    Send,
    Settings,
    Square,
    Trash2,
    X
  } from '@lucide/svelte/icons';
  import { compressImageFile } from '$lib/ai/google';
  import { match } from 'ts-pattern';
  import { logger } from '$lib/utils/logger';
  import { toast } from 'svelte-sonner';
  import { onMount } from 'svelte';
  import { selectedNodeInfo } from '../../../stores/ui.store';
  import {
    streamChatMessage,
    generateChatTitle,
    type ChatMessage,
    type ChatAction,
    type ChatNode,
    type ChatGraphSummary
  } from '$lib/ai/chat/resolver';
  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
  import MarkdownContent from '$lib/components/MarkdownContent.svelte';
  import ActionCard from './ActionCard.svelte';
  import PersistedActionCard from './PersistedActionCard.svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { personaStore, BUILTIN_PRESETS, type Persona } from '../../../stores/persona.store';
  import {
    loadChatMessages,
    saveChatMessages,
    deleteChatMessages
  } from '../../../stores/chat-history.store';
  import { getDraft, setDraft } from '../../../stores/chat-sessions.store';
  import { chatSettingsStore } from '../../../stores/chat-settings.store';
  import type { ThreadMessage, StagedImage, ThreadActionRef } from '$lib/ai/chat/types';

  let {
    sessionId,
    aiCallbacks,
    getNodeById,
    getGraphSummary,
    onRename
  }: {
    sessionId: string;
    aiCallbacks?: AiPromptCallbacks;
    getNodeById?: (nodeId: string) => ChatNode | undefined;
    getGraphSummary?: () => ChatGraphSummary;
    onRename?: (name: string) => void;
  } = $props();

  const actions = new SvelteMap<string, ChatAction>();

  let messages = $state<ThreadMessage[]>([]);
  let inputText = $state(getDraft(sessionId));

  onMount(async () => {
    messages = await loadChatMessages(sessionId);
  });

  $effect(() => {
    if (messages.length > 0) {
      saveChatMessages(sessionId, messages);
    }
  });

  // Persist draft input text per session (non-reactive to avoid update loops)
  $effect(() => {
    setDraft(sessionId, inputText);
  });

  let isLoading = $state(false);
  let streamingText = $state('');
  let thinkingText = $state('');
  let pendingActions = $state<string[]>([]);
  let autoApprove = $state(false);
  let abortController: AbortController | null = $state(null);
  let messagesEl: HTMLDivElement | undefined = $state();
  let stagedImages = $state<StagedImage[]>([]);
  let fileInputEl: HTMLInputElement | undefined = $state();
  let personaPanelOpen = $state(false);
  let settingsPanelOpen = $state(false);
  let confirmingClear = $state(false);
  let addingCustom = $state(false);
  let newPersonaName = $state('');
  let newPersonaPrompt = $state('');

  const allPersonas = $derived([...BUILTIN_PRESETS, ...$personaStore.custom]);
  const activePersona = $derived(
    allPersonas.find((p: Persona) => p.id === $personaStore.activeId) ?? null
  );

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

    // Persist state to ThreadActionRef in messages so it survives reload
    messages = messages.map((m) => {
      if (!m.actions) return m;
      const updated = m.actions.map((ref) => (ref.id === id ? { ...ref, state } : ref));
      return { ...m, actions: updated };
    });
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
      .with({ kind: 'connect-edges' }, (r) => aiCallbacks!.onConnectEdges(r.edges))
      .exhaustive();

    updateActionState(action.id, 'applied');
  }

  async function handleSubmit() {
    if ((!inputText.trim() && stagedImages.length === 0) || isLoading) return;

    const userContent = inputText.trim();
    const imagesToSend = [...stagedImages];
    stagedImages = [];

    const chatHistory: ChatMessage[] = [
      ...messages.map((m) => {
        let content = m.content;

        if (m.actions && m.actions.length > 0) {
          const actionSummary = m.actions
            .map((a) => `[Action ${a.state ?? 'applied'}: ${a.summary ?? a.type}]`)
            .join(' ');

          content = content ? `${content}\n${actionSummary}` : actionSummary;
        }

        return { role: m.role, content, images: m.images };
      }),
      {
        role: 'user',
        content: userContent,
        images: imagesToSend.length > 0 ? imagesToSend : undefined
      }
    ];

    const isFirstMessage = messages.length === 0;

    messages = [
      ...messages,
      {
        role: 'user',
        content: userContent,
        images: imagesToSend.length > 0 ? imagesToSend : undefined
      }
    ];

    inputText = '';
    isLoading = true;

    if (isFirstMessage && onRename && userContent) {
      generateChatTitle(userContent).then((title) => {
        if (title) onRename(title);
      });
    }

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
          : undefined,
        getGraphSummary,
        activePersona?.prompt || undefined
      );

      const completedActions: ThreadActionRef[] = pendingActions.map((id) => {
        const action = actions.get(id);

        const summary = action
          ? match(action.result)
              .with({ kind: 'single' }, (r) => `Created ${r.type}`)
              .with({ kind: 'multi' }, (r) => `Created ${r.nodes.length} objects`)
              .with({ kind: 'edit' }, () => `Edited object`)
              .with({ kind: 'replace' }, (r) => `Replaced with ${r.newType}`)
              .with(
                { kind: 'connect-edges' },
                (r) => `Connected ${r.edges.length} edge${r.edges.length === 1 ? '' : 's'}`
              )
              .exhaustive()
          : undefined;

        return {
          id,
          type: action?.mode ?? 'unknown',
          summary,
          state: action?.state === 'dismissed' ? 'dismissed' : 'applied'
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

    deleteChatMessages(sessionId);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  async function stageFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    for (const file of imageFiles) {
      const compressed = await compressImageFile(file);
      stagedImages = [
        ...stagedImages,
        { ...compressed, previewUrl: `data:${compressed.mimeType};base64,${compressed.data}` }
      ];
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files) stageFiles(event.dataTransfer.files);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handlePaste(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) stageFiles(files);
  }
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
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
          {#if message.images?.length}
            <div class="mb-1.5 flex flex-wrap gap-1">
              {#each message.images as img, i (i)}
                <img
                  src={img.previewUrl}
                  alt="Attached image {i + 1}"
                  class="h-14 w-14 rounded border border-zinc-700 object-cover"
                />
              {/each}
            </div>
          {/if}
          {#if message.content}
            <pre class="font-sans whitespace-pre-wrap">{message.content}</pre>
          {/if}
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
                {:else if ref.summary || ref.type}
                  <PersistedActionCard {ref} />
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
          {#if thinkingText}
            <details open={$chatSettingsStore.expandThinking}>
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

          {#if streamingText}
            <MarkdownContent markdown={streamingText} />
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

  <!-- Persona panel -->
  {#if personaPanelOpen}
    <div class="border-t border-zinc-800 bg-zinc-900/60 p-2.5">
      <!-- Preset + custom persona chips -->
      <div class="mb-2 flex flex-wrap gap-1">
        <button
          onclick={() => personaStore.setActive(null)}
          class="cursor-pointer rounded px-2 py-0.5 font-mono text-[10px] transition-colors {$personaStore.activeId ===
          null
            ? 'bg-zinc-600 text-zinc-100'
            : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
        >
          None
        </button>

        {#each allPersonas as p (p.id)}
          <div class="flex items-center gap-0.5">
            <button
              onclick={() => personaStore.setActive(p.id)}
              class="cursor-pointer rounded px-2 py-0.5 font-mono text-[10px] transition-colors {$personaStore.activeId ===
              p.id
                ? 'bg-purple-700/60 text-purple-200'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}"
            >
              {p.name}
            </button>
            {#if !BUILTIN_PRESETS.some((b) => b.id === p.id)}
              <button
                onclick={() => personaStore.removeCustom(p.id)}
                class="cursor-pointer text-zinc-700 hover:text-zinc-400"
              >
                <X class="h-2.5 w-2.5" />
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Active persona prompt preview -->
      {#if activePersona}
        <p class="mx-2 mb-1 line-clamp-3 font-mono text-[10px] leading-relaxed text-zinc-600">
          {activePersona.prompt}
        </p>
      {/if}

      <!-- Add custom persona form -->
      {#if addingCustom}
        <div class="mx-2 mt-3 flex flex-col gap-2.5">
          <input
            bind:value={newPersonaName}
            placeholder="Persona name"
            class="nodrag rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
          />

          <textarea
            bind:value={newPersonaPrompt}
            placeholder="System prompt..."
            rows="3"
            class="nodrag resize-none rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
          ></textarea>

          <div class="flex justify-end gap-1">
            <button
              onclick={() => {
                addingCustom = false;
                newPersonaName = '';
                newPersonaPrompt = '';
              }}
              class="cursor-pointer rounded px-2 py-0.5 font-mono text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              onclick={() => {
                if (newPersonaName.trim() && newPersonaPrompt.trim()) {
                  const p = personaStore.addCustom(newPersonaName.trim(), newPersonaPrompt.trim());
                  personaStore.setActive(p.id);
                  addingCustom = false;
                  newPersonaName = '';
                  newPersonaPrompt = '';
                }
              }}
              disabled={!newPersonaName.trim() || !newPersonaPrompt.trim()}
              class="cursor-pointer rounded bg-purple-700/60 px-2 py-0.5 font-mono text-[10px] text-purple-200 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      {:else}
        <button
          onclick={() => (addingCustom = true)}
          class="mx-2 cursor-pointer font-mono text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          + Add custom
        </button>
      {/if}
    </div>
  {/if}

  <!-- Settings panel -->
  {#if settingsPanelOpen}
    <div class="flex flex-col gap-1.5 border-t border-zinc-800 bg-zinc-900/60 px-3 py-2">
      {#if aiCallbacks}
        <label class="flex cursor-pointer items-center gap-2 font-mono text-[10px] text-zinc-400">
          <input
            type="checkbox"
            bind:checked={autoApprove}
            class="cursor-pointer accent-purple-500"
          />
          Auto-approve actions
        </label>
      {/if}

      <label class="flex cursor-pointer items-center gap-2 font-mono text-[10px] text-zinc-400">
        <input
          type="checkbox"
          checked={$chatSettingsStore.expandThinking}
          onchange={() => chatSettingsStore.toggleExpandThinking()}
          class="cursor-pointer accent-purple-500"
        />
        Auto-expand thinking
      </label>
    </div>
  {/if}

  {#if confirmingClear}
    <div
      class="flex shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900/80 px-3 py-2"
    >
      <span class="font-mono text-xs text-zinc-400">Clear chat?</span>
      <div class="flex items-center gap-2">
        <button
          onclick={() => (confirmingClear = false)}
          class="cursor-pointer rounded px-3 py-1 font-mono text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        >
          Cancel
        </button>
        <button
          onclick={() => {
            confirmingClear = false;
            handleClear();
          }}
          class="cursor-pointer rounded bg-red-900/60 px-3 py-1 font-mono text-xs text-red-300 transition-colors hover:bg-red-800/60"
        >
          Clear
        </button>
      </div>
    </div>
  {/if}

  <!-- Input area -->
  <div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="m-2.5" ondrop={handleDrop} ondragover={handleDragOver}>
      {#if stagedImages.length > 0}
        <div class="mb-1.5 flex flex-wrap gap-1.5">
          {#each stagedImages as img, imageIndex (imageIndex)}
            <div class="relative">
              <img
                src={img.previewUrl}
                alt="Staged image {imageIndex + 1}"
                class="h-16 w-16 rounded border border-zinc-700 object-cover"
              />

              <button
                onclick={() => {
                  stagedImages = stagedImages.filter((_, i) => i !== imageIndex);
                }}
                class="absolute -top-1 -right-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X class="h-2.5 w-2.5" />
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <textarea
        bind:value={inputText}
        onkeydown={handleKeydown}
        onpaste={handlePaste}
        placeholder="Ask anything or drop/paste images. Shift+Enter for new line."
        disabled={isLoading}
        rows="3"
        class="nodrag flex w-full resize-none rounded-sm border-1 border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none focus-within:border-zinc-500 disabled:opacity-50"
      ></textarea>
    </div>

    <div
      class="mx-2.5 flex items-center justify-between"
      style="padding-bottom: calc(0.375rem + env(safe-area-inset-bottom, 0px))"
    >
      <div class="flex items-center gap-1">
        <button
          onclick={() => (personaPanelOpen = !personaPanelOpen)}
          class="flex h-6 cursor-pointer items-center gap-1 rounded px-1.5 font-mono text-[10px] transition-colors {personaPanelOpen ||
          activePersona
            ? 'bg-purple-900/50 text-purple-400'
            : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
          title={activePersona ? `Persona: ${activePersona.name}` : 'Set persona'}
        >
          <BotMessageSquare class="h-3 w-3" />
          {activePersona ? activePersona.name : 'Persona'}
        </button>

        <button
          onclick={() => (settingsPanelOpen = !settingsPanelOpen)}
          class="flex h-6 cursor-pointer items-center rounded px-1.5 transition-colors {settingsPanelOpen
            ? 'bg-zinc-700 text-zinc-300'
            : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
          title="Chat settings"
        >
          <Settings class="h-3 w-3" />
        </button>

        {#if messages.length > 0 && !isLoading}
          <button
            onclick={() => (confirmingClear = !confirmingClear)}
            class="flex h-6 cursor-pointer items-center rounded px-1.5 transition-colors {confirmingClear
              ? 'bg-red-900/50 text-red-400'
              : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
            title="Clear conversation"
          >
            <Trash2 class="h-3 w-3" />
          </button>
        {/if}
      </div>

      <div class="flex items-center gap-1.5">
        <input
          bind:this={fileInputEl}
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          onchange={(e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) stageFiles(files);
            if (fileInputEl) fileInputEl.value = '';
          }}
        />

        <button
          onclick={() => fileInputEl?.click()}
          disabled={isLoading}
          class="cursor-pointer rounded p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-30"
          title="Attach images"
        >
          <ImagePlus class="h-3.5 w-3.5" />
        </button>

        {#if isLoading}
          <button
            onclick={handleCancel}
            class="cursor-pointer rounded p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
            title="Cancel"
          >
            <Square class="h-3 w-3 fill-current" />
          </button>
        {:else}
          <button
            onclick={handleSubmit}
            disabled={(!inputText.trim() && stagedImages.length === 0) || isLoading}
            class="cursor-pointer rounded bg-zinc-700 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send class="h-3.5 w-3.5" />
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
