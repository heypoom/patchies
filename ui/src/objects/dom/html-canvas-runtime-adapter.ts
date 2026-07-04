import { GLSystem } from '$lib/canvas/GLSystem';
import { HtmlCanvasNodeOutput } from '$lib/html-in-canvas/html-canvas-node-output';
import type { HtmlCanvasNodeOutputState } from '$lib/html-in-canvas/html-canvas-node-output';
import {
  guardHtmlCanvasMode,
  type HtmlCanvasMode
} from '$lib/html-in-canvas/html-canvas-mode-guard';
import { HtmlGlslLayerNodeOutput } from '$lib/html-in-canvas/html-glsl-layer-node-output';
import type {
  HtmlGlslLayerNodeOutputState,
  HtmlGlslLayerOptions
} from '$lib/html-in-canvas/html-glsl-layer-node-output';
import { HtmlLayerNodeOutput } from '$lib/html-in-canvas/html-layer-node-output';
import type {
  HtmlLayerNodeOutputState,
  HtmlLayerOptions
} from '$lib/html-in-canvas/html-layer-node-output';

type ExplicitSize = {
  width?: number;
  height?: number;
};

type OutputSize = {
  width: number;
  height: number;
};

type HtmlCanvasRuntimeAdapterOptions = {
  nodeId: string;
  objectName: 'dom' | 'vue';
  getRootElement: () => HTMLElement | undefined;
  getCanvasElement: () => HTMLCanvasElement | undefined;
  getExplicitSize: () => ExplicitSize;
  getOutputSize: () => OutputSize;
  warn: (message: string) => void;
  updateNodeInternals: () => void;
  scheduleRun: () => void;
  onHtmlCanvasStateChange: (state: HtmlCanvasNodeOutputState) => void;
  onHtmlLayerStateChange: (state: HtmlLayerNodeOutputState) => void;
  onHtmlGlslLayerStateChange: (state: HtmlGlslLayerNodeOutputState) => void;
};

export function createHtmlCanvasRuntimeAdapter(options: HtmlCanvasRuntimeAdapterOptions) {
  const htmlCanvasOutput = new HtmlCanvasNodeOutput({
    nodeId: options.nodeId,
    objectName: options.objectName,
    getRootElement: options.getRootElement,
    getCanvasElement: options.getCanvasElement,
    getExplicitSize: options.getExplicitSize,
    getOutputSize: options.getOutputSize,
    warn: options.warn,
    updateNodeInternals: options.updateNodeInternals,
    scheduleRun: options.scheduleRun,
    onStateChange: options.onHtmlCanvasStateChange,
    videoGraph: GLSystem.getInstance()
  });

  const htmlLayerOutput = new HtmlLayerNodeOutput({
    getRootElement: options.getRootElement,
    getCanvasElement: options.getCanvasElement,
    getExplicitSize: options.getExplicitSize,
    warn: options.warn,
    scheduleRun: options.scheduleRun,
    onStateChange: options.onHtmlLayerStateChange
  });

  const htmlGlslLayerOutput = new HtmlGlslLayerNodeOutput({
    getRootElement: options.getRootElement,
    getCanvasElement: options.getCanvasElement,
    getExplicitSize: options.getExplicitSize,
    warn: options.warn,
    scheduleRun: options.scheduleRun,
    onStateChange: options.onHtmlGlslLayerStateChange,
    getElementTransform: () => new DOMMatrix()
  });

  let htmlCanvasModeThisRun: HtmlCanvasMode | null = null;
  let htmlLayerCalledThisRun = false;
  let htmlGlslLayerCalledThisRun = false;

  function registerHtmlCanvasMode(mode: HtmlCanvasMode) {
    const result = guardHtmlCanvasMode({
      currentMode: htmlCanvasModeThisRun,
      requestedMode: mode,
      videoOutputEnabled: htmlCanvasOutput.state.enabled
    });

    if (result.ok) {
      htmlCanvasModeThisRun = result.mode;

      return true;
    }

    options.warn(result.message);

    return false;
  }

  function setHtmlCanvasVideoOutput(enableOptions?: Parameters<typeof htmlCanvasOutput.enable>[0]) {
    if (enableOptions !== false && !registerHtmlCanvasMode('videoOutput')) {
      return false;
    }

    return htmlCanvasOutput.enable(enableOptions);
  }

  function setHtmlCanvasLayer(layerOptions: HtmlLayerOptions) {
    if (
      layerOptions !== false &&
      layerOptions !== undefined &&
      !registerHtmlCanvasMode('canvasLayer')
    ) {
      return false;
    }

    htmlLayerCalledThisRun = true;

    const enabled = htmlLayerOutput.enable(layerOptions);

    if (enabled) {
      htmlGlslLayerOutput.stop();
    }

    return enabled;
  }

  function setHtmlGlslLayer(glslLayerOptions: HtmlGlslLayerOptions) {
    if (
      glslLayerOptions !== false &&
      glslLayerOptions !== undefined &&
      !registerHtmlCanvasMode('glslLayer')
    ) {
      return false;
    }

    htmlGlslLayerCalledThisRun = true;

    const enabled = htmlGlslLayerOutput.enable(glslLayerOptions);

    if (enabled) {
      htmlLayerOutput.stop();
    }

    return enabled;
  }

  function beforeRun() {
    htmlCanvasModeThisRun = null;
    htmlLayerCalledThisRun = false;
    htmlGlslLayerCalledThisRun = false;

    if (htmlCanvasOutput.state.enabled && !htmlCanvasOutput.setup()) {
      return false;
    }

    return true;
  }

  function afterRun() {
    if (htmlCanvasOutput.state.enabled) {
      htmlCanvasOutput.updateSize();
      htmlCanvasOutput.requestPaint();
    }

    if (htmlLayerCalledThisRun) {
      htmlLayerOutput.setup();
    } else {
      htmlLayerOutput.stop();
    }

    if (htmlGlslLayerCalledThisRun) {
      htmlGlslLayerOutput.setup();
    } else {
      htmlGlslLayerOutput.stop();
    }
  }

  function getRootClass() {
    if (htmlCanvasOutput.state.enabled) {
      return htmlCanvasOutput.getRootClass();
    }

    const explicitSize = options.getExplicitSize();

    return explicitSize.width !== undefined && explicitSize.height !== undefined
      ? 'h-full w-full'
      : 'inline-block';
  }

  function syncVideoOutput() {
    if (!htmlCanvasOutput.state.enabled || !options.getCanvasElement()) return;

    htmlCanvasOutput.updateSize();
    htmlCanvasOutput.requestPaint();
  }

  function cleanup() {
    htmlCanvasOutput.destroy();
    htmlLayerOutput.stop();
    htmlGlslLayerOutput.stop();
  }

  return {
    beforeRun,
    afterRun,
    cleanup,
    syncVideoOutput,
    getRootClass,
    getCanvasContextMode: () => (htmlGlslLayerOutput.state.enabled ? 'webgl' : '2d'),
    extraContext: {
      htmlCanvas: {
        videoOutput: setHtmlCanvasVideoOutput,
        canvasLayer: setHtmlCanvasLayer,
        glslLayer: setHtmlGlslLayer
      }
    }
  };
}
