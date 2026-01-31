<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { PyodideSystem } from '$lib/python/PyodideSystem';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { PyodideConsoleOutputEvent, PyodideSendMessageEvent } from '$lib/eventbus/events';
  import { logger } from '$lib/utils/logger';
  import CodeBlockBase from './CodeBlockBase.svelte';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      code: string;
      showConsole?: boolean;
      consoleHeight?: number;
      consoleWidth?: number;
    };
    selected: boolean;
  } = $props();

  let messageContext: MessageContext;
  let pyodideSystem = PyodideSystem.getInstance();
  let eventBus = PatchiesEventBus.getInstance();
  let isInitialized = $state(false);
  let isRunning = $state(false);

  // Reference to base component for flash
  let baseRef: CodeBlockBase | null = $state(null);

  const nodeLogger = logger.ofNode(nodeId);

  const code = $derived(data.code || '');

  function handlePyodideConsoleOutput(event: PyodideConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    const hasNoReturnValue = event.finished && event.message === null;

    if (!hasNoReturnValue && event.message) {
      if (event.output === 'stderr') {
        nodeLogger.error(event.message);
      } else {
        nodeLogger.log(event.message);
      }
    }

    // Mark that the run has completed.
    if (event.finished) {
      isRunning = false;
    }
  }

  function handlePyodideSendMessage(event: PyodideSendMessageEvent) {
    if (event.nodeId !== nodeId) return;

    messageContext.send(event.data, event.options);
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);

    // Listen for pyodide console output events
    eventBus.addEventListener('pyodideConsoleOutput', handlePyodideConsoleOutput);
    eventBus.addEventListener('pyodideSendMessage', handlePyodideSendMessage);

    // Initialize pyodide instance
    try {
      pyodideSystem.create(nodeId).then(() => {
        isInitialized = true;
      });
    } catch (error) {
      nodeLogger.error(
        `Failed to setup Python: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  onDestroy(async () => {
    eventBus.removeEventListener('pyodideConsoleOutput', handlePyodideConsoleOutput);
    eventBus.removeEventListener('pyodideSendMessage', handlePyodideSendMessage);

    if (isInitialized) {
      await pyodideSystem.delete(nodeId);
    }
    messageContext?.destroy();
  });

  async function executeCode() {
    if (!isInitialized || isRunning) return;

    isRunning = true;

    // Clear previous console output
    baseRef?.clearConsole();

    try {
      await pyodideSystem.executeCode(nodeId, code);
    } catch (error) {
      nodeLogger.error(error instanceof Error ? error.message : String(error));

      isRunning = false;
    }
  }

  function cleanupRunningTasks() {
    // Python doesn't have long-running callbacks like JS
    // This is a no-op but required by CodeBlockBase interface
  }
</script>

<CodeBlockBase
  bind:this={baseRef}
  id={nodeId}
  {data}
  {selected}
  onExecute={executeCode}
  onCleanup={cleanupRunningTasks}
  {isRunning}
  isMessageCallbackActive={false}
  isTimerCallbackActive={false}
  supportsLibraries={false}
  nodeLabel="python"
  language="python"
  editorPlaceholder="Write your Python code here..."
  nodeType="python"
/>
