import type regl from 'regl';
import type { Deck, Layer } from '@deck.gl/core';
import type { Device, Framebuffer, Texture } from '@luma.gl/core';
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

type SizedFramebuffer = regl.Framebuffer2D & {
  width: number;
  height: number;
};

export class DeckGLRenderer extends BaseWorkerRenderer<DeckGLRendererConfig> {
  private DeckClass: typeof import('@deck.gl/core').Deck | null = null;
  private layerClasses: typeof import('@deck.gl/layers') | null = null;

  private deck: Deck | null = null;
  private device: Device | null = null;
  private deckTexture: Texture | null = null;
  private deckFramebuffer: Framebuffer | null = null;
  private getLayers: UserGetLayers | null = null;
  private previousPointer: { x: number; y: number; down: boolean } | null = null;
  private pendingWheelDelta = 0;

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

    this.updateViewStateFromPointer(params);
    this.updateViewStateFromWheel();
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

    this.deck.setProps({
      viewState: this.viewState,
      layers
    });

    this.deck.redraw('patchies');

    this.blitToReglFramebuffer();
    this.renderer.regl._refresh();
  }

  async updateCode(): Promise<void> {
    this.resetState();
    this.setPortCount(1, 0);

    if (!this.DeckClass || !this.layerClasses) return;

    try {
      const setViewState = (viewState: Partial<DeckViewState>) => {
        this.viewState = { ...this.viewState, ...viewState };
      };

      const extraContext = {
        ...this.buildBaseExtraContext(),
        Deck: this.DeckClass,
        ...this.layerClasses,
        viewState: this.viewState,
        setViewState
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
        onDeviceInitialized: (device: Device) => {
          this.device = device;
          this.createRenderTarget();

          this.deck?.setProps({ _framebuffer: this.deckFramebuffer });

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
    this.device.canvasContext?.setDrawingBufferSize(width, height);

    if (this.deckFramebuffer.width !== width || this.deckFramebuffer.height !== height) {
      this.deckFramebuffer.resize({ width, height });
    }
  }

  private updateViewStateFromPointer(params: RenderParams): void {
    const down = params.mouseZ >= 0 && params.mouseW >= 0;
    const pointer = { x: params.mouseX, y: params.mouseY, down };

    if (down && this.previousPointer?.down) {
      const dx = pointer.x - this.previousPointer.x;
      const dy = pointer.y - this.previousPointer.y;
      const zoomScale = Math.max(1, this.viewState.zoom);

      this.viewState = {
        ...this.viewState,
        longitude: this.viewState.longitude - dx / (80 * zoomScale),
        latitude: Math.max(-85, Math.min(85, this.viewState.latitude + dy / (80 * zoomScale)))
      };
    }

    this.previousPointer = pointer;
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

  private blitToReglFramebuffer(): void {
    if (!this.deckFramebuffer || !this.framebuffer) return;

    const gl = this.renderer.gl;
    if (!gl) return;

    const [width, height] = this.renderer.outputSize;
    const sourceFBO = (this.deckFramebuffer as Framebuffer & { handle?: WebGLFramebuffer }).handle;
    const destFBO = getFramebuffer(this.framebuffer);
    if (!sourceFBO) return;

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.LINEAR);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }
}
