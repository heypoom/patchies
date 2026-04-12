<script lang="ts">
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { match } from 'ts-pattern';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { messages } from '$lib/objects/schemas/common';
  import { GLSystem, type UserUniformValue } from '$lib/canvas/GLSystem';
  import { outputSize, previewWidth, previewHeight } from '../../../stores/renderer.store';
  import { toGLValue } from '$workers/rendering/glUniformUtils';
  import { CanvasMouseHandler } from '$lib/canvas/CanvasMouseHandler';
  import {
    shaderCodeToUniformDefs,
    uniformDefsToSettingsSchema,
    parseShaderName,
    detectFboFormat,
    detectResolution
  } from '$lib/canvas/shader-code-to-uniform-def';
  import { removeExcessVideoOutletEdges } from './outlet-edges';
  import type { GLUniformDef } from '../../../types/uniform-config';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import type { ConsoleOutputEvent, PrimaryButton } from '$lib/eventbus/events';
  import type { FBOFormat, FBOResolution } from '$lib/rendering/types';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      title?: string;
      code: string;
      glUniformDefs: GLUniformDef[];
      uniformValues?: Record<string, number | boolean | string>;
      executeCode?: number;
      showConsole?: boolean;
      mrtCount?: number;
      fboFormat?: FBOFormat;
      resolution?: FBOResolution;
      _runRevision?: number;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  let eventBus = PatchiesEventBus.getInstance();
  let glSystem = GLSystem.getInstance();
  let mouseHandler: CanvasMouseHandler | null = null;

  let previewCanvas = $state<HTMLCanvasElement | undefined>();
  let previewBitmapContext: ImageBitmapRenderingContext;
  let messageContext: MessageContext;

  let isPaused = $state(false);
  let editorReady = $state(false);
  let uniformValues = $state<Record<string, number | boolean | string>>(data.uniformValues ?? {});
  let consoleRef = $state<{ clearConsole: () => void } | null>(null);
  let shaderName = $state<string | undefined>(parseShaderName(data.code || ''));
  let lineErrors: Record<number, string[]> | undefined = $state(undefined);

  const code = $derived(data.code || '');
  const uniformsSchema = $derived(uniformDefsToSettingsSchema(data.glUniformDefs ?? []));

  const errorLines = $derived(
    lineErrors
      ? Object.keys(lineErrors)
          .map(Number)
          .sort((a, b) => a - b)
      : undefined
  );

  let previousExecuteCode = $state<number | undefined>(undefined);

  // Detect if shader uses iMouse uniform (ignore comments)
  const usesMouseUniform = $derived.by(() => {
    // Remove single-line comments
    const codeWithoutComments = code.replace(/\/\/.*$/gm, '');

    return codeWithoutComments.includes('iMouse');
  });

  // Watch for executeCode timestamp changes and re-run when it changes
  $effect(() => {
    if (data.executeCode && data.executeCode !== previousExecuteCode) {
      previousExecuteCode = data.executeCode;

      updateShader();
    }
  });

  const handleMessage: MessageCallbackFn = (message, meta) => {
    try {
      // 'run' from any inlet re-runs the shader
      if (message && typeof message === 'object' && 'type' in message && message.type === 'run') {
        updateShader();
        return;
      }

      if (meta.inletKey?.startsWith('message-in-')) {
        const [, uniformName] = meta.inletKey.split('-').slice(2);

        glSystem.setUniformData(nodeId, uniformName, message as UserUniformValue);

        if (typeof message === 'number' || typeof message === 'boolean') {
          uniformValues = { ...uniformValues, [uniformName]: message };
          updateNodeData(nodeId, { uniformValues });
        }

        return;
      }

      match(message)
        .with(messages.setCode, ({ value }) => {
          updateNodeData(nodeId, { code: value });
        })
        .with(messages.run, () => {
          updateShader();
        });
    } catch (error) {
      console.error('GLSLCanvasNode handleMessage error:', error);
    }
  };

  function removeInvalidEdges(uniformDefs: GLUniformDef[], mrtCount: number) {
    const textureUniforms = new Set(
      uniformDefs.filter((def) => def.type === 'sampler2D').map((def) => def.name)
    );

    // Remove inlet edges whose uniform no longer exists
    const invalidInlets = getEdges().filter((edge) => {
      if (edge.target !== nodeId || !edge.targetHandle?.startsWith('video-in-')) return false;
      // Parse the uniform name: video-in-0-uniformName-sampler2D
      const handleParts = edge.targetHandle.split('-');
      return handleParts.length > 3 && !textureUniforms.has(handleParts[3]);
    });

    if (invalidInlets.length > 0) {
      console.log('removing invalid edges:', invalidInlets);
      deleteElements({ edges: invalidInlets });
    }

    // Remove outlet edges beyond the new mrtCount
    removeExcessVideoOutletEdges(nodeId, mrtCount, getEdges, deleteElements);
  }

  function detectMrtCount(code: string): number {
    // Strip comments so commented-out layout declarations don't affect the count
    const stripped = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    const locationRegex = /layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*out/g;

    let max = -1,
      match;

    while ((match = locationRegex.exec(stripped)) !== null) {
      max = Math.max(max, parseInt(match[1], 10));
    }

    return max >= 0 ? max + 1 : 1;
  }

  function detectPrimaryButton(code: string): PrimaryButton {
    const withoutBlocks = code.replace(/\/\*[\s\S]*?\*\//g, '');
    const match = withoutBlocks.match(/^\s*\/\/\s*@primaryButton\s+(code|settings|run)\s*$/m);

    return (match?.[1] as PrimaryButton) ?? 'code';
  }

  function updateShader() {
    // Clear console on re-run
    consoleRef?.clearConsole();

    // Clear error line highlighting on re-run
    lineErrors = undefined;

    // Update title from @title directive
    shaderName = parseShaderName(data.code);

    // Construct uniform definitions from the shader code.
    const nextUniformDefs = shaderCodeToUniformDefs(data.code);

    // Prune saved uniform values for uniforms that no longer exist,
    // and seed missing values from @param defaults
    const pruned: Record<string, number | boolean | string> = {};

    for (const def of nextUniformDefs) {
      if (def.name in uniformValues) {
        pruned[def.name] = uniformValues[def.name];
      } else if (def.widget === 'color') {
        pruned[def.name] = '#ffffff';
      } else if (def.default != null) {
        pruned[def.name] = def.default;
      }
    }

    uniformValues = pruned;

    const nextPrimaryButton = detectPrimaryButton(data.code);

    const nextData = {
      ...data,
      glUniformDefs: nextUniformDefs,
      uniformValues: pruned,
      mrtCount: detectMrtCount(data.code),
      fboFormat: detectFboFormat(data.code),
      resolution: detectResolution(data.code),
      primaryButton: nextPrimaryButton,
      _runRevision: Date.now()
    };

    // Remove edges with invalid uniform names or out-of-range outlet indices before updating
    removeInvalidEdges(nextData.glUniformDefs, nextData.mrtCount);

    updateNodeData(nodeId, nextData);
    glSystem.upsertNode(nodeId, 'glsl', nextData, { force: true }); // force rebuild even if code hasn't changed

    // Notify the layout (and any other listeners) that the primary button changed
    eventBus.dispatch({
      type: 'nodePrimaryButtonUpdate',
      nodeId,
      primaryButton: nextPrimaryButton
    });

    // Push uniform values (including @param defaults) to the GL system
    for (const [name, value] of Object.entries(pruned)) {
      const uniformDef = nextUniformDefs.find((d) => d.name === name);

      glSystem.setUniformData(nodeId, name, toGLValue(uniformDef, value));
    }

    // inform XYFlow that the handle has changed
    updateNodeInternals();
  }

  function handleUniformValueChange(key: string, value: unknown) {
    uniformValues = { ...uniformValues, [key]: value as number | boolean | string };

    const uniformDef = data.glUniformDefs.find((d) => d.name === key);

    glSystem.setUniformData(nodeId, key, toGLValue(uniformDef, value));
    updateNodeData(nodeId, { uniformValues });
  }

  function togglePause() {
    isPaused = !isPaused;
    glSystem.toggleNodePause(nodeId);
  }

  // Attach mouse event listeners when canvas is available and iMouse is used
  $effect(() => {
    if (!previewCanvas || !usesMouseUniform) return;

    const [outputWidth, outputHeight] = $outputSize;

    mouseHandler = new CanvasMouseHandler({
      type: 'shadertoy',
      nodeId,
      canvas: previewCanvas,
      outputWidth,
      outputHeight
    });

    mouseHandler.attach();

    return () => {
      mouseHandler?.detach();
    };
  });

  // Listen for shader compilation errors and extract line numbers
  $effect(() => {
    const handleConsoleOutput = (event: ConsoleOutputEvent) => {
      if (event.nodeId !== nodeId || event.messageType !== 'error') return;

      lineErrors = event.lineErrors;
    };

    eventBus.addEventListener('consoleOutput', handleConsoleOutput);

    return () => {
      eventBus.removeEventListener('consoleOutput', handleConsoleOutput);
    };
  });

  onMount(() => {
    glSystem = GLSystem.getInstance();

    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    if (previewCanvas) {
      previewBitmapContext = previewCanvas.getContext('bitmaprenderer')!;
      glSystem.previewCanvasContexts[nodeId] = previewBitmapContext;
    }

    updateShader();

    // Restore persisted uniform values to the GL system
    for (const [name, value] of Object.entries(uniformValues)) {
      const uniformDef = data.glUniformDefs?.find((d) => d.name === name);
      if (uniformDef === undefined) continue;

      glSystem.setUniformData(nodeId, name, toGLValue(uniformDef, value));
    }

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
    }, 10);
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
    glSystem.removeNode(nodeId);
    glSystem.removePreviewContext(nodeId, previewBitmapContext);
    mouseHandler?.detach();
  });
