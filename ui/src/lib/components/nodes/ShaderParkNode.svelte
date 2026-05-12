<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import {
    outputWidth,
    outputHeight,
    previewWidth,
    previewHeight
  } from '../../../stores/renderer.store';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { removeExcessVideoOutletEdges } from './outlet-edges';
  import { messages } from '$lib/objects/schemas/common';
  import { AudioAnalysisSystem } from '$lib/audio/AudioAnalysisSystem';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import type {
    ConsoleOutputEvent,
    NodeHidePortsUpdateEvent,
    NodePortCountUpdateEvent,
    NodeTitleUpdateEvent,
    NodeVideoOutputEnabledUpdateEvent
  } from '$lib/eventbus/events';
  import { logger } from '$lib/utils/logger';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { FBOFormat, FBOResolution } from '$lib/rendering/types';
  import type { GLUniformDef } from '../../../types/uniform-config';
  import {
    extractShaderParkUniformDefs,
    normalizeShaderParkUniformValue
  } from '$lib/shaderpark/uniforms';
  import { toGLValue } from '$workers/rendering/glUniformUtils';
  import {
    uniformDefsToSettingsSchema,
    settingsSchemaToDefaultValues,
    visibleUniformInletDefs
  } from '$lib/canvas/shader-code-to-uniform-def';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title?: string;
      code: string;
      messageInletCount?: number;
      messageOutletCount?: number;
      videoInletCount?: number;
      videoOutletCount?: number;
      hidePorts?: boolean;
      executeCode?: number;
      showConsole?: boolean;
      shaderParkUniformDefs?: GLUniformDef[];
      uniformValues?: Record<string, unknown>;
      fboFormat?: FBOFormat;
      resolution?: FBOResolution;
    };
    selected?: boolean;
  } = $props();

  let consoleRef: VirtualConsole | null = $state(null);
  let lineErrors = $state<Record<number, string[]> | undefined>(undefined);
  const eventBus = PatchiesEventBus.getInstance();
  let glSystem = GLSystem.getInstance();
  let audioAnalysisSystem: AudioAnalysisSystem;
  let messageContext: MessageContext;
  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewBitmapContext: ImageBitmapRenderingContext;
  let videoOutputEnabled = $state(true);
  let editorReady = $state(false);
  let uniformValues = $state<Record<string, unknown>>(data.uniformValues ?? {});

  const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  let messageInletCount = $derived(data.messageInletCount ?? 1);
  let messageOutletCount = $derived(data.messageOutletCount ?? 0);
  let videoInletCount = $derived(data.videoInletCount ?? 4);
  let videoOutletCount = $derived(data.videoOutletCount ?? 1);
  let previousExecuteCode = $state<number | undefined>(undefined);
  const shaderParkUniformDefs = $derived(data.shaderParkUniformDefs ?? []);
  const uniformsSchema = $derived(uniformDefsToSettingsSchema(shaderParkUniformDefs));
  const visibleUniformInlets = $derived(visibleUniformInletDefs(shaderParkUniformDefs));

  $effect(() => {
    removeExcessVideoOutletEdges(nodeId, videoOutletCount, getEdges, deleteElements);
  });

  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;
      updateShaderPark();
    }
  });

  function handlePortCountUpdate(e: NodePortCountUpdateEvent) {
    if (e.nodeId !== nodeId) return;

    match(e)
      .with({ portType: 'message' }, (m) => {
        updateNodeData(nodeId, {
          messageInletCount: m.inletCount,
          messageOutletCount: m.outletCount
        });
      })
      .with({ portType: 'video' }, (m) => {
        updateNodeData(nodeId, {
          videoInletCount: m.inletCount,
          videoOutletCount: m.outletCount
        });
      })
      .exhaustive();

    updateNodeInternals(nodeId);
  }

  function handleTitleUpdate(e: NodeTitleUpdateEvent) {
    if (e.nodeId !== nodeId) return;
    updateNodeData(nodeId, { title: e.title });
  }

  function handleHidePortsUpdate(e: NodeHidePortsUpdateEvent) {
    if (e.nodeId !== nodeId) return;
    updateNodeData(nodeId, { hidePorts: e.hidePorts });
  }

  function handleVideoOutputEnabledUpdate(e: NodeVideoOutputEnabledUpdateEvent) {
    if (e.nodeId !== nodeId) return;
    videoOutputEnabled = e.videoOutputEnabled;
    updateNodeInternals(nodeId);
  }

  function handleConsoleOutput(event: ConsoleOutputEvent) {
    if (event.nodeId !== nodeId) return;

    if (event.messageType === 'error' && event.lineErrors) {
      lineErrors = event.lineErrors;
    }
  }

  const setCodeAndUpdate = (newCode: string) => {
    updateNodeData(nodeId, { code: newCode });
    setTimeout(() => updateShaderPark());
  };

  function getUniformNameFromHandle(targetHandle: string | null | undefined): string | undefined {
    if (!targetHandle?.startsWith('message-in-')) return undefined;

    const handleParts = targetHandle.split('-');
    const uniformIndex = handleParts[2];

    return handleParts.length > 3 && /^\d+$/.test(uniformIndex) ? handleParts[3] : undefined;
  }

  const handleMessage: MessageCallbackFn = (message, meta) => {
    try {
      const uniformName = getUniformNameFromHandle(meta.inletKey);

      if (uniformName) {
        const uniformDef = shaderParkUniformDefs.find((def) => def.name === uniformName);
        const uniformValue = toGLValue(uniformDef, message);

        glSystem.setUniformData(nodeId, uniformName, uniformValue);
        uniformValues = { ...uniformValues, [uniformName]: message };
        updateNodeData(nodeId, { uniformValues });

        return;
      }

      match(message)
        .with(messages.setCode, ({ value }) => {
          setCodeAndUpdate(value);
        })
        .with(messages.run, () => {
          updateShaderPark();
        })
        .otherwise(() => {});
    } catch (error) {
      logger.error('[shaderpark] message handling error:', error);
    }
  };

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    audioAnalysisSystem = AudioAnalysisSystem.getInstance();

    const glEventBus = glSystem.eventBus;
    glEventBus.addEventListener('nodePortCountUpdate', handlePortCountUpdate);
    glEventBus.addEventListener('nodeTitleUpdate', handleTitleUpdate);
    glEventBus.addEventListener('nodeHidePortsUpdate', handleHidePortsUpdate);
    glEventBus.addEventListener('nodeVideoOutputEnabledUpdate', handleVideoOutputEnabledUpdate);

    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    if (previewCanvas) {
      previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
    }

    glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;

    glSystem.upsertNode(nodeId, 'shaderpark', {
      code: data.code,
      videoInletCount: data.videoInletCount ?? 4,
      videoOutletCount: data.videoOutletCount ?? 1,
      shaderParkUniformDefs: data.shaderParkUniformDefs ?? [],
      uniformValues: data.uniformValues ?? {},
      fboFormat: data.fboFormat,
      resolution: data.resolution
    });

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
      updateShaderPark();
    }, 50);
  });

  onDestroy(() => {
    const glEventBus = glSystem?.eventBus;
    if (glEventBus) {
      glEventBus.removeEventListener('nodePortCountUpdate', handlePortCountUpdate);
      glEventBus.removeEventListener('nodeTitleUpdate', handleTitleUpdate);
      glEventBus.removeEventListener('nodeHidePortsUpdate', handleHidePortsUpdate);
      glEventBus.removeEventListener(
        'nodeVideoOutputEnabledUpdate',
        handleVideoOutputEnabledUpdate
      );
    }

    eventBus.removeEventListener('consoleOutput', handleConsoleOutput);

    audioAnalysisSystem?.disableFFT(nodeId);
    glSystem?.removeNode(nodeId);
    messageContext?.destroy();
  });

  const handleClass = $derived.by(() => {
    if (!data.hidePorts) return '';

    if (!selected && $shouldShowHandles) {
      return 'z-1 transition-opacity';
    }

    return `z-1 transition-opacity ${selected ? '' : 'sm:opacity-0 opacity-30 group-hover:opacity-100'}`;
  });

  function updateShaderPark() {
    consoleRef?.clearConsole();
    lineErrors = undefined;

    try {
      messageContext?.clearTimers();
      audioAnalysisSystem?.disableFFT(nodeId);

      const nextUniformDefs = extractShaderParkUniformDefs(data.code);
      const defaultValues = settingsSchemaToDefaultValues(
        uniformDefsToSettingsSchema(nextUniformDefs)
      );
      const pruned: Record<string, unknown> = {};

      for (const def of nextUniformDefs) {
        if (def.name in uniformValues) {
          pruned[def.name] = uniformValues[def.name];
        } else if (def.name in defaultValues) {
          pruned[def.name] = defaultValues[def.name];
        } else {
          pruned[def.name] = normalizeShaderParkUniformValue(
            (def as { default?: unknown }).default,
            def.type
          );
        }
      }

      uniformValues = pruned;

      const nextData = {
        code: data.code,
        videoInletCount: data.videoInletCount ?? 4,
        videoOutletCount: data.videoOutletCount ?? 1,
        shaderParkUniformDefs: nextUniformDefs,
        uniformValues: pruned,
        fboFormat: data.fboFormat,
        resolution: data.resolution,
        _runRevision: Date.now()
      };

      updateNodeData(nodeId, nextData);

      glSystem.upsertNode(nodeId, 'shaderpark', {
        ...nextData
      });

      for (const [name, value] of Object.entries(pruned)) {
        const uniformDef = nextUniformDefs.find((def) => def.name === name);

        glSystem.setUniformData(nodeId, name, toGLValue(uniformDef, value));
      }

      updateNodeInternals(nodeId);
    } catch (error) {
      logger.nodeError(
        nodeId,
        'Shader Park compilation failed:',
        error instanceof Error ? error.message : String(error)
      );
      logger.error('[shaderpark] update error:', error);
    }
  }

  function handleUniformValueChange(key: string, value: unknown) {
    const uniformDef = shaderParkUniformDefs.find((def) => def.name === key);

    uniformValues = { ...uniformValues, [key]: value };
    updateNodeData(nodeId, { uniformValues });
    glSystem.setUniformData(nodeId, key, toGLValue(uniformDef, value));
  }

  function handleUniformRevertAll() {
    const defaults = settingsSchemaToDefaultValues(uniformsSchema);

    uniformValues = defaults;
    updateNodeData(nodeId, { uniformValues: defaults });

    for (const [name, value] of Object.entries(defaults)) {
      const uniformDef = shaderParkUniformDefs.find((def) => def.name === name);

      glSystem.setUniformData(nodeId, name, toGLValue(uniformDef, value));
    }
  }
