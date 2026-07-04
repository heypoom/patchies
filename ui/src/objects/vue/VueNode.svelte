<script lang="ts">
  import { useUpdateNodeInternals } from '@xyflow/svelte';
  import DomRuntimeNode from '$objects/dom/DomRuntimeNode.svelte';
  import type { CreateDomRuntimeRoot } from '$objects/dom/DomRuntimeNode.svelte';
  import { VUE_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
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
  const customConsole = createCustomConsole(id);

  let Vue: typeof import('vue') | null = null;
  let currentApp: ReturnType<(typeof import('vue'))['createApp']> | null = null;
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

  const htmlCanvasAdapter = createHtmlCanvasRuntimeAdapter({
    nodeId: id,
    objectName: 'vue',
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
  });

  let runCode = () => {};

  function unmountVueApp() {
    if (currentApp) {
      try {
        currentApp.unmount();
      } catch {
        // Ignore unmount errors
      }

      currentApp = null;
    }
  }

  function cleanupRuntime() {
    unmountVueApp();
    htmlCanvasAdapter.cleanup();
  }

  const createRuntimeRoot: CreateDomRuntimeRoot = async ({ containerRoot, customConsole }) => {
    unmountVueApp();

    const vueRoot = document.createElement('div');

    vueRoot.className =
      htmlCanvasState.enabled || htmlLayerState.enabled || htmlGlslLayerState.enabled
        ? htmlCanvasAdapter.getRootClass()
        : 'h-full w-full';

    containerRoot.appendChild(vueRoot);

    if (!Vue) {
      // @ts-expect-error - vue.esm-bundler.js has no type declarations but works at runtime
      Vue = await import('vue/dist/vue.esm-bundler.js');
      customConsole.log('Vue loaded!');
    }

    return {
      root: vueRoot,
      extraContext: {
        Vue,
        createApp: Vue!.createApp,
        ref: Vue!.ref,
        reactive: Vue!.reactive,
        computed: Vue!.computed,
        watch: Vue!.watch,
        watchEffect: Vue!.watchEffect,
        onMounted: Vue!.onMounted,
        onUnmounted: Vue!.onUnmounted,
        nextTick: Vue!.nextTick,
        h: Vue!.h,
        defineComponent: Vue!.defineComponent
      },
      handleResult: (result: unknown) => {
        if (result && typeof result === 'object' && 'unmount' in result) {
          currentApp = result as ReturnType<(typeof import('vue'))['createApp']>;
        }
      }
    };
  };

  $effect(() => {
    htmlCanvasAdapter.syncVideoOutput();
  });
</script>

<DomRuntimeNode
  {id}
  {data}
  {selected}
  objectType="vue"
  titleFallback="vue"
  codePlaceholder="Write your Vue code here..."
  consolePlaceholder="Vue output will appear here."
  errorOffset={VUE_WRAPPER_OFFSET}
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
