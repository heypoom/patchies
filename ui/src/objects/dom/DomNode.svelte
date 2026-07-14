<script lang="ts">
  import { useUpdateNodeInternals } from '@xyflow/svelte';
  import DomRuntimeNode from '$objects/dom/DomRuntimeNode.svelte';
  import type { CreateDomRuntimeRoot } from '$objects/dom/DomRuntimeNode.svelte';
  import { DOM_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
  import type { SettingsSchema } from '$lib/settings';
  import type { HtmlCanvasNodeOutputState } from '$lib/html-in-canvas/html-canvas-node-output';
  import type { HtmlGlslLayerNodeOutputState } from '$lib/html-in-canvas/html-glsl-layer-node-output';
  import type { HtmlLayerNodeOutputState } from '$lib/html-in-canvas/html-layer-node-output';
  import { createCustomConsole } from '$lib/utils/createCustomConsole';
  import { outputHeight, outputWidth } from '../../stores/renderer.store';
  import { createHtmlCanvasRuntimeAdapter } from '$objects/dom/html-canvas-runtime-adapter';

  let {
    id,
    data,
    selected
  }: {
    id: string;
    data: {
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
      hideBorder?: boolean;
    };
    selected?: boolean;
  } = $props();

  const updateNodeInternals = useUpdateNodeInternals();
  const customConsole = $derived.by(() => createCustomConsole(id));

  let rootElement = $state<HTMLElement | undefined>();
  let htmlCanvasElement = $state<HTMLCanvasElement | undefined>();
  let htmlLayerState = $state<HtmlLayerNodeOutputState>({ enabled: false });
  let htmlGlslLayerState = $state<HtmlGlslLayerNodeOutputState>({ enabled: false });

  let htmlCanvasState = $state<HtmlCanvasNodeOutputState>({
    enabled: false,
    sizeMode: 'output',
    width: 1,
    height: 1
  });

  const htmlCanvasAdapter = $derived.by(() =>
    createHtmlCanvasRuntimeAdapter({
      nodeId: id,
      objectName: 'dom',
      getRootElement: () => rootElement,
      getCanvasElement: () => htmlCanvasElement,
      getExplicitSize: () => ({ width: data.width, height: data.height }),
      getOutputSize: () => ({ width: $outputWidth, height: $outputHeight }),
      warn: (message) => customConsole.warn(message),
      updateNodeInternals: () => updateNodeInternals(id),
      scheduleRun: () => setTimeout(() => runCode()),
      onHtmlCanvasStateChange: (state) => (htmlCanvasState = state),
      onHtmlLayerStateChange: (state) => (htmlLayerState = state),
      onHtmlGlslLayerStateChange: (state) => (htmlGlslLayerState = state)
    })
  );

  const createRuntimeRoot: CreateDomRuntimeRoot = ({ containerRoot }) => ({
    root: containerRoot
  });

  let runCode = () => {};

  function cleanupRuntime() {
    htmlCanvasAdapter.cleanup();
  }

  $effect(() => {
    htmlCanvasAdapter.syncVideoOutput();
  });
</script>

<DomRuntimeNode
  {id}
  {data}
  {selected}
  objectType="dom"
  titleFallback="dom"
  codePlaceholder="Write your DOM code here..."
  consolePlaceholder="DOM output will appear here."
  errorOffset={DOM_WRAPPER_OFFSET}
  {createRuntimeRoot}
  {cleanupRuntime}
  beforeRun={htmlCanvasAdapter.beforeRun}
  afterRun={htmlCanvasAdapter.afterRun}
  extraContext={() => htmlCanvasAdapter.extraContext}
  bind:rootElement
  bind:htmlCanvasElement
  htmlCanvasRootActive={htmlCanvasState.enabled ||
    htmlLayerState.enabled ||
    htmlGlslLayerState.enabled}
  htmlCanvasEnabled={htmlCanvasState.enabled}
  htmlCanvasContextMode={htmlCanvasAdapter.getCanvasContextMode()}
  htmlRootClass={htmlCanvasAdapter.getRootClass()}
  onRunReady={(handler) => (runCode = handler)}
/>
