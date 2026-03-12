<script lang="ts">
  import { Loader, Minus, Maximize2, ChevronDown, ChevronUp } from '@lucide/svelte/icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { match } from 'ts-pattern';
  import MarkdownContent from '$lib/components/MarkdownContent.svelte';
  import { isMobile, isSidebarOpen } from '../../stores/ui.store';
  import { aiPromptStore } from '../../stores/ai-prompt.store';
  import { createAiPromptController } from '$lib/ai/ai-prompt-controller.svelte';
  import { getModeDescriptor, getAvailableModesForContext } from '$lib/ai/modes/descriptors';
  import type { AiPromptMode, AiModeContext } from '$lib/ai/modes/types';
  import type { AiObjectNode, SimplifiedEdge } from '$lib/ai/types';

  let {
    open = $bindable(false),
    position,
    mode: initialMode = 'single',
    context: initialContext = {},
    onInsertObject,
    onInsertMultipleObjects,
    onEditObject,
    onReplaceObject
  }: {
    open?: boolean;
    position: { x: number; y: number };
    mode?: AiPromptMode;
    context?: AiModeContext;
    onInsertObject: (type: string, data: Record<string, unknown>) => void;
    onInsertMultipleObjects?: (nodes: AiObjectNode[], edges: SimplifiedEdge[]) => void;
    onEditObject?: (nodeId: string, data: Record<string, unknown>) => void;
    onReplaceObject?: (nodeId: string, newType: string, newData: Record<string, unknown>) => void;
  } = $props();

  // ── Controller ────────────────────────────────────────────────────────────
  const ctrl = createAiPromptController({
    onInsertObject,
    onInsertMultipleObjects: onInsertMultipleObjects ?? (() => {}),
    onEditObject: onEditObject ?? (() => {}),
    onReplaceObject: onReplaceObject ?? (() => {})
  });

  // ── UI-only state ─────────────────────────────────────────────────────────
  let promptInput: HTMLTextAreaElement | undefined = $state();
  let isDragging = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });
  let dialogPosition = $state({ x: position.x, y: position.y });
  let isMinimized = $state(false);
  let isPromptExpanded = $state(false);
  let modeDropdownOpen = $state(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const descriptor = $derived(ctrl.descriptor);

  const colorClasses = $derived(
    match(descriptor.color)
      .with('purple', () => ({
        border: 'border-purple-500',
        ring: 'ring-2 ring-purple-500/50',
        badge: 'border-purple-500 bg-purple-900/90 ring-2 ring-purple-500/50',
        button: 'bg-purple-600 hover:bg-purple-700'
      }))
      .with('blue', () => ({
        border: 'border-blue-500',
        ring: 'ring-2 ring-blue-500/50',
        badge: 'border-blue-500 bg-blue-900/90 ring-2 ring-blue-500/50',
        button: 'bg-blue-600 hover:bg-blue-700'
      }))
      .with('amber', () => ({
        border: 'border-amber-500',
        ring: 'ring-2 ring-amber-500/50',
        badge: 'border-amber-500 bg-amber-900/90 ring-2 ring-amber-500/50',
        button: 'bg-amber-600 hover:bg-amber-700'
      }))
      .with('green', () => ({
        border: 'border-green-500',
        ring: 'ring-2 ring-green-500/50',
        badge: 'border-green-500 bg-green-900/90 ring-2 ring-green-500/50',
        button: 'bg-green-600 hover:bg-green-700'
      }))
      .with('red', () => ({
        border: 'border-red-500',
        ring: 'ring-2 ring-red-500/50',
        badge: 'border-red-500 bg-red-900/90 ring-2 ring-red-500/50',
        button: 'bg-red-600 hover:bg-red-700'
      }))
      .exhaustive()
  );

  const focusBorderClass = $derived(
    match(descriptor.color)
      .with('purple', () => 'focus:border-purple-500 focus:ring-1 focus:ring-purple-500')
      .with('blue', () => 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500')
      .with('amber', () => 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500')
      .with('green', () => 'focus:border-green-500 focus:ring-1 focus:ring-green-500')
      .with('red', () => 'focus:border-red-500 focus:ring-1 focus:ring-red-500')
      .exhaustive()
  );

  const availableModes = $derived(getAvailableModesForContext(ctrl.context));

  const submitLabel = $derived(
    match(ctrl.mode)
      .with('edit', () => 'Edit')
      .with('replace', () => 'Replace')
      .with('fix-error', () => 'Fix')
      .otherwise(() => 'Insert')
  );

  // ── Sync ctrl with incoming props when opening ────────────────────────────
  $effect(() => {
    if (open) {
      ctrl.open(initialMode, Object.keys(initialContext).length > 0 ? initialContext : undefined);

      dialogPosition = $isMobile
        ? { x: position.x, y: position.y }
        : {
            x: Math.max(16, (window.innerWidth - 384) / 2),
            y: Math.max(16, window.innerHeight / 3)
          };

      setTimeout(() => promptInput?.focus(), 0);
    }
  });

  // ── Sync store for toolbar button styling ─────────────────────────────────
  $effect(() => {
    if (open) {
      aiPromptStore.open(ctrl.mode);
    } else {
      aiPromptStore.close();
    }
  });

  $effect(() => {
    aiPromptStore.setLoading(ctrl.isLoading);
  });

  $effect(() => {
    if (open) aiPromptStore.setMode(ctrl.mode);
  });

  // ── Drag handlers ─────────────────────────────────────────────────────────
  function handleHeaderMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;

    isDragging = true;
    if ($isMobile) {
      dragOffset = { x: event.clientX - dialogPosition.x, y: event.clientY - dialogPosition.y };
    } else {
      dragOffset = {
        x: window.innerWidth - event.clientX - dialogPosition.x,
        y: event.clientY - dialogPosition.y
      };
    }
    event.preventDefault();
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging) return;
    dialogPosition = $isMobile
      ? { x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y }
      : {
          x: window.innerWidth - event.clientX - dragOffset.x,
          y: event.clientY - dragOffset.y
        };
  }

  function handleMouseUp() {
    isDragging = false;
  }

  // ── Open/Close ────────────────────────────────────────────────────────────
  function handleMinimize() {
    isMinimized = true;
  }

  function handleRestore() {
    isMinimized = false;
    if (!$isMobile) dialogPosition = { x: 16, y: 16 };
    setTimeout(() => promptInput?.focus(), 0);
  }

  function handleClose() {
    if (ctrl.isLoading) return;
    open = false;
    ctrl.reset();
    isMinimized = false;
  }

  function handleCancel() {
    ctrl.cancel();
  }

  function handleClickOutside(event: MouseEvent) {
    if (ctrl.isLoading || isDragging) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.ai-prompt-dialog')) {
      modeDropdownOpen = false;
      handleClose();
    } else if (modeDropdownOpen && !target.closest('.ai-mode-dropdown')) {
      modeDropdownOpen = false;
    }
  }

  // ── Submit / Keyboard ─────────────────────────────────────────────────────
  async function handleSubmit() {
    isPromptExpanded = false;
    handleMinimize();
    const success = await ctrl.submit();
    isMinimized = false;
    if (success) handleClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (ctrl.isLoading) {
        handleMinimize();
      } else {
        handleClose();
      }
    }
  }

  function handleDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'i' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!ctrl.isLoading) {
        const modes = availableModes;
        const currentIdx = modes.indexOf(ctrl.mode);
        const nextIdx = (currentIdx + 1) % modes.length;
        ctrl.setMode(modes[nextIdx]);
        modeDropdownOpen = false;
      }
    }
  }

  $effect(() => {
    if (open) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('keydown', handleDocumentKeydown);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleDocumentKeydown);
      };
    }
  });
