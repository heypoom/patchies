<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals, useViewport } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import ObjectPreviewLayout from '$lib/components/ObjectPreviewLayout.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas/common';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { handleCodeError } from '$lib/js-runner/handleCodeError';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent } from '$lib/eventbus/events';
  import { JSRunner } from '$lib/js-runner/JSRunner';
  import type { CustomConsole } from '$lib/utils/createCustomConsole';
  import { createIsolatedContainer } from '$lib/utils/tailwindBrowser';
  import { SettingsManager, createSettingsAPI } from '$lib/settings';
  import { createKVStore } from '$lib/storage';
  import type { SettingsSchema } from '$lib/settings';
  import {
    getDomSizeResetData,
    measureDomSize,
    shouldResetDomSize,
    type DomSize
  } from './runtime-size';

  export type DomRuntimeRoot = {
    root: HTMLElement;
    extraContext?: Record<string, unknown>;
    handleResult?: (result: unknown) => void;
  };

  export type CreateDomRuntimeRoot = (options: {
    containerRoot: HTMLElement;
    customConsole: CustomConsole;
  }) => Promise<DomRuntimeRoot> | DomRuntimeRoot;

  type DomRuntimeData = {
    title: string;
    code: string;
    inletCount?: number;
    outletCount?: number;
    hidePorts?: boolean;
    executeCode?: number;
    showConsole?: boolean;
    width?: number;
    height?: number;
    settingsSchema?: SettingsSchema;
    settings?: Record<string, unknown>;
  };

  let {
    id: nodeId,
    data,
    selected,
    objectType,
    titleFallback,
    codePlaceholder,
    consolePlaceholder,
    errorOffset,
    createRuntimeRoot,
    cleanupRuntime = () => {}
  }: {
    id: string;
    data: DomRuntimeData;
    selected?: boolean;
    objectType: string;
    titleFallback: string;
    codePlaceholder: string;
    consolePlaceholder: string;
    errorOffset: number;
    createRuntimeRoot: CreateDomRuntimeRoot;
    cleanupRuntime?: () => void;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const viewport = useViewport();

  const settingsManager = new SettingsManager(
    () => data.settings ?? {},
    (settings, schema) => updateNodeData(nodeId, { settings, settingsSchema: schema }),
    createKVStore(nodeId)
  );

  let consoleRef: VirtualConsole | null = $state(null);
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);

  const eventBus = PatchiesEventBus.getInstance();
  const jsRunner = JSRunner.getInstance();
  const customConsole = createCustomConsole(nodeId);

  let rootContainer = $state<HTMLDivElement | undefined>();
  let previewContainer = $state<HTMLDivElement | undefined>();
  let transientSize = $state<DomSize | null>(null);
  let dragEnabled = $state(true);
  let panEnabled = $state(true);
  let wheelEnabled = $state(true);
  let editorReady = $state(false);
  let runRevision = 0;

  let containerWidth = $derived(data.width);
  let containerHeight = $derived(data.height);
  let previewWidth = $derived(transientSize?.width ?? containerWidth);
  let previewHeight = $derived(transientSize?.height ?? containerHeight);

  let inletCount = $derived(data.inletCount ?? 1);
  let outletCount = $derived(data.outletCount ?? 0);
  let previousExecuteCode = $state<number | undefined>(undefined);

  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      runCode();
    }
  });

  const setPortCount = (newInletCount = 1, newOutletCount = 0) => {
    updateNodeData(nodeId, { inletCount: newInletCount, outletCount: newOutletCount });
    updateNodeInternals(nodeId);
  };

  const setCodeAndUpdate = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });
    setTimeout(() => runCode());
  };

  const handleMessage: MessageCallbackFn = (message, _meta) => {
    try {
      match(message)
        .with(messages.setCode, ({ value }) => {
          setCodeAndUpdate(value);
        })
        .with(messages.run, () => {
          runCode();
        })
        .with(messages.stop, () => {
          stopLongRunningTasks();
        })
        .otherwise(() => {
          // Messages are delivered via recv() callback set by user code
        });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  function setSize(width: number, height: number) {
    updateNodeData(nodeId, { width, height });
  }

  function stopLongRunningTasks() {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.clearTimers();
    messageContext.messageCallbacks = [];
  }

  function releaseTransientSize(runId: number) {
    requestAnimationFrame(() => {
      if (runRevision === runId) {
        transientSize = null;
      }
    });
  }

  async function runCode() {
    if (!rootContainer) return;

    const runId = ++runRevision;

    consoleRef?.clearConsole();
    lineErrors = undefined;

    dragEnabled = true;
    panEnabled = true;
    wheelEnabled = true;

    const resetSize = shouldResetDomSize(data.code);

    if (resetSize) {
      transientSize = measureDomSize(
        previewContainer,
        {
          width: containerWidth,
          height: containerHeight
        },
        viewport.current.zoom
      );

      updateNodeData(nodeId, getDomSizeResetData());
    }

    settingsManager.clearCallbacks();

    try {
      const container = createIsolatedContainer(rootContainer);
      const runtimeRoot = await createRuntimeRoot({
        containerRoot: container.root,
        customConsole
      });
      const processedCode = await jsRunner.preprocessCode(data.code, { nodeId });

      if (processedCode === null) {
        return;
      }

      const result = await jsRunner.executeJavaScript(nodeId, processedCode, {
        customConsole,
        setPortCount,
        setTitle: (title: string) => updateNodeData(nodeId, { title }),
        setHidePorts: (hidePorts: boolean) => updateNodeData(nodeId, { hidePorts }),
        extraContext: {
          settings: createSettingsAPI(settingsManager),
          root: runtimeRoot.root,
          width: resetSize ? undefined : containerWidth,
          height: resetSize ? undefined : containerHeight,
          setSize,
          noDrag: () => {
            dragEnabled = false;
          },
          noPan: () => {
            panEnabled = false;
          },
          noWheel: () => {
            wheelEnabled = false;
          },
          noInteract: () => {
            dragEnabled = false;
            panEnabled = false;
            wheelEnabled = false;
          },
          tailwind: container.tailwind,
          ...(runtimeRoot.extraContext ?? {})
        }
      });

      runtimeRoot.handleResult?.(result);
    } catch (error) {
      handleCodeError(error, data.code, nodeId, customConsole, errorOffset);
    } finally {
      if (resetSize) {
        releaseTransientSize(runId);
      }
    }
  }

  onMount(() => {
    const messageContext = jsRunner.getMessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    setTimeout(() => {
      runCode();
    }, 50);
  });

  onDestroy(() => {
    cleanupRuntime();
    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
    jsRunner.destroy(nodeId);
  });

  const handleClass = $derived.by(() => {
    if (!data.hidePorts) return '';

    if (!selected && $shouldShowHandles) {
      return 'z-1 transition-opacity';
    }

    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });
</script>

<ObjectPreviewLayout
  title={data.title ?? titleFallback}
  {objectType}
  {nodeId}
  onrun={runCode}
  {editorReady}
  settingsSchema={data.settingsSchema}
  settingsValues={data.settings ?? {}}
  onSettingsValueChange={(key, value) => settingsManager.setValue(key, value)}
  onSettingsRevertAll={() => settingsManager.revertAll()}
>
  {#snippet topHandle()}
    {#each Array.from({ length: inletCount }) as _, index}
      <TypedHandle
        port="inlet"
        spec={{ handleId: index }}
        title={`Inlet ${index}`}
        total={inletCount}
        {index}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet preview()}
    <div
      bind:this={previewContainer}
      class={[
        'overflow-hidden rounded-md',
        lineErrors !== undefined
          ? 'border-red-500/70'
          : selected
            ? 'shadow-glow-md ring ring-zinc-400'
            : 'hover:shadow-glow-sm',
        !dragEnabled && 'nodrag',
        !panEnabled && 'nopan',
        !wheelEnabled && 'nowheel'
      ]}
      style={previewWidth !== undefined && previewHeight !== undefined
        ? `width: ${previewWidth}px; height: ${previewHeight}px;`
        : ''}
    >
      <div bind:this={rootContainer} class="h-full w-full"></div>
    </div>
  {/snippet}

  {#snippet bottomHandle()}
    {#each Array.from({ length: outletCount }) as _, index}
      <TypedHandle
        port="outlet"
        spec={{ handleId: index }}
        title={`Outlet ${index}`}
        total={outletCount}
        {index}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet codeEditor()}
    <CodeEditor
      value={data.code}
      language="javascript"
      nodeType={objectType}
      placeholder={codePlaceholder}
      class="nodrag h-64 w-full resize-none"
      onrun={runCode}
      onchange={(newCode) => {
        updateNodeData(nodeId, { code: newCode });
      }}
      onready={() => (editorReady = true)}
      {lineErrors}
      {nodeId}
    />
  {/snippet}

  {#snippet console()}
    <div class="mt-3 w-full" class:hidden={!data.showConsole}>
      <VirtualConsole
        bind:this={consoleRef}
        {nodeId}
        placeholder={consolePlaceholder}
        maxHeight="200px"
      />
    </div>
  {/snippet}
</ObjectPreviewLayout>
