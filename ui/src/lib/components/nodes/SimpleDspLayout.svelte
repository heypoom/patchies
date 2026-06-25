<script lang="ts">
  import { Code, Expand, Play, Settings, Terminal, X } from '@lucide/svelte/icons';
  import { useUpdateNodeInternals } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { onMount, onDestroy, type Snippet } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import type { SettingsSchema } from '$lib/settings';
  import {
    activeCodeEditorTarget,
    closeCodeEditorOverlay,
    openCodeEditorOverlay,
    openCodeEditorSidebar,
    syncActiveCodeEditorTargetLineErrors,
    syncActiveCodeEditorTargetSettings
  } from '../../../stores/code-editor-layout.store';
  import { defaultEditorLayout } from '../../../stores/editor-layout-settings.store';
  import { openEditorLayout } from '$lib/code-editor/open-editor-layout';
  import { editorFontFamily } from '../../../stores/editor.store';

  let {
    nodeId,
    nodeName,
    nodeType,
    data,
    selected,
    onCodeChange,
    onRun,
    handleMessage,
    actionButtons,
    console: consoleSnippet,
    showConsole = false,
    onToggleConsole,
    lineErrors,
    settingsSchema = undefined,
    settingsValues = {},
    onSettingsValueChange = undefined,
    onSettingsRevertAll = undefined
  }: {
    nodeId: string;
    nodeName: string;
    nodeType?: string;
    data: {
      code: string;
      messageInletCount?: number;
      messageOutletCount?: number;
      showAudioInput?: boolean;
      title?: string;
    };
    selected: boolean;
    onCodeChange: (code: string) => void;
    onRun: () => void;
    handleMessage: MessageCallbackFn;
    actionButtons?: Snippet;
    console?: Snippet;
    showConsole?: boolean;
    onToggleConsole?: () => void;
    lineErrors?: Record<number, string[]>;
    settingsSchema?: SettingsSchema;
    settingsValues?: Record<string, unknown>;
    onSettingsValueChange?: (key: string, value: unknown) => void;
    onSettingsRevertAll?: () => void;
  } = $props();

  let contentContainer: HTMLDivElement | null = null;
  let showEditor = $state(false);
  let showSettings = $state(false);
  let contentWidth = $state(10);
  let messageContext: MessageContext;

  const updateNodeInternals = useUpdateNodeInternals();

  const code = $derived(data.code || '');
  const messageInletCount = $derived(data.messageInletCount || 0);
  const messageOutletCount = $derived(data.messageOutletCount || 0);
  const displayTitle = $derived(data.title || nodeName);
  const showAudioInput = $derived(data.showAudioInput ?? false);
  const visibleInletCount = $derived((showAudioInput ? 1 : 0) + messageInletCount);

  const isCodeEditorDetached = $derived(
    $activeCodeEditorTarget?.nodeId === nodeId && $activeCodeEditorTarget.dataKey === 'code'
  );

  const detachedSettings = $derived(
    settingsSchema && settingsSchema.length > 0
      ? {
          schema: settingsSchema,
          values: settingsValues,
          onValueChange: (key: string, value: unknown) => onSettingsValueChange?.(key, value),
          onRevertAll: () => onSettingsRevertAll?.()
        }
      : undefined
  );

  // Update content width when title changes
  $effect(() => {
    displayTitle;
    setTimeout(updateContentWidth, 0);
  });

  $effect(() => {
    syncActiveCodeEditorTargetSettings({
      nodeId,
      dataKey: 'code',
      settings: detachedSettings
    });
  });

  $effect(() => {
    syncActiveCodeEditorTargetLineErrors({
      nodeId,
      dataKey: 'code',
      lineErrors
    });
  });

  const containerClass = $derived.by(() => {
    const hasError = lineErrors !== undefined;
    if (hasError) return 'object-container-error';

    if (selected) return 'object-container-selected';

    return 'object-container';
  });

  function handleCodeChangeInternal(newCode: string) {
    onCodeChange(newCode);

    setTimeout(() => {
      updateNodeInternals(nodeId);
      updateContentWidth();
    }, 10);
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    updateContentWidth();
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });

  function updateContentWidth() {
    if (!contentContainer) return;
    contentWidth = contentContainer.offsetWidth;
  }

  function toggleInlineEditor() {
    showEditor = !showEditor;
    if (showEditor) showSettings = false;
  }

  function openInlineEditor() {
    if (isCodeEditorDetached) {
      closeCodeEditorOverlay();
    }

    showEditor = true;
    showSettings = false;
  }

  function openExpandedCodeEditor() {
    openCodeEditorOverlay({
      nodeId,
      dataKey: 'code',
      language: 'javascript',
      nodeType,
      title: displayTitle,
      onrun: onRun,
      lineErrors,
      settings: detachedSettings
    });

    showEditor = false;
    showSettings = false;
  }

  function openSidebarCodeEditor() {
    openCodeEditorSidebar({
      nodeId,
      dataKey: 'code',
      language: 'javascript',
      nodeType,
      title: displayTitle,
      onrun: onRun,
      lineErrors,
      settings: detachedSettings
    });

    showEditor = false;
    showSettings = false;
  }

  function handleCodeOpen(event?: MouseEvent) {
    openEditorLayout({
      defaultLayout: $defaultEditorLayout,
      useAlternateLayout: event?.shiftKey ?? false,
      openInline: openInlineEditor,
      toggleInline: toggleInlineEditor,
      openOverlay: openExpandedCodeEditor,
      openSidebar: openSidebarCodeEditor
    });
  }

  function toggleSettings() {
    showSettings = !showSettings;
    if (showSettings) showEditor = false;
  }

  let minContainerWidth = $derived.by(() => {
    const baseWidth = 20;
    let inletWidth = 20;
    return baseWidth + visibleInletCount * inletWidth;
  });
