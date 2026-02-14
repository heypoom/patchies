<script lang="ts">
  import { Binary, Pause, Play, RotateCcw, Settings, StepForward, X } from '@lucide/svelte/icons';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy, tick } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { asmMessages } from '$lib/objects/schemas/asm';
  import { AssemblySystem } from './AssemblySystem';
  import AssemblyEditor from './AssemblyEditor.svelte';
  import MachineStateViewer from './MachineStateViewer.svelte';
  import type { InspectedMachine, Effect, Message, MachineConfig } from './AssemblySystem';
  import { memoryActions } from './memoryStore';
  import { formatSequencerError } from './formatSequencerError';
  import { ASM_DEFAULT_DELAY_MS, ASM_DEFAULT_STEP_BY } from './constants';
  import PaginatedMemoryViewer from './PaginatedMemoryViewer.svelte';
  import { logger } from '$lib/utils/logger';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import { useNodeDataTracker } from '$lib/history';
  import { toast } from 'svelte-sonner';

  const eventBus = PatchiesEventBus.getInstance();

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title: string;
      code: string;
      inletCount?: number;
      outletCount?: number;
      showMemoryViewer?: boolean;
      machineConfig?: MachineConfig;
    };
    selected?: boolean;
  } = $props();

  let assemblySystem = AssemblySystem.getInstance();
  let messageContext: MessageContext;
  let errorMessage = $state<string | null>(null);
  let machineState = $state<InspectedMachine | null>(null);
  let logs = $state<string[]>([]);
  let lastLoadedCode = $state<string | null>(null);
  let isOperationInProgress = $state(false); // Guard against concurrent operations
  let dragEnabled = $state(true);
  let showSettings = $state(false);
  let mainContainer: HTMLDivElement;
  let highlightLineCallback: ((lineNo: number) => void) | null = null;
  let hasShownReadonlyToast = false;

  const { updateNodeData } = useSvelteFlow();

  function handleReadonlyInput() {
    if (!hasShownReadonlyToast) {
      hasShownReadonlyToast = true;
      toast.info('Pause the machine to edit code');
    }
  }

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(nodeId);

  let inletCount = $derived(data.inletCount ?? 1);
  let outletCount = $derived(data.outletCount ?? 3);

  // Use node data as single source of truth for machine config
  const machineConfig = $derived(
    data.machineConfig || {
      isRunning: false,
      delayMs: ASM_DEFAULT_DELAY_MS,
      stepBy: ASM_DEFAULT_STEP_BY
    }
  );

  let previewContainerWidth = $state(0);
  let updateInterval: NodeJS.Timeout | number;
  let resizeObserver: ResizeObserver | null = null;

  // Local state for settings inputs (synced with machineConfig via $effect)
  let delayInput = $state(ASM_DEFAULT_DELAY_MS);
  let stepByInput = $state(ASM_DEFAULT_STEP_BY);

  // Sync local state when machineConfig changes externally
  $effect(() => {
    delayInput = machineConfig.delayMs;
    stepByInput = machineConfig.stepBy;
  });

  // Machine ID is derived from node ID
  const machineId = parseInt(nodeId.replace(/\D/g, '')) || 0;

  const setCodeAndUpdate = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });

    setTimeout(() => reloadProgram(true));
  };

  const toggleMemoryViewer = () =>
    updateNodeData(nodeId, { showMemoryViewer: !data.showMemoryViewer });

  const handleMessage: MessageCallbackFn = async (message, meta) => {
    const sendDataAndStep = async (m: number | number[]) => {
      if (meta.inlet === undefined) return;

      const sourceIdStr = meta.source.match(/\w+-(\d+)/)?.[1];
      const parsedSource = sourceIdStr !== undefined ? Number(sourceIdStr) : NaN;
      const source = !isNaN(parsedSource) && parsedSource >= 0 ? parsedSource : 0;

      await assemblySystem.sendDataMessage(machineId, m, source, meta.inlet);

      // Run until the machine blocks (reactive dataflow mode)
      const MAX_CYCLES = 10_000;
      let cyclesRun = 0;

      while (cyclesRun < MAX_CYCLES) {
        await assemblySystem.stepMachine(machineId, 100);
        cyclesRun += 100;

        const state = await assemblySystem.inspectMachine(machineId);
        if (!state) break;

        // Stop when machine reaches a blocking state
        if (
          state.status === 'Awaiting' ||
          state.status === 'Halted' ||
          state.status === 'Sleeping'
        ) {
          break;
        }
      }

      await syncMachineState();
    };

    try {
      await match(message)
        .with(asmMessages.bang, () => stepMachine())
        .with(asmMessages.setCode, ({ value }) => setCodeAndUpdate(value))
        .with(asmMessages.run, () => reloadProgram(true))
        .with(asmMessages.play, () => playMachine())
        .with(asmMessages.pause, () => pauseMachine())
        .with(asmMessages.toggle, () => togglePlayPause())
        .with(asmMessages.reset, () => resetMachine())
        .with(asmMessages.step, () => stepMachine())
        .with(asmMessages.setDelayMs, ({ value }) => updateMachineConfig({ delayMs: value }))
        .with(asmMessages.setStepBy, ({ value }) => updateMachineConfig({ stepBy: value }))
        .with(asmMessages.numberArray, sendDataAndStep)
        .with(asmMessages.number, sendDataAndStep)
        .otherwise(() => {
          // Unknown message type
        });
    } catch (error) {
      displayError(error);
    }
  };

  async function resetMachine() {
    if (isOperationInProgress) return;
    isOperationInProgress = true;
    logs = [];
    errorMessage = null;

    try {
      await assemblySystem.resetMachine(machineId);
      await assemblySystem.loadProgram(machineId, data.code);
      lastLoadedCode = data.code;

      await syncMachineState();

      memoryActions.refreshMemory(machineId);
    } catch (error) {
      displayError(error);
    } finally {
      isOperationInProgress = false;
    }
  }

  async function stepMachine() {
    if (isOperationInProgress) return;
    isOperationInProgress = true;

    try {
      await assemblySystem.stepMachine(machineId, machineConfig.stepBy);

      await syncMachineState();
      memoryActions.refreshMemory(machineId);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'type' in error &&
        error.type === 'MachineDoesNotExist'
      ) {
        await assemblySystem.createMachineWithId(machineId);
        await assemblySystem.loadProgram(machineId, data.code);
        lastLoadedCode = data.code;
        await assemblySystem.stepMachine(machineId, machineConfig.stepBy);
        await pullMachineConfig();
      } else {
        displayError(error);
      }
    } finally {
      isOperationInProgress = false;
    }
  }

  async function pullMachineConfig() {
    const nextConfig = await assemblySystem.getMachineConfig(machineId);

    updateNodeData(nodeId, { machineConfig: nextConfig });
  }

  async function pauseMachine() {
    try {
      const state = await assemblySystem.inspectMachine(machineId);

      await assemblySystem.pauseMachine(machineId);

      // If machine is stuck in awaiting state, pausing should reset it.
      if (state?.status === 'Awaiting') {
        await resetMachine();
      }

      await pullMachineConfig();

      clearInterval(updateInterval);
    } catch (error) {
      displayError(error);
    }
  }

  async function playMachine() {
    // Guard against concurrent operations
    if (isOperationInProgress) return;
    isOperationInProgress = true;

    // Capture error state before clearing - force reload if retrying after error
    const hadError = errorMessage !== null;
    errorMessage = null;

    try {
      // Ensure machine exists and has a program loaded
      const exists = await assemblySystem.machineExists(machineId);

      if (!exists) {
        await assemblySystem.createMachineWithId(machineId);
      }

      // Check if machine has a program loaded by inspecting its state
      const currentState = await assemblySystem.inspectMachine(machineId);

      // Reload if code changed, machine is halted, no state, or recovering from error
      const codeChanged = lastLoadedCode !== null && lastLoadedCode !== data.code;
      if (!currentState || currentState.status === 'Halted' || codeChanged || hadError) {
        await assemblySystem.loadProgram(machineId, data.code);
        lastLoadedCode = data.code;
      }

      await assemblySystem.playMachine(machineId);
      await setupPolling();
    } catch (error) {
      displayError(error);
    } finally {
      isOperationInProgress = false;
    }
  }

  async function togglePlayPause() {
    if (machineConfig.isRunning) {
      await pauseMachine();
    } else {
      await playMachine();
    }
  }

  function updateMachineConfig(nextConfig: Partial<MachineConfig>) {
    // Use local input state to avoid race conditions when updating multiple fields quickly
    const mergedConfig: MachineConfig = {
      isRunning: machineConfig.isRunning,
      delayMs: nextConfig.delayMs ?? delayInput,
      stepBy: nextConfig.stepBy ?? stepByInput
    };

    assemblySystem.setMachineConfig(machineId, mergedConfig);
    updateNodeData(nodeId, { machineConfig: mergedConfig });
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    initMachine();

    // Use ResizeObserver to re-measure container width on code changes
    if (mainContainer) {
      resizeObserver = new ResizeObserver(() => {
        measureContainerWidth();
      });
      resizeObserver.observe(mainContainer);
    }
  });

  /** Create machine, push saved config, then setup polling. Must be sequential. */
  async function initMachine() {
    await reloadProgram(false);
    await pushMachineConfig();
    await setupPolling();
  }

  async function pushMachineConfig() {
    try {
      if (data.machineConfig) {
        // Don't auto-play on reload - always start stopped
        const configWithoutAutoPlay = { ...data.machineConfig, isRunning: false };

        await assemblySystem.setMachineConfig(machineId, configWithoutAutoPlay);

        updateNodeData(nodeId, { machineConfig: configWithoutAutoPlay });
      }
    } catch (error) {
      // Use default config if unable to load
    }
  }

  async function setupPolling() {
    clearInterval(updateInterval);

    await pullMachineConfig();
    // Wait for Svelte reactive updates to propagate
    await tick();

    if (!machineConfig.isRunning) return;

    updateInterval = setInterval(async () => {
      await syncMachineState();

      // Only refresh memory if the viewer is open (conditional polling)
      if (data.showMemoryViewer) {
        memoryActions.refreshMemory(machineId);
      }
    }, machineConfig.delayMs);
  }

  onDestroy(async () => {
    clearInterval(updateInterval);
    resizeObserver?.disconnect();

    // Clean up the machine when component is destroyed
    try {
      await assemblySystem.removeMachine(machineId);
    } catch (error) {}

    // Unregister the highlighter
    assemblySystem.unregisterHighlighter(machineId);

    messageContext?.destroy();
  });

  async function reloadProgram(shouldStep: boolean) {
    if (isOperationInProgress) return;
    isOperationInProgress = true;
    logs = [];
    errorMessage = null;

    try {
      messageContext.clearTimers();

      if (!(await assemblySystem.machineExists(machineId))) {
        await assemblySystem.createMachineWithId(machineId);
      }

      await assemblySystem.loadProgram(machineId, data.code);
      lastLoadedCode = data.code;

      if (shouldStep) {
        await assemblySystem.stepMachine(machineId, machineConfig.stepBy);
      }

      await syncMachineState();

      // Refresh memory display after execution
      memoryActions.refreshMemory(machineId);
    } catch (error) {
      displayError(error);
    } finally {
      isOperationInProgress = false;
    }
  }

  function displayError(error: unknown) {
    // Stop the machine on error - can't continue with invalid/errored state
    clearInterval(updateInterval);

    if (machineConfig.isRunning) {
      updateMachineConfig({ isRunning: false });
    }

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (typeof error === 'object' && error !== null) {
      // Try to format VASM errors to human-readable messages
      const formatted = formatSequencerError(error);
      errorMessage = formatted ?? JSON.stringify(error, null, 2);
    }
  }

  async function syncMachineState() {
    try {
      // Use batched snapshot API (4 round trips → 1)
      const snapshot = await assemblySystem.getSnapshot(machineId);
      if (!snapshot) {
        return;
      }

      const { machine, effects, messages } = snapshot;

      // Update machine state
      const previousPc = machineState?.registers.pc;
      machineState = machine;

      // Trigger line highlighting if program counter changed
      if (machineState && machineState.registers.pc !== previousPc) {
        assemblySystem.highlightLineFromPC(machineId, machineState.registers.pc);
      }

      // Process print effects
      const printEffects = effects
        .filter((effect) => effect.type === 'Print')
        .map((effect) => effect.text);

      if (printEffects.length > 0) {
        logs = [...logs, ...printEffects].slice(-10);
      }

      // Process sleep effects
      const combinedSleepMs = effects
        .filter((effect) => effect.type === 'Sleep')
        .map((effect) => effect.ms)
        .reduce((a, b) => a + b, 0);

      if (combinedSleepMs > 0) {
        setTimeout(() => {
          assemblySystem.send('wakeMachine', { machineId });
        }, combinedSleepMs);
      }

      // Re-map message format of assembly canvas into patchies
      messages.forEach((message: Message) => {
        const payload = match(message.action)
          .with({ type: 'Data' }, (action) => {
            return action.body.length === 1 ? action.body[0] : action.body;
          })
          .with({ type: 'Read' }, (action) => {
            return { type: 'read', address: action.address, count: action.count };
          })
          .with({ type: 'Write' }, (action) => {
            return { type: 'write', address: action.address, data: action.data };
          })
          .with({ type: 'Override' }, (action) => {
            return { type: 'override', data: action.data };
          })
          .exhaustive();

        messageContext.send(payload, { to: message.sender.port });
      });

      // Stop when execution has terminated (Halted = finished, Errored = runtime error)
      if (machineState?.status === 'Halted' || machineState?.status === 'Errored') {
        clearInterval(updateInterval);
        updateMachineConfig({ isRunning: false });
      }

      // Notify listeners that machine state has changed
      eventBus.dispatch({ type: 'asmMachineStateChanged', machineId });
    } catch (error) {
      // Log errors for debugging but don't spam the UI
      logger.warn(`[asm ${machineId}] syncMachineState error:`, error);
    }
  }

  function measureContainerWidth() {
    const gap = 8;

    if (mainContainer) {
      previewContainerWidth = mainContainer.clientWidth + gap;
    }
  }

  function onHighlightLineSetup(callback: (lineNo: number) => void) {
    highlightLineCallback = callback;

    // Register this highlighter with the AssemblySystem
    assemblySystem.registerHighlighter(machineId, callback);
  }
