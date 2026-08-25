import type { Application, Container, WebGLRenderer } from 'pixi.js';

import { getPixiExtensionVersion, loadPixiDomExtensions } from '$objects/pixi/extensions';

type PixiRuntime = typeof import('pixi.js');

let pixiRuntimePromise: Promise<PixiRuntime> | null = null;

const loadPixiRuntime = () => {
  pixiRuntimePromise ??= import('pixi.js');

  return pixiRuntimePromise;
};

type PixiHandler =
  | '_onPointerDown'
  | '_onPointerMove'
  | '_onPointerUp'
  | '_onPointerOverOut'
  | 'onWheel';

type PixiHandlerFn = (nativeEvent: PointerEvent | WheelEvent) => void;

interface PixiDomEntry {
  canvas: HTMLCanvasElement;
  draw: (time: number) => void;
  height: number;
  handlers?: PixiDomEventHandlers;
  onRendered: () => void;
  paused: boolean;
  stage: Container;
  width: number;
}

interface PixiDomEventHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerOverOut: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onWheel: (event: WheelEvent) => void;
}

type PixiDomEvents = WebGLRenderer['events'] & {
  domElement: HTMLCanvasElement | null;
  renderer: WebGLRenderer;
};

class PixiDomManager {
  private app: Application | null = null;
  private applicationInit: Promise<Application> | null = null;
  private entries = new Map<string, PixiDomEntry>();
  private activePointers = new Map<number, PixiDomEntry>();
  private extensionLoadQueue = Promise.resolve();
  private pixiRuntime: PixiRuntime | null = null;
  private rendererProxy: WebGLRenderer | null = null;
  private extensionVersion = 0;
  private windowEventsBound = false;
  private destroyed = false;

  async register(
    nodeId: string,
    canvas: HTMLCanvasElement,
    size: { width: number; height: number },
    draw: (time: number) => void,
    onRendered: () => void
  ) {
    const PIXI = await this.getPixiRuntime();

    await this.getApplication();

    const entry: PixiDomEntry = {
      canvas,
      draw,
      height: size.height,
      onRendered,
      paused: false,
      stage: new PIXI.Container(),
      width: size.width
    };

    this.entries.set(nodeId, entry);
    this.resizeEntry(entry, size);
    this.bindEvents(entry);

    return entry;
  }

  unregister(nodeId: string) {
    const entry = this.entries.get(nodeId);
    if (!entry) return;

    this.unbindEvents(entry);

    this.activePointers.forEach((activeEntry, pointerId) => {
      if (activeEntry === entry) this.activePointers.delete(pointerId);
    });

    entry.stage.destroy({ children: true });
    this.entries.delete(nodeId);
  }

  resize(nodeId: string, size: { width: number; height: number }) {
    const entry = this.entries.get(nodeId);
    if (!entry) return;

    this.resizeEntry(entry, size);
  }

  replaceStage(nodeId: string, nextStage: Container) {
    const entry = this.entries.get(nodeId);
    if (!entry) return false;

    const previousStage = entry.stage;

    entry.stage = nextStage;
    previousStage.destroy({ children: true });

    return true;
  }

  setPaused(nodeId: string, paused: boolean) {
    const entry = this.entries.get(nodeId);
    if (!entry) return;

    entry.paused = paused;
  }

  async getApplication() {
    if (this.app) return this.app;
    if (this.applicationInit) return this.applicationInit;

    this.applicationInit = this.initializeApplication();

    return this.applicationInit;
  }

  async getPixiRuntime() {
    this.pixiRuntime ??= await loadPixiRuntime();

    return this.pixiRuntime;
  }

  loadExtensions(...extensions: string[]) {
    const request = this.extensionLoadQueue.then(() =>
      this.loadExtensionsAndRecreate(...extensions)
    );

    this.extensionLoadQueue = request.catch(() => {});

    return request;
  }

  private async loadExtensionsAndRecreate(...extensions: string[]) {
    await loadPixiDomExtensions(...extensions);
    await this.getApplication();

    if (this.extensionVersion === getPixiExtensionVersion()) return;

    await this.recreateApplication();
  }

  getRenderer() {
    this.rendererProxy ??= new Proxy({} as WebGLRenderer, {
      get: (_target, property) => {
        const renderer = this.app?.renderer as WebGLRenderer | undefined;
        if (!renderer) return undefined;

        const value = Reflect.get(renderer, property, renderer);

        return typeof value === 'function' ? value.bind(renderer) : value;
      },
      set: (_target, property, value) => {
        const renderer = this.app?.renderer as WebGLRenderer | undefined;
        if (!renderer) return false;

        return Reflect.set(renderer, property, value, renderer);
      }
    });

    return this.rendererProxy;
  }

  private async initializeApplication() {
    const PIXI = await this.getPixiRuntime();
    const nextApp = new PIXI.Application();

    try {
      await nextApp.init({
        autoStart: false,
        backgroundAlpha: 0,
        multiView: true,
        antialias: true
      });

      if (this.destroyed) {
        nextApp.destroy({ removeView: false }, { children: true });

        throw new Error('Pixi DOM manager was destroyed during initialization.');
      }

      nextApp.ticker.remove(nextApp.render, nextApp);
      nextApp.ticker.add((ticker) => this.render(ticker.lastTime / 1000));
      nextApp.ticker.start();

      const events = nextApp.renderer.events as PixiDomEvents;
      events.setTargetElement(null as never);

      if (!this.windowEventsBound) {
        window.addEventListener('pointermove', this.handleWindowPointerMove);
        window.addEventListener('pointerup', this.handleWindowPointerUp);

        this.windowEventsBound = true;
      }

      this.app = nextApp;
      this.extensionVersion = getPixiExtensionVersion();

      return nextApp;
    } finally {
      this.applicationInit = null;
    }
  }

