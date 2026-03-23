<script lang="ts">
  import {
    BotMessageSquare,
    ImagePlus,
    LoaderCircle,
    MessageSquare,
    Mic,
    Send,
    Settings,
    Square,
    Trash2,
    X,
    Youtube,
    Zap
  } from '@lucide/svelte/icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as Popover from '$lib/components/ui/popover';
  import { compressImageFile } from '$lib/ai/google';
  import { useVoiceInput } from '$lib/ai/useVoiceInput.svelte';
  import { getNodeErrors } from '$lib/utils/logger';
  import { onMount, onDestroy } from 'svelte';
  import { selectedNodeInfo } from '../../../stores/ui.store';
  import { type ChatNode, type ChatGraphSummary } from '$lib/ai/chat/resolver';
  import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
  import MarkdownContent from '$lib/components/MarkdownContent.svelte';
  import ActionCard from './ActionCard.svelte';
  import PersistedActionCard from './PersistedActionCard.svelte';
  import ChatStagedMedia from './ChatStagedMedia.svelte';
  import ChatToolCalls from './ChatToolCalls.svelte';
  import { getYouTubeLabel, extractYouTubeUrls } from './youtube-utils';
  import { personaStore, BUILTIN_PRESETS, type Persona } from '../../../stores/persona.store';
  import {
    getDraft,
    setDraft,
    getStagedYouTubeUrls,
    setStagedYouTubeUrls
  } from '../../../stores/chat-sessions.store';
  import { chatStreamStore } from '../../../stores/chat-streaming.store.svelte';
  import { chatSettingsStore } from '../../../stores/chat-settings.store';
  import type { StagedImage } from '$lib/ai/chat/types';

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

  // getSession creates the session if needed.
  // must not be called inside $derived
  const session = chatStreamStore.getSession(sessionId);

  let inputText = $state(getDraft(sessionId));

  onMount(async () => {
    await chatStreamStore.init(sessionId);
  });

  onDestroy(() => {
    voice.destroy();
  });

  // Persist draft input text per session (non-reactive to avoid update loops)
  $effect(() => {
    setDraft(sessionId, inputText);
  });

  // Live-detected YouTube URLs from the current input text (never mutates inputText)
  const detectedYouTubeUrls = $derived(
    extractYouTubeUrls(inputText).urls.filter((u) => !stagedYouTubeUrls.includes(u))
  );

  $effect(() => {
    setStagedYouTubeUrls(sessionId, stagedYouTubeUrls);
  });

  const SLASH_COMMANDS = [
    { name: '/clear', description: 'Clear the chat' },
    { name: '/compact', description: 'Summarize and compact the context' }
  ];

  let autoApprove = $state(false);
  let messagesEl: HTMLDivElement | undefined = $state();
  let stagedImages = $state<StagedImage[]>([]);
  const voice = useVoiceInput((text) => {
    inputText = inputText ? inputText + ' ' + text : text;
  });
  let fileInputEl: HTMLInputElement | undefined = $state();
  let personaPanelOpen = $state(false);
  let settingsPanelOpen = $state(false);
  let confirmingClear = $state(false);
  let addingCustom = $state(false);
  let newPersonaName = $state('');
  let newPersonaPrompt = $state('');
  let addFilesOpen = $state(false);
  let stagedYouTubeUrls = $state<string[]>(getStagedYouTubeUrls(sessionId));
  let addingYouTubeUrl = $state(false);
  let slashSelectedIndex = $state(0);

  const slashSuggestions = $derived(
    inputText.startsWith('/')
      ? SLASH_COMMANDS.filter((c) => c.name.startsWith(inputText.trim().toLowerCase()))
      : []
  );

  $effect(() => {
    void slashSuggestions;
    slashSelectedIndex = 0;
  });

  const allPersonas = $derived([...BUILTIN_PRESETS, ...$personaStore.custom]);
  const activePersona = $derived(
    allPersonas.find((p: Persona) => p.id === $personaStore.activeId) ?? null
  );

  const nodeContext = $derived.by(() => {
    if (!$selectedNodeInfo) return null;

    const errors = getNodeErrors($selectedNodeInfo.id);

    return {
      nodeId: $selectedNodeInfo.id,
      nodeType: $selectedNodeInfo.type,
      nodeData: $selectedNodeInfo.data,
      consoleErrors: errors.length > 0 ? errors : undefined
    };
  });

  $effect(() => {
    void session.messages;
    void session.streamingText;

    setTimeout(() => {
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }, 0);
  });

  function updateActionState(id: string, state: 'applied' | 'dismissed') {
    chatStreamStore.updateActionState(sessionId, id, state);
  }

  function executeSlashCommand(name: string) {
    if (name === '/clear') {
      handleClear();
    } else if (name === '/compact') {
      void chatStreamStore.compact(sessionId);
    }
    inputText = '';
  }

  function handleSubmit() {
    if (slashSuggestions.length > 0) {
      executeSlashCommand(slashSuggestions[slashSelectedIndex]?.name ?? slashSuggestions[0].name);
      return;
    }

    const emptyInput =
      !inputText.trim() &&
      stagedImages.length === 0 &&
      stagedYouTubeUrls.length === 0 &&
      detectedYouTubeUrls.length === 0;

    if (emptyInput || session.isLoading) return;

    const userContent = inputText.trim();
    const imagesToSend = [...stagedImages];
    const youtubeUrlsToSend = [...new Set([...stagedYouTubeUrls, ...detectedYouTubeUrls])];

    stagedImages = [];
    stagedYouTubeUrls = [];

    const chatHistory = [
      ...session.messages.map((m) => {
        let content = m.content;

        if (m.actions && m.actions.length > 0) {
          const actionSummary = m.actions
            .map((a) => `[Action ${a.state ?? 'applied'}: ${a.summary ?? a.type}]`)
            .join(' ');

          content = content ? `${content}\n${actionSummary}` : actionSummary;
        }

        return { role: m.role, content, images: m.images, youtubeUrls: m.youtubeUrls };
      }),
      {
        role: 'user' as const,
        content: userContent,
        images: imagesToSend.length > 0 ? imagesToSend : undefined,
        youtubeUrls: youtubeUrlsToSend.length > 0 ? youtubeUrlsToSend : undefined
      }
    ];

    const isFirstMessage = session.messages.length === 0;

    chatStreamStore.addUserMessage(sessionId, {
      role: 'user',
      content: userContent,
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
      youtubeUrls: youtubeUrlsToSend.length > 0 ? youtubeUrlsToSend : undefined
    });

    inputText = '';

    void chatStreamStore.startStream(sessionId, {
      chatHistory,
      nodeContext,
      getNodeById,
      getGraphSummary,
      activePersonaPrompt: activePersona?.prompt || undefined,
      aiCallbacks,
      autoApprove,
      onRename,
      isFirstMessage,
      userContent
    });
  }

  function handleCancel() {
    chatStreamStore.cancel(sessionId);
  }

  function handleClear() {
    chatStreamStore.clear(sessionId);

    const n = sessionId.replace('chat-', '');
    onRename?.(`Chat ${n}`);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (slashSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        slashSelectedIndex = (slashSelectedIndex + 1) % slashSuggestions.length;
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        slashSelectedIndex =
          (slashSelectedIndex - 1 + slashSuggestions.length) % slashSuggestions.length;
        return;
      }
      if (event.key === 'Escape') {
        inputText = '';
        return;
      }
    }

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

    if (event.dataTransfer?.files) {
      stageFiles(event.dataTransfer.files);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handlePaste(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);

    if (files.length > 0) {
      stageFiles(files);
    }
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
    {#if session.messages.length === 0 && !session.isLoading}
      <div class="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
        <MessageSquare class="h-8 w-8" />

        <p class="text-center font-mono text-[10px]">
          Ask anything about Patchies,<br />or get help with your patch
        </p>
      </div>
    {/if}

    {#each session.messages as message, index (index)}
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

          {#if message.youtubeUrls?.length}
            <div class="mb-1.5 flex flex-col gap-1">
              {#each message.youtubeUrls as url, i (i)}
                <div
                  class="flex items-center gap-1.5 rounded border border-zinc-700 bg-transparent px-2 py-1"
                >
                  <Youtube class="h-3 w-3 shrink-0 text-red-400" />

                  <span class="truncate font-mono text-[10px] text-zinc-400"
                    >YouTube: {getYouTubeLabel(url)}</span
                  >
                </div>
              {/each}
            </div>
          {/if}

          {#if message.content}
            <pre class="font-sans whitespace-pre-wrap">{message.content}</pre>
          {/if}
        </div>
      {:else if message.thinking}
        <div class="flex items-start gap-2">
          <div class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600"></div>

          <div class="min-w-0 flex-1">
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

            <ChatToolCalls calls={message.toolCalls ?? []} class="mt-1" />

            {#if message.content}
              <div class={message.toolCalls?.length ? 'mt-2' : ''}>
                <MarkdownContent markdown={message.content} />
              </div>
            {/if}

            <div class={message.actions?.length && message.content ? 'mt-2' : ''}>
              {#each message.actions ?? [] as ref (ref.id)}
                {@const action = session.actions.get(ref.id)}

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
      {:else}
        <ChatToolCalls calls={message.toolCalls ?? []} />

        {#if message.content}
          <div>
            <MarkdownContent markdown={message.content} />
          </div>
        {/if}

        <div class={message.actions?.length && message.content ? 'mt-2' : ''}>
          {#each message.actions ?? [] as ref (ref.id)}
            {@const action = session.actions.get(ref.id)}

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
      {/if}
    {/each}

    <!-- Streaming response (in-flight) -->
    {#if session.isLoading}
      {#if session.thinkingText}
        <div class="flex items-start gap-2">
          <div
            class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full {session.streamingText
              ? 'bg-zinc-600'
              : 'animate-pulse bg-zinc-700'}"
          ></div>

          <div class="min-w-0 flex-1">
            <details open={$chatSettingsStore.expandThinking}>
              <summary
                class="cursor-pointer list-none font-mono text-[10px] text-zinc-600 hover:text-zinc-500"
              >
                Thinking
              </summary>

              <div class="mt-1 font-mono text-[10px] leading-relaxed text-zinc-700">
                <MarkdownContent markdown={session.thinkingText} />
              </div>
            </details>

            <ChatToolCalls calls={session.streamingToolCalls} class="mt-1" />

            {#if session.streamingText}
              <div class={session.streamingToolCalls.length ? 'mt-2' : ''}>
                <MarkdownContent markdown={session.streamingText} />
              </div>
            {/if}

            <!-- ActionCards visible while response is still streaming -->
            {#each session.pendingActions as actionId (actionId)}
              {@const action = session.actions.get(actionId)}

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
      {:else}
        <ChatToolCalls calls={session.streamingToolCalls} />

        {#if session.streamingText}
          <div>
            <MarkdownContent markdown={session.streamingText} />
          </div>
        {/if}

        <!-- ActionCards visible while response is still streaming -->
        {#each session.pendingActions as actionId (actionId)}
          {@const action = session.actions.get(actionId)}

          {#if action && aiCallbacks}
            <ActionCard
              {action}
              callbacks={aiCallbacks}
              onStateChange={updateActionState}
              {getNodeById}
            />
          {/if}
        {/each}
      {/if}
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
      <ChatStagedMedia
        bind:stagedImages
        bind:stagedYouTubeUrls
        bind:addingYouTubeUrl
        {detectedYouTubeUrls}
      />

      {#if slashSuggestions.length > 0}
        <div class="mb-1 overflow-hidden rounded border border-zinc-700 bg-zinc-900">
          {#each slashSuggestions as cmd, i (cmd.name)}
            <button
              onclick={() => executeSlashCommand(cmd.name)}
              class="flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors {i ===
              slashSelectedIndex
                ? 'bg-zinc-800'
                : 'hover:bg-zinc-800/60'}"
            >
              <span class="font-mono text-xs text-zinc-100">{cmd.name}</span>
              <span class="font-mono text-[10px] text-zinc-500">{cmd.description}</span>
            </button>
          {/each}
        </div>
      {/if}

      <textarea
        bind:value={inputText}
        onkeydown={handleKeydown}
        onpaste={handlePaste}
        placeholder={voice.isRecording
          ? 'Listening...'
          : voice.isTranscribing
            ? 'Transcribing...'
            : 'Ask anything or drop/paste images. Shift+Enter for new line.'}
        disabled={session.isLoading || voice.isRecording || voice.isTranscribing}
        rows="3"
        style={voice.isRecording
          ? `border-color: rgba(239,68,68,${0.4 + voice.level * 0.6}); box-shadow: 0 0 0 ${(voice.level * 8).toFixed(1)}px rgba(239,68,68,${(0.2 + voice.level * 0.5).toFixed(2)})`
          : ''}
        class="nodrag flex w-full resize-y rounded-sm border-1 border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none focus-within:border-zinc-500 disabled:opacity-50"
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
            ? 'bg-purple-900/50 text-purple-400 hover:bg-purple-900/80'
            : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
          title={activePersona ? `Persona: ${activePersona.name}` : 'Set persona'}
        >
          <BotMessageSquare class="h-3 w-3" />

          {#if activePersona}
            {activePersona.name}
          {/if}
        </button>

        {#if aiCallbacks}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={() => (autoApprove = !autoApprove)}
                class="flex h-6 cursor-pointer items-center rounded px-1.5 transition-colors {autoApprove
                  ? 'bg-yellow-900/50 text-yellow-400 hover:bg-yellow-900/80'
                  : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
              >
                <Zap class="h-3 w-3" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Auto-approve actions</Tooltip.Content>
          </Tooltip.Root>
        {/if}

        <button
          onclick={() => (settingsPanelOpen = !settingsPanelOpen)}
          class="flex h-6 cursor-pointer items-center rounded px-1.5 transition-colors {settingsPanelOpen
            ? 'bg-zinc-700 text-zinc-300'
            : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
          title="Chat settings"
        >
          <Settings class="h-3 w-3" />
        </button>

        {#if session.messages.length > 0 && !session.isLoading}
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
          onclick={voice.toggle}
          disabled={session.isLoading || voice.isTranscribing}
          class="cursor-pointer rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30 {voice.isRecording
            ? 'animate-pulse text-red-400 hover:bg-zinc-800'
            : voice.isTranscribing
              ? 'text-blue-400'
              : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'}"
          title={voice.isRecording ? 'Stop recording' : 'Voice input'}
        >
          {#if voice.isTranscribing}
            <LoaderCircle class="h-3.5 w-3.5 animate-spin" />
          {:else if voice.isRecording}
            <Square class="h-3 w-3 fill-current" />
          {:else}
            <Mic class="h-3.5 w-3.5" />
          {/if}
        </button>

        <Popover.Root bind:open={addFilesOpen}>
          <Popover.Trigger>
            <button
              disabled={session.isLoading}
              class="cursor-pointer rounded p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-30"
              title="Add files"
            >
              <ImagePlus class="h-3.5 w-3.5" />
            </button>
          </Popover.Trigger>
          <Popover.Content class="w-36 border-zinc-700 bg-zinc-900 p-1" side="top" align="end">
            <button
              class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
              onclick={() => {
                addFilesOpen = false;
                fileInputEl?.click();
              }}
            >
              <ImagePlus class="h-3.5 w-3.5 text-zinc-400" />
              Files
            </button>
            <button
              class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800"
              onclick={() => {
                addFilesOpen = false;
                addingYouTubeUrl = true;
              }}
            >
              <Youtube class="h-3.5 w-3.5 text-red-400" />
              YouTube
            </button>
          </Popover.Content>
        </Popover.Root>

        {#if session.isLoading}
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
            disabled={(!inputText.trim() &&
              stagedImages.length === 0 &&
              stagedYouTubeUrls.length === 0) ||
              session.isLoading}
            class="cursor-pointer rounded bg-zinc-700 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send class="h-3.5 w-3.5" />
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