</script>

<CanvasPreviewLayout
  title={data.title ?? 'shaderpark'}
  objectType="shaderpark"
  {nodeId}
  onrun={updateShaderPark}
  bind:previewCanvas
  width={$outputWidth}
  height={$outputHeight}
  style={`width: ${$previewWidth}px; height: ${$previewHeight}px;`}
  {selected}
  {editorReady}
  hasError={lineErrors !== undefined}
  settingsSchema={uniformsSchema}
  settingsValues={uniformValues}
  onSettingsValueChange={handleUniformValueChange}
  onSettingsRevertAll={handleUniformRevertAll}
>
  {#snippet topHandle()}
    {#each Array.from({ length: videoInletCount }) as _, index (index)}
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'video', handleId: index.toString() }}
        title={`iChannel${index}`}
        total={messageInletCount + videoInletCount + visibleUniformInlets.length}
        {index}
        class={handleClass}
        {nodeId}
      />
    {/each}

    {#each visibleUniformInlets as { def, uniformIndex }, visibleIndex (uniformIndex)}
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'message', handleId: `${uniformIndex}-${def.name}-${def.type}` }}
        title={`${def.name} (${def.type})`}
        total={messageInletCount + videoInletCount + visibleUniformInlets.length}
        index={videoInletCount + visibleIndex}
        class={handleClass}
        {nodeId}
      />
    {/each}

    {#each Array.from({ length: messageInletCount }) as _, index (index)}
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'message', handleId: `control-${index}` }}
        title={`Message Inlet ${index}`}
        total={messageInletCount + videoInletCount + visibleUniformInlets.length}
        index={index + videoInletCount + visibleUniformInlets.length}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet bottomHandle()}
    {#if videoOutputEnabled}
      {#each Array.from({ length: videoOutletCount }) as _, index (index)}
        <TypedHandle
          port="outlet"
          spec={{ handleType: 'video', handleId: index.toString() }}
          title={`Video Outlet ${index}`}
          total={messageOutletCount + videoOutletCount}
          {index}
          class={handleClass}
          {nodeId}
        />
      {/each}
    {/if}

    {#each Array.from({ length: messageOutletCount }) as _, index (index)}
      <TypedHandle
        port="outlet"
        spec={{ handleType: 'message', handleId: index }}
        title={`Message Outlet ${index}`}
        total={messageOutletCount + videoOutletCount}
        index={index + videoOutletCount}
        class={handleClass}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet codeEditor()}
    <CodeEditor
      value={data.code}
      language="javascript"
      nodeType="shaderpark"
      placeholder="Write Shader Park code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={updateShaderPark}
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
        placeholder="Shader Park output will appear here."
        maxHeight="200px"
      />
    </div>
  {/snippet}
</CanvasPreviewLayout>
