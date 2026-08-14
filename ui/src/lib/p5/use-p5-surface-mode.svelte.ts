import type { Node } from '@xyflow/svelte';
import { Expand, Shrink } from '@lucide/svelte/icons';
import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { SurfaceOverlay } from '$lib/canvas/SurfaceOverlay';
import { SurfaceMouseForwarder } from '$lib/canvas/SurfaceMouseForwarder';
import type { SurfaceMouseForwardingRules } from '$lib/canvas/surfaceMouseForwarding';
import type { GLSystem } from '$lib/canvas/GLSystem';
import type { ExtraMenuItem } from '$lib/components/object-preview-menu-actions';
import type { P5Manager } from '$lib/p5/P5Manager';

type P5SurfaceModeOptions = {
  nodeId: string;
  getNodes: () => Node[];
  getGlSystem: () => GLSystem;
  getP5Manager: () => P5Manager | null;
  getPreviewContainer: () => HTMLElement | null;
  isSurfaceCanvasEnabled: () => boolean | undefined;
  measureWidth: (timeout: number) => void;
  updateSketch: () => void;
};

export function createP5SurfaceMode(options: P5SurfaceModeOptions) {
  let isExpanded = $state(false);
  let isSurfaceCanvasExpanded = false;
  const mouseForwarder = new SurfaceMouseForwarder(options.getNodes);

  const menuItems: ExtraMenuItem[] = $derived([
    {
      label: isExpanded ? 'Exit surface' : 'Expand',
      icon: isExpanded ? Shrink : Expand,
      onclick: () => (isExpanded ? exit() : enter()),
      variant: isExpanded ? 'danger' : 'default'
    }
  ]);

  function getCanvasSize() {
    const [width, height] = options.getGlSystem().outputSize;

    return { width, height };
  }

  function styleCanvas(canvas: HTMLCanvasElement, dimensions = getCanvasSize()) {
    applyCanvasStyle(canvas, dimensions);
  }

  function applyCanvasStyle(
    canvas: HTMLCanvasElement,
    { width, height }: { width: number; height: number }
  ) {
    if (isExpanded) {
      const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
      const displayWidth = width * scale;
      const displayHeight = height * scale;

      Object.assign(canvas.style, {
        display: 'block',
        position: 'absolute',
        left: `${(window.innerWidth - displayWidth) / 2}px`,
        top: `${(window.innerHeight - displayHeight) / 2}px`,
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        margin: '0',
        objectFit: 'fill',
        pointerEvents: 'auto'
      });
    } else {
      Object.assign(canvas.style, {
        display: 'block',
        position: 'static',
        left: '',
        top: '',
        width: `${width / PREVIEW_SCALE_FACTOR}px`,
        height: `${height / PREVIEW_SCALE_FACTOR}px`,
        margin: '0',
        objectFit: 'fill',
        pointerEvents: 'auto'
      });
    }

    options.measureWidth(50);
  }

  function requestMirrorFrame(canvas: HTMLCanvasElement) {
    if (!isExpanded || !isSurfaceCanvasExpanded) return;

    options.getGlSystem().ipcSystem.requestSurfaceOverlayFrame(canvas);
  }

  function hideExitButton() {
    SurfaceOverlay.getInstance().hideBadge();
  }

  function setMouseForwarding(rules?: SurfaceMouseForwardingRules) {
    mouseForwarder.setForwardingRules(rules);

    if (isExpanded && isSurfaceCanvasExpanded) {
      mouseForwarder.forceHydraScope('local');
      mouseForwarder.forceHydraScope('global');
    }
  }

  function forwardPointer(x: number, y: number, buttons: number, type: string) {
    if (!isExpanded || !isSurfaceCanvasExpanded) return;

    mouseForwarder.forward(x, y, buttons, type);
  }

  function forwardWheel(event: {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    deltaMode: number;
  }) {
    if (!isExpanded || !isSurfaceCanvasExpanded) return;

    mouseForwarder.forwardWheel(event);
  }

  function enter() {
    const p5Manager = options.getP5Manager();

    if (isExpanded || !p5Manager) return;

    isExpanded = true;
    isSurfaceCanvasExpanded = Boolean(options.isSurfaceCanvasEnabled());

    const glSystem = options.getGlSystem();
    const overlay = SurfaceOverlay.getInstance();
    const nodes = options.getNodes().map((node) => ({ id: node.id, type: node.type }));

    const presentation =
      isSurfaceCanvasExpanded && glSystem.ipcSystem.hasConnectedOutputWindow()
        ? 'secondary'
        : 'main';

    overlay.activate(options.nodeId, nodes, () => exit(), {
      presentation,
      content: 'custom'
    });

    overlay.customHost.style.background = isSurfaceCanvasExpanded ? 'transparent' : 'black';

    if (isSurfaceCanvasExpanded) {
      glSystem.ipcSystem.sendSurfaceOverlayState({ active: true });
    }

    p5Manager.setContainer(overlay.customHost);

    if (isSurfaceCanvasExpanded) {
      mouseForwarder.refreshForwardingTargets();
      mouseForwarder.forceHydraScope('global');
    }

    options.updateSketch();
  }

  function deactivateMouse() {
    SurfaceOverlay.getInstance().deactivate(options.nodeId);
    SurfaceOverlay.getInstance().customHost.style.background = '';

    if (isSurfaceCanvasExpanded) {
      options.getGlSystem().ipcSystem.sendSurfaceOverlayState(null);
      mouseForwarder.forceHydraScope('local');
    }
  }

  function exit() {
    if (!isExpanded) return;

    isExpanded = false;
    deactivateMouse();
    isSurfaceCanvasExpanded = false;

    options.getP5Manager()?.setContainer(options.getPreviewContainer());

    options.updateSketch();
  }

  function cleanup() {
    const wasExpanded = isExpanded;
    isExpanded = false;

    if (wasExpanded) {
      deactivateMouse();
    }

    mouseForwarder.dispose();
  }

  return {
    get isExpanded() {
      return isExpanded;
    },
    get isSurfaceCanvasExpanded() {
      return isExpanded && isSurfaceCanvasExpanded;
    },
    get menuItems() {
      return menuItems;
    },
    getCanvasSize,
    styleCanvas,
    requestMirrorFrame,
    hideExitButton,
    setMouseForwarding,
    forwardPointer,
    forwardWheel,
    enter,
    exit,
    cleanup
  };
}
