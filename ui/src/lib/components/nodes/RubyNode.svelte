<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas/common';
  import { RubyNodeSystem } from '$lib/ruby/RubyNodeSystem';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import { MessageSystem, type MessageCallbackFn } from '$lib/messages/MessageSystem';
  import type { WorkerCallbackRegisteredEvent, WorkerFlashEvent } from '$lib/eventbus/events';
  import CodeBlockBase from './CodeBlockBase.svelte';

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
      executeCode?: number;
      consoleHeight?: number;
      consoleWidth?: number;
    };
    selected: boolean;
  } = $props();

  // Get flow utilities to update node data
  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const rubySystem = RubyNodeSystem.getInstance();
  const eventBus = PatchiesEventBus.getInstance();
  const messageSystem = MessageSystem.getInstance();

  let isRunning = $state(false);
  let isMessageCallbackActive = $state(false);

  const code = $derived(data.code || '');

  // Reference to base component for flash
  let baseRef: CodeBlockBase | null = $state(null);

  // Handle incoming messages to this node
  const handleMessage: MessageCallbackFn = (message) => {
    match(message)
      .with(messages.setCode, ({ value }) => {
        updateNodeData(nodeId, { code: value });
      })
      .with(messages.run, () => {
        executeCode();
      })
      .with(messages.stop, () => {
        cleanupRunningTasks();
      })
      .otherwise(() => {});
  };

  // Handle port count updates from worker
  function handlePortCountUpdate(event: {
    nodeId: string;
    inletCount: number;
    outletCount: number;
  }) {
    if (event.nodeId !== nodeId) return;
    updateNodeData(nodeId, { inletCount: event.inletCount, outletCount: event.outletCount });
    updateNodeInternals(nodeId);
  }

  // Handle title updates from worker
  function handleTitleUpdate(event: { nodeId: string; title: string }) {
    if (event.nodeId !== nodeId) return;
    updateNodeData(nodeId, { title: event.title });
  }

  // Handle callback registration events from worker
  function handleCallbackRegistered(event: WorkerCallbackRegisteredEvent) {
    if (event.nodeId !== nodeId) return;

    if (event.callbackType === 'message') {
      isMessageCallbackActive = true;
    }
  }

  // Handle flash events from worker
  function handleFlash(event: WorkerFlashEvent) {
    if (event.nodeId !== nodeId) return;
    baseRef?.flash();
  }

  onMount(async () => {
    // Create the Ruby worker for this node
    await rubySystem.create(nodeId);

    // Register message handler for set/run/stop commands
    const queue = messageSystem.registerNode(nodeId);
    queue.addCallback(handleMessage);

    // Listen for EventBus events from the worker
    eventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);
    eventBus.addEventListener('nodeTitleUpdate', handleTitleUpdate);
    eventBus.addEventListener('workerCallbackRegistered', handleCallbackRegistered);
    eventBus.addEventListener('workerFlash', handleFlash);

    // Run on mount if configured
    if (data.runOnMount) {
      executeCode();
    }
  });

  onDestroy(() => {
    // Remove message handler
    const queue = messageSystem.registerNode(nodeId);
    queue.removeCallback(handleMessage);

    // Remove event listeners
    eventBus.removeEventListener('nodePortCountUpdate', handlePortCountUpdate);
    eventBus.removeEventListener('nodeTitleUpdate', handleTitleUpdate);
    eventBus.removeEventListener('workerCallbackRegistered', handleCallbackRegistered);
    eventBus.removeEventListener('workerFlash', handleFlash);

    // Destroy the worker
    rubySystem.destroy(nodeId);
  });

  function cleanupRunningTasks() {
    rubySystem.cleanup(nodeId);
    isMessageCallbackActive = false;
  }

  async function executeCode() {
    isRunning = true;
    isMessageCallbackActive = false;

    // Clear console in the base component
    baseRef?.clearConsole();

    try {
      await rubySystem.executeCode(nodeId, code);
    } finally {
      isRunning = false;
    }
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
  {isMessageCallbackActive}
  isTimerCallbackActive={false}
  supportsLibraries={false}
  nodeLabel="ruby"
  language="ruby"
  editorPlaceholder="Write your Ruby code here..."
  nodeType="ruby"
/>