</script>

<CanvasPreviewLayout
  title={shaderName ?? data.title ?? 'glsl'}
  objectType="glsl"
  {nodeId}
  onrun={updateShader}
  onPlaybackToggle={togglePause}
  paused={isPaused}
  showPauseButton={true}
  nodrag={usesMouseUniform}
  bind:previewCanvas
  width={$previewWidth}
  height={$previewHeight}
  {selected}
  {editorReady}
  hasError={errorLines !== undefined && errorLines.length > 0}
  settingsSchema={uniformsSchema}
  settingsValues={uniformValues}
  onSettingsValueChange={handleUniformValueChange}
>
  {#snippet topHandle()}
    {#each data.glUniformDefs as def, defIndex (defIndex)}
      <StandardHandle
        port="inlet"
        type={def.type === 'sampler2D' ? 'video' : 'message'}
        id={`${defIndex}-${def.name}-${def.type}`}
        title={`${def.name} (${def.type})`}
        total={data.glUniformDefs.length}
        index={defIndex}
        {nodeId}
      />
    {/each}
  {/snippet}

  {#snippet bottomHandle()}
    {#if (data.mrtCount ?? 1) > 1}
      {#each Array(data.mrtCount ?? 1) as _, index (index)}
        <StandardHandle
          port="outlet"
          type="video"
          id={String(index)}
          title={`Video output ${index}`}
          total={data.mrtCount ?? 1}
          {index}
          {nodeId}
        />
      {/each}
    {:else}
      <StandardHandle
        port="outlet"
        type="video"
        id="out"
        title="Video output"
        total={1}
        index={0}
        {nodeId}
      />
    {/if}
  {/snippet}

  {#snippet codeEditor()}
    <CodeEditor
      value={code}
      onchange={(newCode) => {
        updateNodeData(nodeId, { code: newCode });
      }}
      language="glsl"
      placeholder="Write your GLSL fragment shader here..."
      class="nodrag h-64 w-full resize-none"
      onrun={updateShader}
      onready={() => (editorReady = true)}
      {lineErrors}
      {nodeId}
    />
  {/snippet}

  {#snippet console()}
    <!-- Always render VirtualConsole so it receives events even when hidden -->
    <!-- We already have in-gutter errors, so we don't auto-show the console on new errors -->
    <div class="mt-3 w-full" class:hidden={!data.showConsole}>
      <VirtualConsole
        bind:this={consoleRef}
        {nodeId}
        placeholder="Shader compilation errors will appear here."
        maxHeight="200px"
        shouldAutoShowConsoleOnError={false}
      />
    </div>
  {/snippet}
</CanvasPreviewLayout>