</script>

{#if open}
  <!-- Minimized indicator -->
  {#if isMinimized && ctrl.isLoading && !($isSidebarOpen && $isMobile)}
    <button
      onclick={handleRestore}
      class="fixed top-4 right-4 z-50 flex max-w-72 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 shadow-lg transition-all hover:scale-105 {colorClasses.badge}"
      title="Click to restore AI prompt"
    >
      <div class="min-w-0 flex-1 text-left">
        <div class="text-xs font-medium text-white">
          {#if ctrl.isGeneratingConfig}
            Cooking {ctrl.resolvedObjectType}...
          {:else}
            {descriptor.label}...
          {/if}
        </div>

        {#if ctrl.thinkingText}
          <div
            class="mt-1 line-clamp-2 text-left font-mono text-[8px] leading-tight text-white/60 italic"
          >
            <MarkdownContent markdown={ctrl.thinkingText} />
          </div>
        {/if}
      </div>

      <Maximize2 class="mt-0.5 h-3 w-3 shrink-0 text-white/70" />
    </button>
  {/if}

  <div
    class="ai-prompt-dialog {$isMobile
      ? 'absolute'
      : 'fixed'} z-50 w-96 rounded-lg border {ctrl.isLoading
      ? colorClasses.border
      : 'border-zinc-600'} bg-zinc-900/95 shadow-2xl backdrop-blur-xl {ctrl.isLoading
      ? colorClasses.ring
      : ''} {isDragging ? 'cursor-grabbing' : ''} {isMinimized ? 'hidden' : ''}"
    style={$isMobile
      ? `left: ${dialogPosition.x}px; top: ${dialogPosition.y}px;`
      : `right: ${dialogPosition.x}px; top: ${dialogPosition.y}px;`}
  >
    <!-- Header -->
    <div
      class="flex items-center gap-2 border-b border-zinc-700 px-4 py-3 {isDragging
        ? 'cursor-grabbing'
        : 'cursor-grab'}"
      onmousedown={handleHeaderMouseDown}
      role="button"
      tabindex="-1"
    >
      <descriptor.icon class="h-5 w-5 text-{descriptor.color}-400" />

      <div class="flex-1">
        <div class="font-mono text-sm font-medium text-zinc-100">{descriptor.label}</div>
        <div class="text-xs text-zinc-400">{descriptor.description(ctrl.context)}</div>
      </div>

      <!-- Mode selector dropdown (when multiple modes are available) -->
      {#if availableModes.length > 1}
        <div class="ai-mode-dropdown relative">
          <button
            onclick={() => (modeDropdownOpen = !modeDropdownOpen)}
            disabled={ctrl.isLoading}
            class="flex cursor-pointer items-center gap-1 rounded bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {descriptor.shortLabel}
            <ChevronDown class="h-3 w-3 opacity-60" />
          </button>

          {#if modeDropdownOpen}
            <div
              class="absolute top-full right-0 z-20 mt-1 w-52 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
              onclick={(e) => e.stopPropagation()}
            >
              {#each availableModes as modeId (modeId)}
                {@const d = getModeDescriptor(modeId)}

                <button
                  onclick={() => {
                    ctrl.setMode(modeId);
                    modeDropdownOpen = false;
                  }}
                  class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-700 {ctrl.mode ===
                  modeId
                    ? 'font-medium text-white'
                    : 'text-zinc-400'}"
                >
                  <d.icon class="h-3 w-3 shrink-0" />
                  <span class="flex-1">{d.shortLabel}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Minimize -->
      <button
        onclick={handleMinimize}
        class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        title="Minimize (Esc)"
        aria-label="Minimize dialog"
      >
        <Minus class="h-4 w-4" />
      </button>
    </div>

    <!-- Input Area -->
    <div class="p-4">
      {#if ctrl.isLoading}
        <!-- Collapsible prompt during loading -->
        <button
          onclick={() => (isPromptExpanded = !isPromptExpanded)}
          class="flex w-full cursor-pointer items-center gap-2 rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          {#if isPromptExpanded}
            <ChevronUp class="h-3 w-3" />
          {:else}
            <ChevronDown class="h-3 w-3" />
          {/if}
          <span class="flex-1 truncate font-mono">User Prompt</span>
        </button>

        {#if isPromptExpanded}
          <div
            class="mt-2 rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 font-mono text-sm text-zinc-300"
          >
            {ctrl.promptText}
          </div>
        {/if}

        <!-- Thinking log -->
        {#if ctrl.thinkingLog.length > 0}
          <div
            class="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300"
          >
            {#each ctrl.thinkingLog as thought, index (index)}
              <div
                class="border-l-2 border-zinc-600 pl-2 {index === ctrl.thinkingLog.length - 1
                  ? 'opacity-100'
                  : 'opacity-40'}"
              >
                <MarkdownContent markdown={thought} />
              </div>
            {/each}
          </div>
        {:else}
          <div class="mt-3 flex items-center justify-center py-4 text-xs text-zinc-500">
            <Loader class="mr-2 h-3 w-3 animate-spin" />
            Waiting for thoughts...
          </div>
        {/if}
      {:else}
        <!-- Textarea -->
        <textarea
          bind:this={promptInput}
          bind:value={ctrl.promptText}
          onkeydown={handleKeydown}
          placeholder={descriptor.placeholder(ctrl.context)}
          class="nodrag w-full resize-y rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-500 outline-none {focusBorderClass}"
          rows="3"
        ></textarea>
      {/if}

      {#if ctrl.errorMessage}
        <div class="mt-2 rounded bg-red-900/20 px-3 py-2 font-mono text-xs text-red-300">
          {ctrl.errorMessage}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between border-t border-zinc-700 px-4 py-3">
      <div class="text-xs text-zinc-500">
        {#if ctrl.isLoading}
          <div class="flex items-center gap-2">
            <Loader class="h-3 w-3 animate-spin" />
            {#if ctrl.isGeneratingConfig}
              <span>Cooking <span class="text-zinc-300">{ctrl.resolvedObjectType}</span>...</span>
            {:else}
              <span>{descriptor.label}...</span>
            {/if}
          </div>
        {:else if availableModes.length > 1}
          Enter {submitLabel.toLowerCase()} • Ctrl+I mode • Esc cancel
        {:else}
          Enter {submitLabel.toLowerCase()} • Esc cancel
        {/if}
      </div>

      <div class="flex gap-2">
        {#if ctrl.isLoading}
          <button
            onclick={handleCancel}
            class="cursor-pointer rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
          >
            Cancel
          </button>
        {:else}
          <button
            onclick={handleSubmit}
            disabled={descriptor.promptOptional
              ? ctrl.isLoading
              : !ctrl.promptText.trim() || ctrl.isLoading}
            class="cursor-pointer rounded {colorClasses.button} px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
