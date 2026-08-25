<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import CanvasPreviewLayout from '$lib/components/CanvasPreviewLayout.svelte';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import VirtualConsole from '$lib/components/VirtualConsole.svelte';
  import {
    outputHeight,
    outputWidth,
    previewHeight,
    previewWidth
  } from '../../stores/renderer.store';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { title?: string; code: string; showConsole?: boolean };
    selected?: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const glSystem = GLSystem.getInstance();
  let previewCanvas = $state<HTMLCanvasElement>();
  let editorReady = $state(false);

  function run() {
    glSystem.upsertNode(nodeId, 'pixi', { code: data.code, _runRevision: Date.now() });
  }

  onMount(() => {
    const context = previewCanvas?.getContext('bitmaprenderer');
    if (context) glSystem.previewCanvasContexts[nodeId] = context;

    glSystem.upsertNode(nodeId, 'pixi', { code: data.code });

    setTimeout(() => {
      glSystem.setPreviewEnabled(nodeId, true);
      run();
    }, 50);
  });

  onDestroy(() => glSystem.removeNode(nodeId));
</script>

<CanvasPreviewLayout
  title={data.title ?? 'pixi'}
  objectType="pixi"
  codePlaceholder="Write PixiJS code here..."
  onCodeChange={(code) => updateNodeData(nodeId, { code })}
  {nodeId}
  onrun={run}
  bind:previewCanvas
  width={$outputWidth}
  height={$outputHeight}
  style={`width: ${$previewWidth}px; height: ${$previewHeight}px;`}
  {selected}
  {editorReady}
>
  {#snippet topHandle()}
    <TypedHandle
      port="inlet"
      spec={{ handleType: 'message', handleId: '0' }}
      title="Control messages"
      total={1}
      index={0}
      {nodeId}
    />
  {/snippet}

  {#snippet bottomHandle()}
    <TypedHandle
      port="outlet"
      spec={{ handleType: 'video', handleId: '0' }}
      title="Video output"
      total={1}
      index={0}
      {nodeId}
    />
  {/snippet}

  {#snippet codeEditor()}
    <CodeEditor
      value={data.code}
      language="javascript"
      nodeType="pixi"
      placeholder="Write PixiJS code here..."
      class="nodrag h-64 w-full resize-none"
      onrun={run}
      onchange={(code) => updateNodeData(nodeId, { code })}
      onready={() => (editorReady = true)}
      {nodeId}
    />
  {/snippet}

  {#snippet console()}
    <div class="mt-3 w-full" class:hidden={!data.showConsole}>
      <VirtualConsole {nodeId} placeholder="PixiJS output will appear here." maxHeight="200px" />
    </div>
  {/snippet}
</CanvasPreviewLayout>
