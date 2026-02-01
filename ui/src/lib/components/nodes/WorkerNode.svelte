<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { WorkerNodeSystem } from '$lib/js-runner/WorkerNodeSystem';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type {
    WorkerCallbackRegisteredEvent,
    WorkerFlashEvent,
    NodeRunOnMountUpdateEvent,
    NodePortCountUpdateEvent
  } from '$lib/eventbus/events';
  import { match } from 'ts-pattern';
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
      videoInletCount?: number;
      executeCode?: number;
      consoleHeight?: number;
      consoleWidth?: number;
    };
    selected: boolean;
  } = $props();

  // Get flow utilities to update node data
  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const workerSystem = WorkerNodeSystem.getInstance();
  const eventBus = PatchiesEventBus.getInstance();

  let isRunning = $state(false);
  let isMessageCallbackActive = $state(false);
  let isTimerCallbackActive = $state(false);

  const code = $derived(data.code || '');

  // Reference to base component for flash
  let baseRef: CodeBlockBase | null = $state(null);

  // Handle port count updates from worker
  function handlePortCountUpdate(event: NodePortCountUpdateEvent) {
    if (event.nodeId !== nodeId) return;

    match(event)
      .with({ portType: 'message' }, (m) => {
        updateNodeData(nodeId, {
          inletCount: m.inletCount,
          outletCount: m.outletCount
        });
      })
      .with({ portType: 'video' }, (m) => {
        updateNodeData(nodeId, {
          videoInletCount: m.inletCount
          // Note: worker nodes don't support video outlets (only inputs for processing)
        });
      })
      .exhaustive();

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
    } else if (event.callbackType === 'interval' || event.callbackType === 'timeout') {
      isTimerCallbackActive = true;
    }
  }

  // Handle flash events from worker
  function handleFlash(event: WorkerFlashEvent) {
    if (event.nodeId !== nodeId) return;
    baseRef?.flash();
  }

  // Handle runOnMount updates from worker
  function handleRunOnMountUpdate(event: NodeRunOnMountUpdateEvent) {
    if (event.nodeId !== nodeId) return;
    updateNodeData(nodeId, { runOnMount: event.runOnMount });
  }

  onMount(async () => {
    // Create the worker for this node
    await workerSystem.create(nodeId);

    // Listen for EventBus events from the worker
    eventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);
    eventBus.addEventListener('nodeTitleUpdate', handleTitleUpdate);
    eventBus.addEventListener('nodeRunOnMountUpdate', handleRunOnMountUpdate);
    eventBus.addEventListener('workerCallbackRegistered', handleCallbackRegistered);
    eventBus.addEventListener('workerFlash', handleFlash);

    // Run on mount if configured
    if (data.runOnMount) {
      executeCode();
    }
  });

  onDestroy(() => {
    // Remove event listeners
    eventBus.removeEventListener('nodePortCountUpdate', handlePortCountUpdate);
    eventBus.removeEventListener('nodeTitleUpdate', handleTitleUpdate);
    eventBus.removeEventListener('nodeRunOnMountUpdate', handleRunOnMountUpdate);
    eventBus.removeEventListener('workerCallbackRegistered', handleCallbackRegistered);
    eventBus.removeEventListener('workerFlash', handleFlash);

    // Destroy the worker
    workerSystem.destroy(nodeId);
  });

  function cleanupRunningTasks() {
    workerSystem.cleanup(nodeId);
    isMessageCallbackActive = false;
    isTimerCallbackActive = false;
  }

  async function executeCode() {
    isRunning = true;
    isMessageCallbackActive = false;
    isTimerCallbackActive = false;

    // Clear console in the base component
    baseRef?.clearConsole();

    try {
      await workerSystem.executeCode(nodeId, code);
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
  {isTimerCallbackActive}
  supportsLibraries={false}
  nodeLabel="worker"
  language="javascript"
  editorPlaceholder="Write your JavaScript code here..."
  nodeType="worker"
  videoInletCount={data.videoInletCount ?? 0}
/>
