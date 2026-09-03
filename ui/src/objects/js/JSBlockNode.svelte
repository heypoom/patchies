<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';

  import CodeBlockBase from '$objects/code/CodeBlockBase.svelte';
  import { useNodeViewMessageContext } from '$lib/messages';
  import { updateNodeDataFromCurrent } from '$lib/nodes/update-node-data';
  import type { SettingsSchema } from '$lib/settings';

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
      libraryName?: string | null;
      executeCode?: number;
      consoleHeight?: number;
      consoleWidth?: number;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
      isGraphSubscriptionActive?: boolean;
      isMessageCallbackActive?: boolean;
      isTimerCallbackActive?: boolean;
    };
    selected: boolean;
  } = $props();

  const { updateNode } = useSvelteFlow();

  const viewMessageContext = useNodeViewMessageContext(
    () => nodeId,
    () => {}
  );

  // JSObject observes executeCode and owns the actual execution.
  const handleRuntimeExecute = async () => {};

  const executeCode = async () =>
    updateNodeDataFromCurrent<typeof data>(updateNode, nodeId, (currentData) => ({
      executeCode: (currentData.executeCode ?? 0) + 1
    }));

  const cleanupRunningTasks = async () => viewMessageContext.send({ type: 'stop' });

  const setSetting = (key: string, value: unknown) =>
    viewMessageContext.send({ type: 'setSetting', key, value });
</script>

<CodeBlockBase
  id={nodeId}
  {data}
  {selected}
  onExecute={executeCode}
  onExecuteFromData={handleRuntimeExecute}
  onCleanup={cleanupRunningTasks}
  isRunning={false}
  isMessageCallbackActive={data.isMessageCallbackActive === true}
  isTimerCallbackActive={data.isTimerCallbackActive === true ||
    data.isGraphSubscriptionActive === true}
  supportsLibraries={true}
  nodeLabel="js"
  language="javascript"
  editorPlaceholder="Write your JavaScript code here..."
  nodeType="js"
  settingsSchema={data.settingsSchema}
  settingsValues={data.settings ?? {}}
  onSettingsValueChange={setSetting}
/>
