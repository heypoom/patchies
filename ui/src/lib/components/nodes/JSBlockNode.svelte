<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { JSRunner } from '$lib/js-runner/JSRunner';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { handleCodeError } from '$lib/js-runner/handleCodeError';
  import CodeBlockBase from './CodeBlockBase.svelte';
  import { SettingsManager, createSettingsAPI } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import type { SettingsSchema } from '$lib/settings';
  import { requestFitView } from '../../../stores/ui.store';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { FitViewOptions } from '@xyflow/svelte';
  import { overrideOutputNodeId } from '../../../stores/renderer.store';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { useNodeSetPaused } from '$lib/canvas/use-node-set-paused.svelte';

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
      libraryName?: string | null;
      executeCode?: number;
      consoleHeight?: number;
      consoleWidth?: number;
      settingsSchema?: SettingsSchema;
      settings?: Record<string, unknown>;
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

  // Settings manager — persists across code re-runs
  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(nodeId, { settings, settingsSchema: schema }),
    createKVStore(nodeId)
  );
  const settingsAPI = createSettingsAPI(settingsManager);

  const code = $derived(data.code || '');

  // Create custom console for routing output to VirtualConsole
  const customConsole = createCustomConsole(nodeId);

  // Reference to base component for flash
  let baseRef: CodeBlockBase | null = $state(null);

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(messages.setCode, ({ value }) => {
          updateNodeData(nodeId, { code: value });
        })
        .with(messages.run, () => {
          executeCode();
        })
        .with(messages.stop, () => {
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
    settingsManager.onChangeCallbackRegistered = () => {
      isTimerCallbackActive = true;
    };
    messageContext.queue.addCallback(handleMessage);

    // libraries should be run on mount to register themselves
    if (data.runOnMount || data.libraryName) {
      executeCode();
    }
  });

  onDestroy(() => {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.queue.removeCallback(handleMessage);

    jsRunner.destroy(nodeId);
  });

  function clearTimers() {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.clearTimers();
    isTimerCallbackActive = false;
  }

  function clearMessageHandler() {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.messageCallbacks = [];
    isMessageCallbackActive = false;
  }

  function cleanupRunningTasks() {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.runCleanupCallbacks();
    clearTimers();
    clearMessageHandler();
    settingsManager.clearCallbacks();
  }

  let isPaused = $state(false);

  function togglePlayback() {
    if (isPaused) {
      isPaused = false;
      executeCode();
    } else {
      isPaused = true;
      cleanupRunningTasks();
    }
  }

  useNodeSetPaused(nodeId, () => isPaused, togglePlayback);

  async function executeCode() {
    isRunning = true;
    isMessageCallbackActive = false;
    isTimerCallbackActive = false;

    // Clear onChange callbacks — they'll be re-registered by user code
    settingsManager.clearCallbacks();

    const setPortCount = (inletCount = 1, outletCount = 1) => {
      updateNodeData(nodeId, { inletCount, outletCount });
      updateNodeInternals(nodeId);
    };

    const setRunOnMount = (runOnMount = true) => updateNodeData(nodeId, { runOnMount });

    const setTitle = (title: string) => updateNodeData(nodeId, { title });

    const flash = () => baseRef?.flash();

    try {
      const processedCode = await jsRunner.preprocessCode(code, {
        nodeId,
        setLibraryName: (libraryName: string | null) => {
          updateNodeData(nodeId, { libraryName, inletCount: 0, outletCount: 0 });
        }
      });

      // library code - do not execute
      if (processedCode === null) return;

      await jsRunner.executeJavaScript(nodeId, processedCode, {
        customConsole,
        setPortCount,
        setRunOnMount,
        setTitle,
        extraContext: {
          flash,
          focusObjects: (options: FitViewOptions) => requestFitView.set(options),
          setBackgroundOutput: (id: string | null) => {
            overrideOutputNodeId.set(id);
            GLSystem.getInstance().setOverrideOutputNode(id);
          },
          pauseObject: (id: string) =>
            PatchiesEventBus.getInstance().dispatch({
              type: 'nodeSetPaused',
              nodeId: id,
              paused: true
            }),
          unpauseObject: (id: string) =>
            PatchiesEventBus.getInstance().dispatch({
              type: 'nodeSetPaused',
              nodeId: id,
              paused: false
            }),
          setPrimaryButton: (primaryButton: 'code' | 'settings' | 'run') => {
            PatchiesEventBus.getInstance().dispatch({
              type: 'nodePrimaryButtonUpdate',
              nodeId,
              primaryButton
            });
          },
          settings: settingsAPI
        },
        onSchedulerCallbackRegistered: () => {
          isTimerCallbackActive = true;
        }
      });
    } catch (error) {
      handleCodeError(error, code, nodeId, customConsole);
    } finally {
      isRunning = false;
    }
  }

  function handleCodeChange(newCode: string) {
    if (data.libraryName) {
      jsRunner.setLibraryCode(nodeId, newCode);
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
  onCodeChange={handleCodeChange}
  {isRunning}
  {isMessageCallbackActive}
  {isTimerCallbackActive}
  supportsLibraries={true}
  nodeLabel="js"
  language="javascript"
  editorPlaceholder="Write your JavaScript code here..."
  nodeType="js"
  settingsSchema={data.settingsSchema}
  settingsValues={data.settings ?? {}}
  onSettingsValueChange={(key, value) => settingsManager.setValue(key, value)}
  onSettingsRevertAll={() => settingsManager.revertAll()}
/>
