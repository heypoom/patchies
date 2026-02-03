<script lang="ts">
  import { Code, Loader, Package, Pause, Play, Terminal, X } from '@lucide/svelte/icons';
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';
  import type { SupportedLanguage } from '$lib/codemirror/types';

  let contentContainer: HTMLDivElement | null = null;
  let consoleRef: VirtualConsole | null = $state(null);

  // Props from parent component
  let {
    id: nodeId,
    data,
    selected,
    // Execution handlers
    onExecute,
    onCleanup: onCleanupHandler,
    onCodeChange,
    // State from parent
    isRunning,
    isMessageCallbackActive,
    isTimerCallbackActive,
    // Library support (js only)
    supportsLibraries = false,
    // Custom label
    nodeLabel = 'js',
    // Language for code editor
    language = 'javascript',
    // Placeholder text for code editor
    editorPlaceholder = 'Write your code here...',
    // Node type for completions
    nodeType = 'js',
    // Video inlet count (optional, for worker nodes)
    videoInletCount = 0
  }: {
    id: string;
    data: {
      title?: string;
      code: string;
      showConsole?: boolean;
      runOnMount?: boolean;
      inletCount?: number;
      outletCount?: number;
      libraryName?: string | null;
      executeCode?: number;
      consoleHeight?: number;
      consoleWidth?: number;
    };
    selected: boolean;
    onExecute: () => Promise<void>;
    onCleanup: () => void;
    onCodeChange?: (code: string) => void;
    isRunning: boolean;
    isMessageCallbackActive: boolean;
    isTimerCallbackActive: boolean;
    supportsLibraries?: boolean;
    nodeLabel?: string;
    language?: SupportedLanguage;
    editorPlaceholder?: string;
    nodeType?: string;
    videoInletCount?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  let isLongRunningTaskActive = $derived(isMessageCallbackActive || isTimerCallbackActive);
  let inletCount = $derived(data.inletCount ?? 1);
  let outletCount = $derived(data.outletCount ?? 1);

  let showEditor = $state(false);
  let contentWidth = $state(100);
  let isFlashing = $state(false);

  const code = $derived(data.code || '');
  let previousExecuteCode = $state<number | undefined>(undefined);

  // Track error line numbers for code highlighting
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);
  const eventBus = PatchiesEventBus.getInstance();

  // Listen for console output events to capture lineErrors
  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    // If this error has lineErrors, update state for code highlighting
    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  // Watch for executeCode timestamp changes and re-run when it changes
  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      executeCode();
    }
  });

  const borderColor = $derived.by(() => {
    // Flash takes top priority
    if (isFlashing) return 'border-zinc-300';

    // Error state - show red border when there are errors
    if (lineErrors) {
      return selected ? 'border-red-500' : 'border-red-400';
    }

    // Prioritize showing emerald if there are active timers (stoppable state)
    if (isLongRunningTaskActive && selected) return 'border-emerald-300';
    if (isLongRunningTaskActive) return 'border-emerald-500';
    if (isRunning && selected) return 'border-pink-300';
    if (isRunning) return 'border-pink-500';
    if (selected) return 'border-zinc-400';

    return 'border-zinc-600';
  });

  const playOrStopIcon = $derived.by(() => {
    if (supportsLibraries && data.libraryName) return Package;

    // Prioritize showing Pause if there are active timers (so user can stop them)
    if (isLongRunningTaskActive) return Pause;
    if (isRunning) return Loader;

    return Play;
  });

  onMount(() => {
    // Listen for console output events to capture lineErrors
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    updateContentWidth();

    // Watch for any size changes to the content container
    const resizeObserver = new ResizeObserver(() => {
      updateContentWidth();
    });

    if (contentContainer) {
      resizeObserver.observe(contentContainer);
    }

    return () => {
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
  });

  async function executeCode() {
    // Clear previous console output and error highlighting
    consoleRef?.clearConsole();
    lineErrors = undefined;

    await onExecute();
  }

  function updateContentWidth() {
    if (!contentContainer) return;

    contentWidth = contentContainer.offsetWidth;
  }

  function toggleEditor() {
    showEditor = !showEditor;
  }

  function runOrStop() {
    if (isLongRunningTaskActive) {
      onCleanupHandler();
    } else {
      executeCode();
    }
  }

  export function flash() {
    isFlashing = true;
    setTimeout(() => {
      isFlashing = false;
    }, 150);
  }

  export function clearConsole() {
    consoleRef?.clearConsole();
    lineErrors = undefined;
  }

  function handleDoubleClickOnRun() {
    if (supportsLibraries && data.libraryName) {
      toggleEditor();
    }
  }

  let minContainerWidth = $derived.by(() => {
    const baseWidth = 70;
    let inletWidth = 15;
    const totalInlets = inletCount + videoInletCount;

    return baseWidth + Math.max(Math.max(totalInlets, 2), Math.max(outletCount, 2)) * inletWidth;
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2" bind:this={contentContainer}>
      <div
        class="group/header absolute -top-7 left-0 z-20 flex w-full items-center justify-between"
      >
        <div class="z-10 w-fit rounded-lg bg-zinc-900 px-2 py-1 text-nowrap whitespace-nowrap">
          <div class="font-mono text-xs font-medium text-zinc-400">
            {(supportsLibraries && data.libraryName) || data.title || nodeLabel}
          </div>
        </div>

        <div
          class="flex items-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover/header:opacity-100"
        >
          {#if !(supportsLibraries && data.libraryName)}
            <button
              class="rounded p-1 hover:bg-zinc-700"
              onclick={() => {
                updateNodeData(nodeId, { showConsole: !data.showConsole });
                setTimeout(() => updateContentWidth(), 10);
              }}
              title="Console"
            >
              <Terminal class="h-4 w-4 text-zinc-300" />
            </button>
          {/if}

          <button class="rounded p-1 hover:bg-zinc-700" onclick={toggleEditor} title="Edit code">
            <Code class="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      <div class="relative">
        <div>
          {#each Array.from({ length: videoInletCount }) as _, index (index)}
            <StandardHandle
              port="inlet"
              type="video"
              id={index}
              title={`Video Input ${index}`}
              total={videoInletCount + inletCount}
              {index}
              class="top-0"
              {nodeId}
            />
          {/each}

          {#each Array.from({ length: inletCount }) as _, index (index)}
            <StandardHandle
              port="inlet"
              id={index + videoInletCount}
              title={`Inlet ${index}`}
              total={videoInletCount + inletCount}
              index={index + videoInletCount}
              class="top-0"
              {nodeId}
            />
          {/each}
        </div>

        {#if data.showConsole && !(supportsLibraries && data.libraryName)}
          <VirtualConsole
            bind:this={consoleRef}
            {nodeId}
            {borderColor}
            {selected}
            onrun={executeCode}
            {isRunning}
            {isLongRunningTaskActive}
            {playOrStopIcon}
            {runOrStop}
            onResize={updateContentWidth}
            initialHeight={data.consoleHeight}
            initialWidth={data.consoleWidth}
            onHeightChange={(height) => updateNodeData(nodeId, { consoleHeight: height })}
            onWidthChange={(width) => updateNodeData(nodeId, { consoleWidth: width })}
          />
        {:else}
          <button
            class={[
              'flex w-full justify-center rounded-md border py-3 text-zinc-300 hover:bg-zinc-700',
              isRunning && !isLongRunningTaskActive ? 'cursor-not-allowed' : 'cursor-pointer',
              borderColor,
              isFlashing
                ? 'bg-zinc-500'
                : selected
                  ? 'shadow-glow-md bg-zinc-800'
                  : 'hover:shadow-glow-sm bg-zinc-900'
            ]}
            style={`min-width: ${minContainerWidth}px`}
            onclick={runOrStop}
            ondblclick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              handleDoubleClickOnRun();
            }}
            aria-disabled={isRunning && !isLongRunningTaskActive}
            aria-label={isLongRunningTaskActive ? 'Stop' : 'Run code'}
          >
            <div class={[isRunning && !isLongRunningTaskActive ? 'animate-spin opacity-30' : '']}>
              <svelte:component this={playOrStopIcon} size="16px" />
            </div>
          </button>

          <div
            class={[
              'pointer-events-none absolute mt-1 ml-1 w-fit min-w-[200px] font-mono text-[8px] text-zinc-300 opacity-0',
              selected ? '' : 'group-hover:opacity-100'
            ]}
          >
            {#if supportsLibraries && data.libraryName}
              {#if !showEditor}
                <div>double click to edit shared code</div>
              {/if}
            {:else}
              <div>click to run</div>
            {/if}
          </div>
        {/if}

        <div>
          {#each Array.from({ length: outletCount }) as _, index (index)}
            <StandardHandle
              port="outlet"
              id={index}
              title={`Outlet ${index}`}
              total={outletCount}
              {index}
              class="bottom-0"
              {nodeId}
            />
          {/each}
        </div>
      </div>
    </div>
  </div>

  {#if showEditor}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
        <CodeEditor
          value={code}
          onchange={(newCode) => {
            if (onCodeChange) {
              onCodeChange(newCode);
            }
            updateNodeData(nodeId, { code: newCode });
          }}
          {language}
          {nodeType}
          placeholder={editorPlaceholder}
          class="nodrag h-64 w-full resize-none"
          onrun={executeCode}
          {lineErrors}
        />
      </div>
    </div>
  {/if}
</div>
