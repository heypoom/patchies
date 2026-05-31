<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { PyodideSystem } from '$lib/python/PyodideSystem';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { PyodideConsoleOutputEvent, PyodideSendMessageEvent } from '$lib/eventbus/events';
  import { getNextPeppermintInput } from '$lib/peppermint/input';
  import { PeppermintRunQueue } from '$lib/peppermint/run-queue';
  import { logger } from '$lib/utils/logger';
  import CodeBlockBase from './CodeBlockBase.svelte';

  type PeppermintInput = {
    value: unknown;
  };

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
  let latestInput: PeppermintInput = { value: null };
  let initializePromise: Promise<void> | null = null;
  let activeRunResolve: (() => void) | null = null;
  let activeRunReject: ((error: Error) => void) | null = null;

  let baseRef: CodeBlockBase | null = $state(null);

  const nodeLogger = logger.ofNode(nodeId);
  const code = $derived(data.code || '');

  const runQueue = new PeppermintRunQueue<PeppermintInput>(runPeppermint);

  const handleMessage: MessageCallbackFn = (message) => {
    latestInput = { value: getNextPeppermintInput(latestInput.value, message) };
    void runQueue.requestRun(latestInput);
  };

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

    if (event.finished) {
      const resolve = activeRunResolve;
      const reject = activeRunReject;

      activeRunResolve = null;
      activeRunReject = null;

      if (event.output === 'stderr') {
        reject?.(new Error(event.message ?? 'Peppermint execution failed'));
      } else {
        resolve?.();
      }
    }
  }

  function handlePyodideSendMessage(event: PyodideSendMessageEvent) {
    if (event.nodeId !== nodeId) return;

    messageContext.send(event.data, event.options);
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    eventBus.addEventListener('pyodideConsoleOutput', handlePyodideConsoleOutput);
    eventBus.addEventListener('pyodideSendMessage', handlePyodideSendMessage);

    initializePromise = pyodideSystem
      .create(nodeId)
      .then(() => {
        isInitialized = true;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        nodeLogger.error(`Failed to setup Peppermint: ${message}`);
        throw error;
      });
  });

  onDestroy(async () => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();

    eventBus.removeEventListener('pyodideConsoleOutput', handlePyodideConsoleOutput);
    eventBus.removeEventListener('pyodideSendMessage', handlePyodideSendMessage);

    if (isInitialized) {
      await pyodideSystem.delete(nodeId);
    }
  });

  async function runPeppermint(input: PeppermintInput) {
    isRunning = true;
    baseRef?.clearConsole();

    try {
      await initializePromise;
      if (!isInitialized) return;

      await new Promise<void>((resolve, reject) => {
        activeRunResolve = resolve;
        activeRunReject = reject;
        void pyodideSystem.executePeppermintCode(nodeId, code, input.value).catch(reject);
      });
    } catch (error) {
      nodeLogger.error(error instanceof Error ? error.message : String(error));
    } finally {
      isRunning = false;
    }
  }

  async function executeCode() {
    await runQueue.requestRun(latestInput);
  }

  function cleanupRunningTasks() {
    activeRunResolve?.();
    activeRunResolve = null;
    activeRunReject = null;
    isRunning = false;
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
  nodeLabel="peppermint"
  language="peppermint"
  editorPlaceholder="Write Peppermint code here..."
  nodeType="peppermint"
/>
