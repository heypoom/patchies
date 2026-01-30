<script lang="ts">
  import { Code, Loader, Package, Pause, Play, Terminal, X } from '@lucide/svelte/icons';
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { JSRunner } from '$lib/js-runner/JSRunner';
  import { match, P } from 'ts-pattern';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { handleCodeError } from '$lib/js-runner/handleCodeError';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';

  let contentContainer: HTMLDivElement | null = null;
  let consoleRef: VirtualConsole | null = $state(null);

  // Get node data from XY Flow - nodes receive their data as props
  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title?: string;
      code: string;
      showConsole?: boolean;
      runOnMount?: boolean;
      inletCount?: number;
      outletCount?: number;
      libraryName?: boolean;
      executeCode?: number;
      consoleHeight?: number;
      consoleWidth?: number;
    };
    selected: boolean;
  } = $props();

  // Get flow utilities to update node data
  const { updateNodeData } = useSvelteFlow();

  const updateNodeInternals = useUpdateNodeInternals();

  const jsRunner = JSRunner.getInstance();
  let isRunning = $state(false);
  let isMessageCallbackActive = $state(false);
  let isTimerCallbackActive = $state(false);
  let isLongRunningTaskActive = $derived(isMessageCallbackActive || isTimerCallbackActive);
  let inletCount = $derived(data.inletCount ?? 1);
  let outletCount = $derived(data.outletCount ?? 1);

  let showEditor = $state(false);
  let contentWidth = $state(100);
  let isFlashing = $state(false);

  const code = $derived(data.code || '');
  let previousExecuteCode = $state<number | undefined>(undefined);

  // Create custom console for routing output to VirtualConsole
  const customConsole = createCustomConsole(nodeId);

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

    // Prioritize showing emerald if there are active timers (stoppable state)
    if (isLongRunningTaskActive && selected) return 'border-emerald-300';
    if (isLongRunningTaskActive) return 'border-emerald-500';
    if (isRunning && selected) return 'border-pink-300';
    if (isRunning) return 'border-pink-500';
    if (selected) return 'border-zinc-400';

    return 'border-zinc-600';
  });

  const playOrStopIcon = $derived.by(() => {
    if (data.libraryName) return Package;

    // Prioritize showing Pause if there are active timers (so user can stop them)
    if (isLongRunningTaskActive) return Pause;
    if (isRunning) return Loader;

    return Play;
  });

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with({ type: 'set', code: P.string }, ({ code }) => {
          updateNodeData(nodeId, { code });
        })
        .with({ type: 'run' }, () => {
          executeCode();
        })
        .with({ type: 'stop' }, () => {
          cleanupRunningTasks();
        });
    } catch (error) {
      customConsole.error(error instanceof Error ? error.message : String(error));
    }
  };

  onMount(() => {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.onMessageCallbackRegistered = () => {
      isMessageCallbackActive = true;
    };
    messageContext.onIntervalCallbackRegistered = () => {
      isTimerCallbackActive = true;
    };
    messageContext.onTimeoutCallbackRegistered = () => {
      isTimerCallbackActive = true;
    };
    messageContext.onAnimationFrameCallbackRegistered = () => {
      isTimerCallbackActive = true;
    };
    messageContext.queue.addCallback(handleMessage);

    // Listen for console output events to capture lineErrors
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    // libraries should be run on mount to register themselves
    if (data.runOnMount || data.libraryName) {
      executeCode();
    }

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
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.queue.removeCallback(handleMessage);

    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);

    jsRunner.destroy(nodeId);
  });

  function clearTimers() {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.clearTimers();
    isTimerCallbackActive = false;
  }

  function clearMessageHandler() {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.messageCallback = null;
    isMessageCallbackActive = false;
  }

  function cleanupRunningTasks() {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.runCleanupCallbacks();
    clearTimers();
    clearMessageHandler();
  }

  async function executeCode() {
    isRunning = true;
    isMessageCallbackActive = false;
    isTimerCallbackActive = false;

    // Clear previous console output and error highlighting
    consoleRef?.clearConsole();
    lineErrors = undefined;

    const setPortCount = (inletCount = 1, outletCount = 1) => {
      updateNodeData(nodeId, { inletCount, outletCount });
      updateNodeInternals(nodeId);
    };

    const setRunOnMount = (runOnMount = true) => updateNodeData(nodeId, { runOnMount });

    try {
      const processedCode = await jsRunner.preprocessCode(code, {
        nodeId,
        setLibraryName: (libraryName: string | null) => {
          updateNodeData(nodeId, { libraryName, inletCount: 0, outletCount: 0 });

          setTimeout(() => {
            updateContentWidth();
          }, 10);
        }
      });

      // library code - do not execute
      if (processedCode === null) return;

      await jsRunner.executeJavaScript(nodeId, processedCode, {
        customConsole,
        setPortCount,
        setRunOnMount,
        setTitle,
        extraContext: { flash }
      });
    } catch (error) {
      handleCodeError(error, code, nodeId, customConsole);
    } finally {
      isRunning = false;
    }
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
      cleanupRunningTasks();
    } else {
      executeCode();
    }
  }

  function setTitle(title: string) {
    updateNodeData(nodeId, { title });
  }

  function flash() {
    isFlashing = true;
    setTimeout(() => {
      isFlashing = false;
    }, 150);
  }

  function handleDoubleClickOnRun() {
    if (data.libraryName) {
      toggleEditor();
    }
  }

  let minContainerWidth = $derived.by(() => {
    const baseWidth = 70;
    let inletWidth = 15;

    return baseWidth + Math.max(Math.max(inletCount, 2), Math.max(outletCount, 2)) * inletWidth;
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
            {data.libraryName ?? data.title ?? 'js'}
          </div>
        </div>

        <div
          class="flex items-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover/header:opacity-100"
        >
          {#if !data.libraryName}
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
          {#each Array.from({ length: inletCount }) as _, index (index)}
            <StandardHandle
              port="inlet"
              id={index}
              title={`Inlet ${index}`}
              total={inletCount}
              {index}
              class="top-0"
              {nodeId}
            />
          {/each}
        </div>

        {#if data.showConsole && !data.libraryName}
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
            {#if data.libraryName}
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
            if (data.libraryName) {
              jsRunner.setLibraryCode(nodeId, newCode);
            }

            updateNodeData(nodeId, { code: newCode });
          }}
          language="javascript"
          nodeType="js"
          placeholder="Write your JavaScript code here..."
          class="nodrag h-64 w-full resize-none"
          onrun={executeCode}
          {lineErrors}
        />
      </div>
    </div>
  {/if}
</div>
