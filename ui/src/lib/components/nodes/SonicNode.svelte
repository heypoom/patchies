<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { match, P } from 'ts-pattern';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import SimpleDspLayout from './SimpleDspLayout.svelte';
  import type { SonicNode } from '$lib/audio/v2/nodes/SonicNode';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';

  // Get node data from XY Flow - nodes receive their data as props
  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      code: string;
      messageInletCount?: number;
      messageOutletCount?: number;
      title?: string;
      executeCode?: number;
      showConsole?: boolean;
    };
    selected: boolean;
  } = $props();

  // Get flow utilities to update node data
  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  let audioService = AudioService.getInstance();
  let eventBus = PatchiesEventBus.getInstance();
  let previousExecuteCode = $state<number | undefined>(undefined);
  let consoleRef: VirtualConsole | null = $state(null);
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);

  // Listen for console output events to capture lineErrors
  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  // Watch for executeCode timestamp changes and re-run when it changes
  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      runSonic();
    }
  });

  const handleMessage: MessageCallbackFn = (message, meta) => {
    match(message)
      .with({ type: 'run' }, () => runSonic())
      .with(P.any, () => {
        if (meta?.inlet === undefined) return;

        audioService.send(nodeId, 'messageInlet', {
          inletIndex: meta.inlet,
          message,
          meta
        });
      });
  };

  const updateAudioCode = (code: string) => audioService.send(nodeId, 'code', code);

  function handleCodeChange(newCode: string) {
    updateNodeData(nodeId, { code: newCode });

    setTimeout(() => {
      const sonicNode = audioService.getNodeById(nodeId) as SonicNode | undefined;

      if (!sonicNode) return;

      sonicNode.onSetPortCount = (inletCount: number, outletCount: number) => {
        updateNodeData(nodeId, {
          messageInletCount: inletCount,
          messageOutletCount: outletCount
        });

        updateNodeInternals(nodeId);
      };

      sonicNode.onSetTitle = (title: string) => {
        updateNodeData(nodeId, { title });
      };
    }, 10);
  }

  function runSonic() {
    // Clear previous console output and error highlighting
    consoleRef?.clearConsole();
    lineErrors = undefined;

    updateAudioCode(data.code);
  }

  function handleToggleConsole() {
    updateNodeData(nodeId, { showConsole: !data.showConsole });
  }

  onMount(() => {
    audioService.createNode(nodeId, 'sonic~', [null, data.code]);
    handleCodeChange(data.code);
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);
  });

  onDestroy(() => {
    audioService.removeNodeById(nodeId);

    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
  });
</script>

<SimpleDspLayout
  {nodeId}
  nodeName="sonic~"
  nodeType="sonic~"
  {data}
  {selected}
  onCodeChange={handleCodeChange}
  onRun={runSonic}
  {handleMessage}
  showConsole={data.showConsole}
  onToggleConsole={handleToggleConsole}
  {lineErrors}
>
  {#snippet console()}
    <VirtualConsole
      bind:this={consoleRef}
      {nodeId}
      onrun={runSonic}
      placeholder="SuperSonic errors will appear here."
    />
  {/snippet}
</SimpleDspLayout>
