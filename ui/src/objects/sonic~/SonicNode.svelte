<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import SimpleDspLayout from '$objects/audio-code/SimpleDspLayout.svelte';
  import type { SonicNode } from '$objects/sonic~/SonicNode';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';
  import type { SettingsSchema } from '$lib/settings';

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
      showAudioInput?: boolean;
      title?: string;
      executeCode?: number;
      showConsole?: boolean;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
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

  $effect(() => {
    void data.messageInletCount;
    void data.messageOutletCount;
    void data.showAudioInput;
    updateNodeInternals(nodeId);
  });

  const updateAudioCode = (code: string) => audioService.send(nodeId, 'code', code);

  function handleCodeChange(newCode: string) {
    updateNodeData(nodeId, { code: newCode });
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
    eventBus.addEventListener('consoleOutput', handleConsoleOutput);
  });

  onDestroy(() => {
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
  showConsole={data.showConsole}
  onToggleConsole={handleToggleConsole}
  {lineErrors}
  settingsSchema={data.settingsSchema}
  settingsValues={data.settings ?? {}}
  onSettingsValueChange={(key, value) =>
    (audioService.getNodeById(nodeId) as SonicNode | null)
      ?.getSettingsManager()
      .setValue(key, value)}
  onSettingsRevertAll={() =>
    (audioService.getNodeById(nodeId) as SonicNode | null)?.getSettingsManager().revertAll()}
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