</script>

<div class="group relative flex gap-2">
  <div class="group relative flex flex-col gap-2" bind:this={mainContainer}>
    <!-- Floating Action Button -->
    <div class="absolute -top-7 left-0 flex w-full items-center justify-between gap-1">
      <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
        <div class="font-mono text-xs font-medium text-zinc-400">asm</div>
      </div>

      <div class="flex">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={() => (showSettings = !showSettings)}
              class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
            >
              <Settings class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content>Machine settings</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={toggleMemoryViewer}
              class="cursor-pointer rounded p-1 transition-opacity group-hover:not-disabled:opacity-100 hover:bg-zinc-700 disabled:cursor-not-allowed group-hover:disabled:opacity-30 sm:opacity-0"
              disabled={machineState === null}
            >
              <Binary class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content>Toggle memory viewer</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={resetMachine}
              class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 group-hover:not-disabled:opacity-100 hover:bg-zinc-700 disabled:cursor-not-allowed group-hover:disabled:opacity-30 sm:opacity-0"
              disabled={machineState === null}
            >
              <RotateCcw class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content>Reset machine</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={stepMachine}
              class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 group-hover:not-disabled:opacity-100 hover:bg-zinc-700 disabled:cursor-not-allowed group-hover:disabled:opacity-30 sm:opacity-0"
              disabled={machineState?.status === 'Halted' || errorMessage !== null}
            >
              <StepForward class="h-4 w-4 text-zinc-300" />
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content
            >Step {machineConfig.stepBy} cycle{machineConfig.stepBy > 1 ? 's' : ''}</Tooltip.Content
          >
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={togglePlayPause}
              class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
            >
              <!-- svelte-ignore svelte_component_deprecated -->
              <svelte:component
                this={machineConfig.isRunning ? Pause : Play}
                class="h-4 w-4 text-zinc-300"
              />
            </button>
          </Tooltip.Trigger>

          <Tooltip.Content
            >{machineConfig.isRunning ? 'Pause machine' : 'Run machine'}</Tooltip.Content
          >
        </Tooltip.Root>
      </div>
    </div>

    <div
      class="flex min-w-80 flex-col rounded-lg border bg-zinc-900/95 px-3 py-3 font-mono text-gray-50 hover:border-zinc-400"
      class:border-red-400={errorMessage}
      class:border-purple-400={machineState?.status === 'Awaiting'}
      class:border-gray-600={machineState?.status === 'Halted'}
      class:border-orange-400={machineState && machineState.inbox_size > 50}
      class:border-red-600={machineState && machineState.inbox_size > 50}
      class:border-blue-400={machineState && machineState.outbox_size >= 1}
      class:border-gray-500={machineState?.status === 'Sleeping'}
      class:!border-zinc-300={selected}
      class:nodrag={!dragEnabled}
    >
      <!-- Top handles (inputs) -->
      {#each Array.from({ length: inletCount }) as _, index}
        <StandardHandle
          port="inlet"
          id={index}
          title={`Inlet ${index}`}
          total={inletCount}
          {index}
          {nodeId}
        />
      {/each}

      <div class="flex flex-col gap-2">
        <!-- Editor -->
        <div class="nodrag">
          <AssemblyEditor
            value={data.code}
            readonly={machineConfig.isRunning}
            onchange={(newCode) => updateNodeData(nodeId, { code: newCode })}
            onrun={playMachine}
            onReadonlyInput={handleReadonlyInput}
            placeholder="Enter assembly code..."
            highlightLine={onHighlightLineSetup}
          />
        </div>

        <!-- Machine State Viewer -->
        <MachineStateViewer {machineId} state={machineState} error={errorMessage} {logs} />

        <!-- Memory Viewer -->
        {#if machineState && data.showMemoryViewer}
          <PaginatedMemoryViewer {machineId} />
        {/if}
      </div>

      <!-- Bottom handles (outputs) -->
      {#each Array.from({ length: outletCount }) as _, index}
        <StandardHandle
          type="message"
          port="outlet"
          id={index}
          title={`Outlet ${index}`}
          total={outletCount}
          {index}
          {nodeId}
        />
      {/each}
    </div>
  </div>

  {#if showSettings}
    <div class="absolute" style="left: {previewContainerWidth}px;">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button
          onclick={() => (showSettings = false)}
          class="cursor-pointer rounded p-1 hover:bg-zinc-700"
        >
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      {@render settings()}
    </div>
  {/if}
</div>

{#snippet settings()}
  <div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-4">
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Instructions per Step</label>

        <input
          type="number"
          min="1"
          max="1000"
          bind:value={stepByInput}
          onchange={() => {
            if (!isNaN(stepByInput) && stepByInput >= 1 && stepByInput <= 1000) {
              const oldStepBy = machineConfig.stepBy;

              updateMachineConfig({ stepBy: stepByInput });
              tracker.commit('machineConfig.stepBy', oldStepBy, stepByInput);
            }
          }}
          class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
        />

        <div class="mt-1.5 text-xs text-zinc-500">Cycles to execute per step</div>
      </div>

      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Delay (ms)</label>

        <input
          type="number"
          min="10"
          max="5000"
          step="10"
          bind:value={delayInput}
          onchange={() => {
            if (!isNaN(delayInput) && delayInput >= 10 && delayInput <= 5000) {
              const oldDelayMs = machineConfig.delayMs;
              updateMachineConfig({ delayMs: delayInput });

              tracker.commit('machineConfig.delayMs', oldDelayMs, delayInput);
              setTimeout(() => setupPolling(), 5);
            }
          }}
          class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
        />

        <div class="mt-1.5 text-xs text-zinc-500">
          Delay between instructions for automatic execution
        </div>
      </div>
    </div>
  </div>
{/snippet}
