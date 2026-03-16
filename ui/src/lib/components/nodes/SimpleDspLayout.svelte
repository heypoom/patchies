<script lang="ts">
  import { Code, Play, Settings, Terminal, X } from '@lucide/svelte/icons';
  import { useUpdateNodeInternals } from '@xyflow/svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { onMount, onDestroy, type Snippet } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import type { SettingsSchema } from '$lib/settings';

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

  // Update content width when title changes
  $effect(() => {
    displayTitle;
    setTimeout(updateContentWidth, 0);
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

  function toggleEditor() {
    showEditor = !showEditor;
    if (showEditor) showSettings = false;
  }

  function toggleSettings() {
    showSettings = !showSettings;
    if (showSettings) showEditor = false;
  }

  let minContainerWidth = $derived.by(() => {
    const baseWidth = 20;
    let inletWidth = 20;
    return baseWidth + (1 + messageInletCount) * inletWidth;
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2" bind:this={contentContainer}>
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>

        <div class="flex items-center">
          {@render actionButtons?.()}

          {#if settingsSchema && settingsSchema.length > 0}
            <button
              class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSettings();
              }}
              title="Settings"
            >
              <Settings class="h-4 w-4 text-zinc-300" />
            </button>
          {/if}

          <button
            class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleEditor();
            }}
            title="Edit code"
          >
            <Code class="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      <div class="relative">
        <!-- Total inlets = 1 audio inlet + message inlets -->
        <div>
          <!-- Audio input (always present) -->
          <TypedHandle
            port="inlet"
            spec={{ handleType: 'audio' }}
            title="Audio Input"
            total={1 + messageInletCount}
            index={0}
            class="top-0"
            {nodeId}
          />

          <!-- Message inlets (only show if messageInletCount > 0) -->
          {#if messageInletCount > 0}
            {#each Array.from({ length: messageInletCount }) as _, index (index)}
              <TypedHandle
                port="inlet"
                spec={{ handleType: 'message', handleId: index }}
                title={`Message Inlet ${index + 1}`}
                total={1 + messageInletCount}
                index={1 + index}
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
            toggleEditor();
          }}
          title="Double click to edit code"
        >
          <div class="flex items-center justify-center">
            <div class="font-mono text-xs text-zinc-300">{displayTitle}</div>
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

  {#if showEditor}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button onclick={onRun} class="rounded p-1 hover:bg-zinc-700">
              <Play class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>
            <p>Run Code (shift+enter)</p>
          </Tooltip.Content>
        </Tooltip.Root>

        {#if consoleSnippet}
          <button
            title="Toggle console"
            class="rounded p-1 hover:bg-zinc-700"
            onclick={onToggleConsole}
          >
            <Terminal class="h-4 w-4 text-zinc-300" />
          </button>
        {/if}

        <button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
        <CodeEditor
          value={code}
          onchange={handleCodeChangeInternal}
          language="javascript"
          {nodeType}
          class="nodrag h-64 w-full resize-none"
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
