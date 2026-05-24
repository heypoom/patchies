import type regl from 'regl';
import type { Deck, Layer, PickingInfo } from '@deck.gl/core';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { CANVAS_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';
import { BaseWorkerRenderer, type BaseRendererConfig } from './BaseWorkerRenderer';
import { getFramebuffer } from './utils';
import { setupWorkerDOMMocks } from './workerDOMMocks';

type DeckGLRendererConfig = BaseRendererConfig & {
  runRevision?: number;
};

type DeckViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

type WheelEventData = {
  x?: number;
  y?: number;
  deltaX?: number;
  deltaY: number;
  deltaMode?: number;
};

type WorkerMouseObject = {
  readonly x: number;
  readonly y: number;
};

type UserGetLayers = (args: {
  time: number;
  viewState: DeckViewState;
  mouse: WorkerMouseObject;
}) => Layer[];

type SerializablePickingInfo = {
  picked: boolean;
  index: number;
  object: unknown;
  x: number;
  y: number;
  coordinate?: number[];
  color?: number[];
  pixelRatio?: number;
  layer?: { id: string } | null;
  sourceLayer?: { id: string } | null;
  viewport?: { id: string } | null;
};

type DeckPickingCallback = (info: SerializablePickingInfo | null) => void;

type DeckPointerState = {
  x: number;
  y: number;
  down: boolean;
};

type DeckPrivatePickingPass = {
  getLayerParameters?: (
    layer: unknown,
    layerIndex: number,
    viewport: unknown
  ) => Record<string, unknown>;
};

type DeckWithPrivatePicker = Deck & {
  deckPicker?: {
    pickLayersPass?: DeckPrivatePickingPass;
  };
};

type SizedFramebuffer = regl.Framebuffer2D & {
  width: number;
  height: number;
};

type DeckTexture = {
  destroy(): void;
};

type DeckFramebuffer = {
  width: number;
  height: number;
  handle?: WebGLFramebuffer;
  resize(options: { width: number; height: number }): void;
  destroy(): void;
};

type DeckDevice = {
  canvasContext?: {
    setDrawingBufferSize?: (width: number, height: number) => void;
  };
  createTexture(options: {
    format: string;
    width: number;
    height: number;
    sampler?: Record<string, string>;
  }): DeckTexture;
  createFramebuffer(options: {
    width: number;
    height: number;
    colorAttachments: DeckTexture[];
    depthStencilAttachment?: string;
  }): DeckFramebuffer;
};

export class DeckGLRenderer extends BaseWorkerRenderer<DeckGLRendererConfig> {
  private DeckClass: typeof import('@deck.gl/core').Deck | null = null;
  private layerClasses: typeof import('@deck.gl/layers') | null = null;
  private geoLayerClasses: typeof import('@deck.gl/geo-layers') | null = null;

  private deck: Deck | null = null;
  private device: DeckDevice | null = null;
  private deckTexture: DeckTexture | null = null;
  private deckFramebuffer: DeckFramebuffer | null = null;
  private getLayers: UserGetLayers | null = null;
  private previousCameraPointer: DeckPointerState | null = null;
  private previousPickingPointer: DeckPointerState | null = null;
  private clickStartPointer: DeckPointerState | null = null;
  private lastHoverKey: string | null = null;
  private hoverCallbacks = new Set<DeckPickingCallback>();
  private clickCallbacks = new Set<DeckPickingCallback>();
  private patchedPickingPasses = new WeakSet<object>();
  private pendingWheelDelta = 0;
  private deckInteractionEnabled = true;

  private viewState: DeckViewState = {
    longitude: -122.44,
    latitude: 37.76,
    zoom: 11,
    pitch: 45,
    bearing: 0
  };

  private constructor(
    config: DeckGLRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ) {
    super(config, framebuffer, renderer);
  }

  static async create(
    config: DeckGLRendererConfig,
    framebuffer: regl.Framebuffer2D,
    renderer: FBORenderer
  ): Promise<DeckGLRenderer> {
    const instance = new DeckGLRenderer(config, framebuffer, renderer);
    setupWorkerDOMMocks();

    const deckModule = await import('@deck.gl/core');
    instance.layerClasses = await import('@deck.gl/layers');
    instance.geoLayerClasses = await import('@deck.gl/geo-layers');

    instance.DeckClass = deckModule.Deck;

    await instance.createDeck();
    await instance.updateCode();

    return instance;
  }

  renderFrame(params: RenderParams): void {
    if (!this.deck || !this.deckFramebuffer || !this.getLayers) return;

    const gl = this.renderer.gl;
    if (!gl) return;

    this.mouseX = params.mouseX;
    this.mouseY = params.mouseY;

    if (this.deckInteractionEnabled) {
      this.updateViewStateFromPointer(params);
      this.updateViewStateFromWheel();
    } else {
      this.previousCameraPointer = null;
      this.pendingWheelDelta = 0;
    }

    this.ensureRenderTargetSize();

    let layers: Layer[] = [];

    try {
      layers = this.getLayers({
        time: params.transportTime,
        viewState: this.viewState,
        mouse: this.createMouseObject()
      });
    } catch (error) {
      this.handleRuntimeError(error, CANVAS_WRAPPER_OFFSET);
      return;
    }

    this.deck.setProps({ viewState: this.viewState, layers });
    this.deck.redraw('patchies');
    this.updatePicking(params);

    this.blitToReglFramebuffer();
    this.renderer.regl._refresh();
  }

  async updateCode(): Promise<void> {
    this.resetState();
    this.setInteraction('interact', false);

    this.deckInteractionEnabled = true;
    this.hoverCallbacks.clear();
    this.clickCallbacks.clear();
    this.previousPickingPointer = null;
    this.clickStartPointer = null;
    this.lastHoverKey = null;

    this.setPortCount(1, 0);

    if (!this.DeckClass || !this.layerClasses || !this.geoLayerClasses) return;

    try {
      const setViewState = (viewState: Partial<DeckViewState>) => {
        this.viewState = { ...this.viewState, ...viewState };
      };

      const setDeckInteraction = (enabled: boolean) => {
        this.deckInteractionEnabled = enabled;
      };

      const onDeckHover = (callback: DeckPickingCallback) => {
        this.hoverCallbacks.add(callback);

        return () => this.hoverCallbacks.delete(callback);
      };

      const onDeckClick = (callback: DeckPickingCallback) => {
        this.clickCallbacks.add(callback);

        return () => this.clickCallbacks.delete(callback);
      };

      const extraContext = {
        ...this.buildBaseExtraContext(),
        Deck: this.DeckClass,
        ...this.layerClasses,
        ...this.geoLayerClasses,
        viewState: this.viewState,
        setViewState,
        setDeckInteraction,
        onDeckHover,
        onDeckClick
      };

      const codeWithWrapper = `
        var getLayers;

        ${this.config.code}

        return {
          getLayers: typeof getLayers === 'function' ? getLayers : null
        };
      `;

      const result = await this.executeUserCode(codeWithWrapper, extraContext);
      const maybeGetLayers = (result as { getLayers?: unknown } | null)?.getLayers;

      this.getLayers =
        typeof maybeGetLayers === 'function' ? (maybeGetLayers as UserGetLayers) : null;

      if (!this.getLayers) {
        throw new Error('Define getLayers({ time, viewState, mouse }) to render deck.gl layers.');
      }
    } catch (error) {
      this.handleRuntimeError(error, CANVAS_WRAPPER_OFFSET);
    }
  }

  async updateConfig(config: DeckGLRendererConfig, framebuffer: regl.Framebuffer2D) {
    const previousFramebuffer = this.framebuffer as SizedFramebuffer | null;
    const nextFramebuffer = framebuffer as SizedFramebuffer;

    this.config = config;
    this.framebuffer = framebuffer;

    const sizeChanged =
      previousFramebuffer?.width !== nextFramebuffer.width ||
      previousFramebuffer?.height !== nextFramebuffer.height;

    if (sizeChanged) {
      this.ensureRenderTargetSize();
    }

    await this.updateCode();
  }

  handleWheelData(event: WheelEventData): void {
    this.pendingWheelDelta += event.deltaY;
  }

  destroy(): void {
    this.deck?.finalize();
    this.deck = null;

    this.deckFramebuffer?.destroy();
    this.deckFramebuffer = null;

    this.deckTexture?.destroy();
    this.deckTexture = null;
  }

  private async createDeck(): Promise<void> {
    const DeckClass = this.DeckClass;
    if (!DeckClass) return;

    const gl = this.renderer.gl;
    if (!gl) return;

    const canvas = gl.canvas as OffscreenCanvas & {
      style?: Record<string, string>;
      isConnected?: boolean;
      parentElement?: unknown;
    };

    canvas.style ??= {};
    canvas.isConnected ??= false;
    canvas.parentElement ??= null;

    await new Promise<void>((resolve) => {
      this.deck = new DeckClass({
        controller: false,
        gl,
        width: null,
        height: null,
        useDevicePixels: false,
        initialViewState: this.viewState,
        viewState: this.viewState,
        layers: [],
        getTooltip: null,
        parameters: { depthCompare: 'less-equal' },
        onDeviceInitialized: (device: unknown) => {
          this.device = device as DeckDevice;
          this.createRenderTarget();

          this.deck?.setProps({ _framebuffer: this.deckFramebuffer } as never);
          this.patchPickingBlendParameters();

          resolve();
        },
        onError: (error) => {
          this.handleRuntimeError(error, CANVAS_WRAPPER_OFFSET);
        }
      });
    });
  }

  private createRenderTarget(): void {
    if (!this.device) return;

    const [width, height] = this.renderer.outputSize;

    this.deckTexture?.destroy();
    this.deckFramebuffer?.destroy();

    this.deckTexture = this.device.createTexture({
      format: 'rgba8unorm',
      width,
      height,
      sampler: {
        minFilter: 'linear',
        magFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge'
      }
    });

    this.deckFramebuffer = this.device.createFramebuffer({
      width,
      height,
      colorAttachments: [this.deckTexture],
      depthStencilAttachment: 'depth16unorm'
    });
  }

  private ensureRenderTargetSize(): void {
    if (!this.device || !this.deckFramebuffer) return;

    const [width, height] = this.renderer.outputSize;
    this.device.canvasContext?.setDrawingBufferSize?.(width, height);

    if (this.deckFramebuffer.width !== width || this.deckFramebuffer.height !== height) {
      this.deckFramebuffer.resize({ width, height });
    }
  }

  private updateViewStateFromPointer(params: RenderParams): void {
    const pointer = this.getPointerState(params);

    if (pointer.down && this.previousCameraPointer?.down) {
      const dx = pointer.x - this.previousCameraPointer.x;
      const dy = pointer.y - this.previousCameraPointer.y;
      const zoomScale = Math.max(1, this.viewState.zoom);

      this.viewState = {
        ...this.viewState,
        longitude: this.viewState.longitude - dx / (80 * zoomScale),
        latitude: Math.max(-85, Math.min(85, this.viewState.latitude + dy / (80 * zoomScale)))
      };
    }

    this.previousCameraPointer = pointer;
  }

  private updateViewStateFromWheel(): void {
    if (this.pendingWheelDelta === 0) return;

    const delta = this.pendingWheelDelta;
    this.pendingWheelDelta = 0;

    this.viewState = {
      ...this.viewState,
      zoom: Math.max(0, Math.min(22, this.viewState.zoom - delta * 0.01))
    };
  }

  private patchPickingBlendParameters(): void {
    const pickLayersPass = (this.deck as DeckWithPrivatePicker | null)?.deckPicker?.pickLayersPass;
    const getLayerParameters = pickLayersPass?.getLayerParameters;

    if (!pickLayersPass || !getLayerParameters) return;
    if (this.patchedPickingPasses.has(pickLayersPass)) return;

    this.patchedPickingPasses.add(pickLayersPass);

    pickLayersPass.getLayerParameters = (layer, layerIndex, viewport) => {
      const parameters = getLayerParameters.call(pickLayersPass, layer, layerIndex, viewport);

      if (parameters.blendAlphaSrcFactor !== 'constant-alpha') return parameters;

      const legacyParameters = { ...parameters };
      delete legacyParameters.blendColorOperation;
      delete legacyParameters.blendColorSrcFactor;
      delete legacyParameters.blendColorDstFactor;
      delete legacyParameters.blendAlphaOperation;
      delete legacyParameters.blendAlphaSrcFactor;
      delete legacyParameters.blendAlphaDstFactor;

      return {
        ...legacyParameters,
        blendEquation: [32774, 32774],
        blendFunc: [1, 0, 32771, 0]
      };
    };
  }

  private updatePicking(params: RenderParams): void {
    if (!this.deck || (this.hoverCallbacks.size === 0 && this.clickCallbacks.size === 0)) {
      this.previousPickingPointer = this.getPointerState(params);
      return;
    }

    const pointer = this.getPointerState(params);
    const previousPointer = this.previousPickingPointer;

    if (pointer.down && !previousPointer?.down) {
      this.clickStartPointer = pointer;
    }

    if (!pointer.down) {
      const hoverInfo = this.pickAt(pointer);

      this.emitHoverIfChanged(hoverInfo);
    }

    if (!pointer.down && previousPointer?.down && this.clickStartPointer) {
      const dx = pointer.x - this.clickStartPointer.x;
      const dy = pointer.y - this.clickStartPointer.y;

      const movedDistance = Math.hypot(dx, dy);

      if (movedDistance <= 5) {
        const clickInfo = this.pickAt(pointer);

        if (clickInfo?.object) {
          this.emitPickingCallbacks(this.clickCallbacks, clickInfo);
        }
      }

      this.clickStartPointer = null;
    }

    this.previousPickingPointer = pointer;
  }

  private pickAt(pointer: DeckPointerState): PickingInfo | null {
    if (!this.deck) return null;

    try {
      this.patchPickingBlendParameters();

      return this.deck.pickObject({ x: pointer.x, y: pointer.y, radius: 5 });
    } catch (error) {
      this.handleRuntimeError(error, CANVAS_WRAPPER_OFFSET);

      return null;
    }
  }

  private emitHoverIfChanged(info: PickingInfo | null): void {
    const hoverKey = info?.object ? `${info.layer?.id ?? 'unknown'}:${info.index}` : null;
    if (hoverKey === this.lastHoverKey) return;

    this.lastHoverKey = hoverKey;
    this.emitPickingCallbacks(this.hoverCallbacks, info?.object ? info : null);
  }

  private emitPickingCallbacks(
    callbacks: Set<DeckPickingCallback>,
    info: PickingInfo | null
  ): void {
    const serializableInfo = this.serializePickingInfo(info);

    for (const callback of callbacks) {
      try {
        callback(serializableInfo);
      } catch (error) {
        this.handleRuntimeError(error, CANVAS_WRAPPER_OFFSET);
      }
    }
  }

  private serializePickingInfo(info: PickingInfo | null): SerializablePickingInfo | null {
    if (!info) return null;

    return {
      picked: info.picked,
      index: info.index,
      object: this.toCloneableValue(info.object),
      x: info.x,
      y: info.y,
      coordinate: this.toNumberArray(info.coordinate),
      color: this.toNumberArray(info.color),
      pixelRatio: info.pixelRatio,
      layer: this.serializeDeckItem(info.layer),
      sourceLayer: this.serializeDeckItem(info.sourceLayer),
      viewport: this.serializeDeckItem(info.viewport)
    };
  }

  private serializeDeckItem(item: { id?: string } | null | undefined): { id: string } | null {
    return item?.id ? { id: item.id } : null;
  }

  private toNumberArray(value: unknown): number[] | undefined {
    return Array.isArray(value)
      ? value.filter((item): item is number => typeof item === 'number')
      : undefined;
  }

  private toCloneableValue(value: unknown): unknown {
    if (value === null || value === undefined) return value;

    try {
      return structuredClone(value);
    } catch {
      return this.toJsonLikeValue(value, new WeakSet());
    }
  }

  private toJsonLikeValue(value: unknown, seen: WeakSet<object>): unknown {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (ArrayBuffer.isView(value)) {
      const view = value as unknown as { length?: number; [index: number]: unknown };
      if (typeof view.length !== 'number') return undefined;

      return Array.from({ length: view.length }, (_, index) =>
        this.toJsonLikeValue(view[index], seen)
      );
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.toJsonLikeValue(item, seen));
    }

    if (typeof value !== 'object' || seen.has(value)) return undefined;

    seen.add(value);

    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'function' || typeof item === 'symbol') continue;

      output[key] = this.toJsonLikeValue(item, seen);
    }

    seen.delete(value);

    return output;
  }

  private getPointerState(params: RenderParams): DeckPointerState {
    return {
      x: params.mouseX,
      y: params.mouseY,
      down: params.mouseZ >= 0 && params.mouseW >= 0
    };
  }

  private blitToReglFramebuffer(): void {
    if (!this.deckFramebuffer || !this.framebuffer) return;

    const gl = this.renderer.gl;
    if (!gl) return;

    const [width, height] = this.renderer.outputSize;
    const sourceFBO = this.deckFramebuffer.handle;

    const destFBO = getFramebuffer(this.framebuffer);
    if (!sourceFBO) return;

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.LINEAR);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }
}