  private async recreateApplication() {
    const app = this.app;
    if (!app) return;

    this.app = null;
    app.destroy({ removeView: false }, { children: false });

    await this.getApplication();
  }

  destroy() {
    this.destroyed = true;
    this.entries.forEach((_, nodeId) => this.unregister(nodeId));

    if (this.windowEventsBound) {
      window.removeEventListener('pointermove', this.handleWindowPointerMove);
      window.removeEventListener('pointerup', this.handleWindowPointerUp);

      this.windowEventsBound = false;
    }

    this.app?.destroy({ removeView: false }, { children: true });
    this.app = null;
    this.pixiRuntime = null;
    this.rendererProxy = null;
  }

  private bindEvents(entry: PixiDomEntry) {
    const onPointerDown = (event: PointerEvent) => {
      this.activePointers.set(event.pointerId, entry);
      this.dispatchEvent(entry, '_onPointerDown', event);
    };

    const onPointerMove = (event: PointerEvent) =>
      this.dispatchEvent(entry, '_onPointerMove', event);

    const onPointerUp = (event: PointerEvent) => {
      this.dispatchEvent(entry, '_onPointerUp', event);
      this.activePointers.delete(event.pointerId);
    };

    const onPointerOverOut = (event: PointerEvent) =>
      this.dispatchEvent(entry, '_onPointerOverOut', event);

    const onWheel = (event: WheelEvent) => this.dispatchEvent(entry, 'onWheel', event);

    entry.canvas.addEventListener('pointerdown', onPointerDown);
    entry.canvas.addEventListener('pointermove', onPointerMove);
    entry.canvas.addEventListener('pointerup', onPointerUp);
    entry.canvas.addEventListener('pointercancel', onPointerUp);
    entry.canvas.addEventListener('pointerleave', onPointerOverOut);
    entry.canvas.addEventListener('pointerover', onPointerOverOut);
    entry.canvas.addEventListener('wheel', onWheel, { passive: true });

    entry.handlers = {
      onPointerDown,
      onPointerMove,
      onPointerOverOut,
      onPointerUp,
      onWheel
    };
  }

  private unbindEvents(entry: PixiDomEntry) {
    const handlers = entry.handlers;
    if (!handlers) return;

    entry.canvas.removeEventListener('pointerdown', handlers.onPointerDown);
    entry.canvas.removeEventListener('pointermove', handlers.onPointerMove);
    entry.canvas.removeEventListener('pointerup', handlers.onPointerUp);
    entry.canvas.removeEventListener('pointercancel', handlers.onPointerUp);
    entry.canvas.removeEventListener('pointerleave', handlers.onPointerOverOut);
    entry.canvas.removeEventListener('pointerover', handlers.onPointerOverOut);
    entry.canvas.removeEventListener('wheel', handlers.onWheel);

    entry.handlers = undefined;
  }

  private handleWindowPointerMove = (event: PointerEvent) => {
    const entry = this.activePointers.get(event.pointerId);
    if (!entry || event.target === entry.canvas) return;

    this.dispatchEvent(entry, '_onPointerMove', event);
  };

  private handleWindowPointerUp = (event: PointerEvent) => {
    const entry = this.activePointers.get(event.pointerId);
    if (!entry || event.target === entry.canvas) return;

    this.dispatchEvent(entry, '_onPointerUp', event);
    this.activePointers.delete(event.pointerId);
  };

  private dispatchEvent(
    entry: PixiDomEntry,
    handler: PixiHandler,
    event: PointerEvent | WheelEvent
  ) {
    const app = this.app;
    if (!app) return;

    const renderer = app.renderer;
    const events = renderer.events as PixiDomEvents;
    const previousRenderer = events.renderer;
    const previousRoot = events.rootBoundary.rootTarget;
    const previousCanvas = events.domElement;

    const eventRenderer = Object.create(renderer, {
      lastObjectRendered: { get: () => entry.stage }
    }) as WebGLRenderer;

    events.renderer = eventRenderer;
    events.domElement = entry.canvas;

    const dispatch = events[handler] as PixiHandlerFn;

    try {
      dispatch(event);
    } finally {
      events.domElement = previousCanvas;
      events.renderer = previousRenderer;
      events.rootBoundary.rootTarget = previousRoot;
    }
  }

  private render(time: number) {
    const app = this.app;
    if (!app) return;

    this.entries.forEach((entry) => {
      if (entry.paused) return;

      try {
        entry.draw(time);

        // When using multi-view renderer, we need to clear canvas explicitly.
        entry.canvas.getContext('2d')?.clearRect(0, 0, entry.width, entry.height);

        app.renderer.render({
          container: entry.stage,
          target: entry.canvas,
          clear: true
        });

        entry.onRendered();
      } catch (error) {
        console.error('[pixi.dom] render error', error);
      }
    });
  }

  private resizeEntry(entry: PixiDomEntry, size: { width: number; height: number }) {
    entry.width = size.width;
    entry.height = size.height;

    entry.canvas.width = size.width;
    entry.canvas.height = size.height;
  }
}

export const pixiDomManager = new PixiDomManager();
