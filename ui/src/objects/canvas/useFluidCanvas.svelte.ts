import { Maximize2, Minimize2 } from '@lucide/svelte/icons';
import type { ExtraMenuItem } from '$lib/components/object-preview-menu-actions';
import { stripJavaScriptComments, stripJavaScriptStrings } from '$lib/utils/javascript-comments';
import { createDynamicCanvasDimension } from './dynamic-canvas-dimension';
import {
  resolveFluidCanvasOptions,
  type FluidCanvasOptions,
  type FluidCanvasResizeAxis
} from './fluid-canvas-options';

type CanvasSize = { width: number; height: number };

type FluidCanvasData = {
  fluidCanvasResizerVisible?: boolean;
};

type UseFluidCanvasOptions = {
  getNodeId: () => string;
  getData: () => FluidCanvasData;
  getNodeSize: () => Partial<CanvasSize>;
  getPreviewSize: () => CanvasSize;
  getCanvasSize: () => CanvasSize;
  setCanvasSize: (size: CanvasSize) => void;
  updateNode: (nodeId: string, size: Partial<CanvasSize>) => void;
  updateNodeData: (nodeId: string, data: FluidCanvasData) => void;
  commitNodeData: (key: string, oldValue: unknown, newValue: unknown) => void;
  warn: (message: string) => void;
  onResizeCallback: (callback: (size: CanvasSize) => void) => void;
  previewScaleFactor: number;
  deferInitialSize?: boolean;
};

const usesFluidCanvas = (code: string) =>
  /\bsetFluidSize\s*\(/.test(stripJavaScriptStrings(stripJavaScriptComments(code)));

const HORIZONTAL_RESIZE_POSITIONS = ['left', 'right'] as const;
const VERTICAL_RESIZE_POSITIONS = ['top', 'bottom'] as const;

export function useFluidCanvas(options: UseFluidCanvasOptions) {
  let isFluid = $state(false);
  let defaultResizerVisible = $state(false);
  let resizeAxis = $state<FluidCanvasResizeAxis>('both');
  let keepAspectRatio = $state(false);
  let resizeCallback: ((size: CanvasSize) => void) | undefined;
  let resizeFrame: number | null = null;
  let warnedAboutFixedCanvasSize = false;

  const widthDimension = createDynamicCanvasDimension(() => options.getCanvasSize().width);
  const heightDimension = createDynamicCanvasDimension(() => options.getCanvasSize().height);

  const resizeControlPositions = $derived(
    resizeAxis === 'horizontal' ? HORIZONTAL_RESIZE_POSITIONS : VERTICAL_RESIZE_POSITIONS
  );

  const resizerVisible = $derived(
    options.getData().fluidCanvasResizerVisible ?? defaultResizerVisible
  );

  function reset() {
    isFluid = false;
    defaultResizerVisible = false;
    resizeAxis = 'both';
    keepAspectRatio = false;
    resizeCallback = undefined;
    warnedAboutFixedCanvasSize = false;

    if (resizeFrame !== null) {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = null;
    }
  }

  function setFluidSize(fluidOptions: FluidCanvasOptions = {}) {
    isFluid = true;

    const resolvedOptions = resolveFluidCanvasOptions(fluidOptions);
    const data = options.getData();
    const showResizer = data.fluidCanvasResizerVisible ?? resolvedOptions.showResizer;

    defaultResizerVisible = showResizer;
    resizeAxis = resolvedOptions.resize;
    keepAspectRatio = resolvedOptions.keepAspectRatio;

    if (options.deferInitialSize) {
      if (data.fluidCanvasResizerVisible === undefined) {
        options.updateNodeData(options.getNodeId(), { fluidCanvasResizerVisible: showResizer });
      }

      return;
    }

    initializeSize(resolvedOptions.initialSize);

    if (data.fluidCanvasResizerVisible === undefined) {
      options.updateNodeData(options.getNodeId(), { fluidCanvasResizerVisible: showResizer });
    }
  }

  function initializeSize(initialSize?: CanvasSize) {
    if (!isFluid) return;

    const nodeSize = options.getNodeSize();

    if (initialSize && nodeSize.width === undefined && nodeSize.height === undefined) {
      options.updateNode(options.getNodeId(), {
        width: initialSize.width / options.previewScaleFactor,
        height: initialSize.height / options.previewScaleFactor
      });

      options.setCanvasSize(initialSize);
      return;
    }

    const previewSize = options.getPreviewSize();

    options.setCanvasSize({
      width: Math.round((nodeSize.width ?? previewSize.width) * options.previewScaleFactor),
      height: Math.round((nodeSize.height ?? previewSize.height) * options.previewScaleFactor)
    });
  }

  function setFixedCanvasSize(width: number, height: number) {
    if (isFluid) {
      if (!warnedAboutFixedCanvasSize) {
        options.warn('setCanvasSize() is ignored while fluid canvas mode is active.');
        warnedAboutFixedCanvasSize = true;
      }

      return;
    }

    options.setCanvasSize({ width, height });
  }

  function onCanvasResize(callback: (size: CanvasSize) => void) {
    resizeCallback = callback;
  }

  function handleResize(_event: unknown, size: CanvasSize) {
    if (!isFluid) return;

    options.setCanvasSize({
      width: Math.round(size.width * options.previewScaleFactor),
      height: Math.round(size.height * options.previewScaleFactor)
    });

    if (resizeFrame !== null) return;

    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;

      if (!isFluid || !resizeCallback) return;

      options.onResizeCallback(resizeCallback);
    });
  }

  function toggleResizer() {
    const oldValue = resizerVisible;
    const nextVisible = !oldValue;

    options.updateNodeData(options.getNodeId(), { fluidCanvasResizerVisible: nextVisible });
    options.commitNodeData('fluidCanvasResizerVisible', oldValue, nextVisible);
  }

  const displayExtraMenuItems = $derived.by<ExtraMenuItem[] | undefined>(() => {
    if (!isFluid) return undefined;

    return [
      {
        label: resizerVisible ? 'Disable resizing' : 'Enable resizing',
        icon: resizerVisible ? Minimize2 : Maximize2,
        onclick: toggleResizer
      }
    ];
  });

  return {
    get isFluid() {
      return isFluid;
    },
    get resizerVisible() {
      return resizerVisible;
    },
    get resizeAxis() {
      return resizeAxis;
    },
    get keepAspectRatio() {
      return keepAspectRatio;
    },
    get resizeControlPositions() {
      return resizeControlPositions;
    },
    get displayExtraMenuItems() {
      return displayExtraMenuItems;
    },
    usesFluidSize: usesFluidCanvas,
    getExecutionDimensions: (code: string) =>
      usesFluidCanvas(code)
        ? { width: widthDimension, height: heightDimension }
        : options.getCanvasSize(),
    reset,
    setFluidSize,
    initializeSize,
    setFixedCanvasSize,
    onCanvasResize,
    handleResize
  };
}