</script>

<div class="relative flex gap-x-3" style:--patchies-simple-dsp-font-family={$editorFontFamily}>
  <div class="group relative">
    <div class="flex flex-col gap-2" bind:this={contentContainer}>
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>

        <div class="flex items-center">
          {@render actionButtons?.()}

          {#if settingsSchema && settingsSchema.length > 0}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  class="node-floating-button"
                  onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    toggleSettings();
                  }}
                  aria-label="Settings"
                >
                  <Settings class="h-4 w-4 text-zinc-300" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>{showSettings ? 'Hide Settings' : 'Settings'}</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="node-floating-button"
                onclick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCodeOpen(e);
                }}
                aria-label="Edit code"
              >
                <Code class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Edit Code</Tooltip.Content>
          </Tooltip.Root>
        </div>
      </div>

      <div class="relative">
        <!-- Total inlets = optional audio inlet + message inlets -->
        <div>
          {#if showAudioInput}
            <TypedHandle
              port="inlet"
              spec={{ handleType: 'audio' }}
              title="Audio Input"
              total={visibleInletCount}
              index={0}
              class="top-0"
              {nodeId}
            />
          {/if}

          <!-- Message inlets (only show if messageInletCount > 0) -->
          {#if messageInletCount > 0}
            {#each Array.from({ length: messageInletCount }) as _, index (index)}
              <TypedHandle
                port="inlet"
                spec={{ handleType: 'message', handleId: index }}
                title={`Message Inlet ${index + 1}`}
                total={visibleInletCount}
                index={(showAudioInput ? 1 : 0) + index}
                class="top-0"
                {nodeId}
              />
            {/each}
          {/if}
        </div>

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          style={`min-width: ${minContainerWidth}px`}
          ondblclick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            openInlineEditor();
          }}
          title="Double click to edit code"
        >
          <div class="flex items-center justify-center">
            <div class="simple-dsp-label text-xs text-zinc-300">{displayTitle}</div>
          </div>
        </button>

        <div>
          <!-- Audio output (always present) -->
          <TypedHandle
            port="outlet"
            spec={{ handleType: 'audio' }}
            title="Audio Output"
            total={1 + messageOutletCount}
            index={0}
            class="bottom-0"
            {nodeId}
          />

          <!-- Message outlets (only show if messageOutletCount > 0) -->
          {#if messageOutletCount > 0}
            {#each Array.from({ length: messageOutletCount }) as _, index (index)}
              <TypedHandle
                port="outlet"
                spec={{ handleType: 'message', handleId: index }}
                title={`Message Outlet ${index + 1}`}
                total={1 + messageOutletCount}
                index={1 + index}
                class="bottom-0"
                {nodeId}
              />
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>

  {#if showEditor && !isCodeEditorDetached}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={onRun}
              class="cursor-pointer rounded p-1 hover:bg-zinc-700"
              aria-label="Run code"
            >
              <Play class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>
            <p>Run Code (shift+enter)</p>
          </Tooltip.Content>
        </Tooltip.Root>

        {#if consoleSnippet}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class="cursor-pointer rounded p-1 hover:bg-zinc-700"
                onclick={onToggleConsole}
                aria-label="Toggle console"
              >
                <Terminal class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>

            <Tooltip.Content>Toggle Console</Tooltip.Content>
          </Tooltip.Root>
        {/if}

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={openExpandedCodeEditor}
              class="cursor-pointer rounded p-1 hover:bg-zinc-700"
              aria-label="Open expanded editor"
            >
              <Expand class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content>Open Expanded Editor</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={() => (showEditor = false)}
              class="cursor-pointer rounded p-1 hover:bg-zinc-700"
              aria-label="Close editor"
            >
              <X class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Close Editor</Tooltip.Content>
        </Tooltip.Root>
      </div>

      <div class="min-w-72 rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
        <CodeEditor
          value={code}
          onchange={handleCodeChangeInternal}
          language="javascript"
          {nodeType}
          class="nodrag h-64 w-full min-w-72 resize-none"
          onrun={onRun}
          {lineErrors}
          {nodeId}
        />
      </div>

      {#if consoleSnippet}
        <div class="mt-3 w-full" class:hidden={!showConsole}>
          {@render consoleSnippet()}
        </div>
      {/if}
    </div>
  {/if}

  {#if showSettings && settingsSchema && settingsSchema.length > 0}
    <div class="absolute top-0" style="left: {contentWidth + 10}px">
      <ObjectSettings
        {nodeId}
        schema={settingsSchema}
        values={settingsValues}
        onValueChange={(key, value) => onSettingsValueChange?.(key, value)}
        onRevertAll={() => onSettingsRevertAll?.()}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}
</div>

<style>
  .simple-dsp-label {
    font-family: var(--patchies-simple-dsp-font-family, var(--font-mono));
  }
</style>
