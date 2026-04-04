# 101. Base Worker Renderer

## Status: Draft

## Summary

Extract a `BaseWorkerRenderer` abstract class from the 5 worker-side renderers (canvas, three, hydra, textmode, regl) to eliminate ~500 lines of verbatim duplication. Each renderer currently copy-pastes identical FFT, messaging, mouse, port config, console, error handling, and settings proxy code.

## Motivation

Adding the `regl` renderer made the duplication obvious — every new renderer requires copying ~120 lines of boilerplate that's identical across all of them. This makes bugs harder to fix (must patch 5 files), new renderers expensive to add, and the codebase harder to read.

## What's Duplicated

### Verbatim identical (copy-paste, ~120 lines per renderer)

These methods are character-for-character the same across all renderers:

| Method | Lines | Description |
| --- | --- | --- |
| `createFFTFunction()` | 29 | Build FFT accessor with caching and registration |
| `setFFTData()` | 11 | Receive FFT data from main thread |
| `sendMessage()` | 8 | Post `sendMessageFromNode` to main thread |
| `setPortCount()` | 9 | Post message/video port count changes |
| `setTitle()` | 7 | Post title update |
| `setInteraction()` | 8 | Post drag/pan/wheel/interact state |
| `setVideoOutputEnabled()` | 7 | Post video output toggle |
| `handleMessage()` | 3 | Route edge message to msgContext |
| `handleChannelMessage()` | 3 | Route channel message to msgContext |
| `createMouseObject()` | 13 | Getter-based `{x, y}` accessor |
| `createCustomConsole()` | 14 | Console proxy posting to main thread |
| Fields + constructor init | ~15 | config, renderer, framebuffer, msgContext, settingsProxy, FFT maps, mouse, sampleRate |

### Same skeleton, different config (~80 lines per renderer)

- **`updateCode()`** — identical preamble (reset FFT, reset settings proxy, reset interaction, preprocess code, build extraContext, execute JS, catch errors), but each renderer adds its own entries to `extraContext` and may wrap/extract user code differently
- **`static create()`** — same async factory pattern with renderer-specific resource init
- **`destroy()`** — same structure (cancel animation, call jsRunner.destroy, null refs) with renderer-specific teardown
- **Error handling** — same throttle pattern + `parseJSError` call with different wrapper offset constant

### Truly unique per renderer

- **regl**: tracked Proxy wrapper, fallback texture, `getTexture()` → regl.Texture2D
- **three**: Three.js renderer/renderTarget, blit-to-regl, texture wrapping, `getTexture()` → three.Texture
- **canvas**: OffscreenCanvas 2D, `drawCanvasToTexture()`, RAF loop, pause/resume
- **textmode**: OffscreenCanvas 2D + textmode.js, shares `drawCanvasToTexture`/`ensureDrawCommand` with canvas
- **hydra**: Hydra synth instance, source/param mapping, code transform, `.out(o0)` injection

## Design

### BaseWorkerRenderer

```
ui/src/workers/rendering/BaseWorkerRenderer.ts
```

Abstract class containing all shared state and methods. Subclasses override only what's unique.

```typescript
import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import type { Message } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';

export interface BaseRendererConfig {
  code: string;
  nodeId: string;
}

export abstract class BaseWorkerRenderer<TConfig extends BaseRendererConfig = BaseRendererConfig> {
  public config: TConfig;
  public renderer: FBORenderer;
  public framebuffer: regl.Framebuffer2D | null;

  protected msgContext: WorkerRendererMessageContext;
  public settingsProxy: WorkerSettingsProxy | null = null;

  // FFT
  public isFFTEnabled = false;
  protected sampleRate = 44100;
  protected fftRequestCache = new Map<string, boolean>();
  protected fftDataCache = new Map<string, { data: Uint8Array | Float32Array; timestamp: number }>();

  // Mouse
  protected mouseX = 0;
  protected mouseY = 0;

  // Error throttling
  protected lastRuntimeError: string | null = null;
  protected lastRuntimeErrorTime = 0;
  protected static readonly RUNTIME_ERROR_THROTTLE_MS = 1000;

  constructor(config: TConfig, framebuffer: regl.Framebuffer2D, renderer: FBORenderer) {
    this.config = config;
    this.framebuffer = framebuffer;
    this.renderer = renderer;
    this.msgContext = new WorkerRendererMessageContext(config.nodeId);
  }

  // ── Identical across all renderers ──

  createFFTFunction() { /* shared */ }
  setFFTData(payload: AudioAnalysisPayloadWithType) { /* shared */ }
  sendMessage(data: unknown, options: SendMessageOptions) { /* shared */ }
  setPortCount(inletCount?: number, outletCount?: number) { /* shared */ }
  setTitle(title: string) { /* shared */ }
  setInteraction(mode: string, enabled: boolean) { /* shared */ }
  setVideoOutputEnabled(videoOutputEnabled: boolean) { /* shared */ }
  handleMessage(message: Message) { /* shared */ }
  handleChannelMessage(channel: string, data: unknown, sourceNodeId: string) { /* shared */ }
  createMouseObject() { /* shared */ }
  createCustomConsole() { /* shared */ }

  // ── Shared skeleton with hooks ──

  /** Resets FFT, settings proxy, interaction state. Call super in subclass. */
  protected resetState() {
    this.isFFTEnabled = false;
    this.fftDataCache.clear();
    this.fftRequestCache.clear();
    this.msgContext.reset();

    if (!this.settingsProxy) {
      this.settingsProxy = createWorkerSettingsProxy(this.config.nodeId, (msg) =>
        self.postMessage(msg)
      );
    } else {
      this.settingsProxy._reset();
    }

    this.setInteraction('interact', true);
    this.setVideoOutputEnabled(true);
  }

  /** Builds the common extraContext entries. Subclasses extend with their own. */
  protected buildBaseExtraContext() {
    const [width, height] = this.renderer.outputSize;
    return {
      width,
      height,
      mouse: this.createMouseObject(),
      fft: this.createFFTFunction(),
      getVfsUrl: createWorkerGetVfsUrl(this.config.nodeId),
      onMessage: this.msgContext.createOnMessageFunction(),
      send: this.sendMessage.bind(this),
      noDrag: () => this.setInteraction('drag', false),
      noPan: () => this.setInteraction('pan', false),
      noWheel: () => this.setInteraction('wheel', false),
      noInteract: () => this.setInteraction('interact', false),
      noOutput: () => this.setVideoOutputEnabled(false),
      clock: this.renderer.createWorkerClock(),
      settings: this.settingsProxy!.settings,
    };
  }

  /** Preprocesses and executes user code via JSRunner. */
  protected async executeUserCode(code: string, extraContext: Record<string, unknown>) {
    const processedCode = await this.renderer.jsRunner.preprocessCode(code, {
      nodeId: this.config.nodeId,
    });
    if (processedCode === null) return null;

    return this.renderer.jsRunner.executeJavaScript(this.config.nodeId, processedCode, {
      customConsole: this.createCustomConsole(),
      setPortCount: (inletCount?: number, outletCount?: number) =>
        this.setPortCount(inletCount, outletCount),
      setTitle: this.setTitle.bind(this),
      setHidePorts: (hidePorts: boolean) =>
        self.postMessage({ type: 'setHidePorts', nodeId: this.config.nodeId, hidePorts }),
      extraContext,
    });
  }

  /** Throttled runtime error reporting. */
  protected handleRuntimeError(error: unknown, wrapperOffset: number) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const now = performance.now();

    if (
      this.lastRuntimeError === errorMessage &&
      now - this.lastRuntimeErrorTime < 1000
    ) return;

    this.lastRuntimeError = errorMessage;
    this.lastRuntimeErrorTime = now;

    const errorInfo = parseJSError(error, countLines(this.config.code), wrapperOffset);
    self.postMessage({
      type: 'consoleOutput',
      nodeId: this.config.nodeId,
      level: 'error',
      args: [`Runtime error: ${errorMessage}`],
      lineErrors: errorInfo?.lineErrors,
    });
  }

  /** Code error reporting with line numbers. */
  protected handleCodeError(error: unknown, wrapperOffset: number) {
    const errorInfo = parseJSError(error, countLines(this.config.code), wrapperOffset);
    if (errorInfo) {
      self.postMessage({
        type: 'consoleOutput',
        nodeId: this.config.nodeId,
        level: 'error',
        args: [errorInfo.message],
        lineErrors: errorInfo.lineErrors,
      });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.createCustomConsole().error(errorMessage);
  }

  /** Clean up JSRunner context. Call super in subclass destroy(). */
  destroy() {
    this.renderer.jsRunner.destroy(this.config.nodeId);
  }

  // ── Abstract ──

  abstract renderFrame(params: RenderParams): void;
  abstract updateCode(): Promise<void>;
}
```

### What Subclasses Look Like

**ReglRenderer (after refactor)**:

```typescript
export class ReglRenderer extends BaseWorkerRenderer {
  private trackedRegl: TrackedRegl | null = null;
  private fallbackTexture: regl.Texture2D;
  private userRenderFunc: ((time: number) => void) | null = null;

  renderFrame(params: RenderParams) {
    if (!this.userRenderFunc) return;
    if (this.renderer.transportTime && !this.renderer.transportTime.isPlaying) return;

    this.mouseX = params.mouseX;
    this.mouseY = params.mouseY;
    this.inputTextures = params.userParams as (regl.Texture2D | undefined)[];

    try {
      this.userRenderFunc(params.transportTime);
    } catch (error) {
      this.handleRuntimeError(error, REGL_WRAPPER_OFFSET);
    }
  }

  async updateCode() {
    this.userRenderFunc = null;
    this.trackedRegl?.destroyAll();
    this.resetState();  // ← one call replaces 15 lines

    try {
      this.trackedRegl = createTrackedRegl(this.renderer.regl, () => this.framebuffer);

      const extraContext = {
        ...this.buildBaseExtraContext(),  // ← one spread replaces 20 lines
        regl: this.trackedRegl.regl,
        setVideoCount: this.setVideoCount.bind(this),
        getTexture: this.getTexture.bind(this),
        requestAnimationFrame: () => {},
      };

      const codeWithWrapper = `var recv = onMessage; var render;\n${processedCode}\nreturn typeof render === 'function' ? render : null;`;

      const userRender = await this.executeUserCode(codeWithWrapper, extraContext);
      this.userRenderFunc = typeof userRender === 'function' ? userRender : null;
    } catch (error) {
      this.handleCodeError(error, REGL_WRAPPER_OFFSET);
    }
  }

  destroy() {
    this.trackedRegl?.destroyAll();
    this.fallbackTexture.destroy();
    super.destroy();  // ← calls jsRunner.destroy()
  }
}
```

Compare to the current ~500-line file — this would be ~80 lines.

### Canvas + Textmode Shared Mixin

These two renderers also share `drawCanvasToTexture()` and `ensureDrawCommand()` (identical 50 lines). Extract to a `CanvasBlitMixin` or utility:

```typescript
/** Shared by CanvasRenderer and TextmodeRenderer */
export class CanvasBlit {
  canvasTexture: regl.Texture2D | null = null;
  drawCommand: regl.DrawCommand | null = null;

  ensureDrawCommand(regl: regl.Regl, canvas: OffscreenCanvas, framebuffer: regl.Framebuffer2D) { ... }
  drawCanvasToTexture() { ... }
}
```

## Migration Strategy

1. Create `BaseWorkerRenderer.ts` with all shared code
2. Migrate **regl** first (newest, simplest, no risk of regression on existing nodes)
3. Migrate **three** (similar structure to regl)
4. Migrate **canvas** + **textmode** together (share canvas blit code)
5. Migrate **hydra** last (most unique, has mouse scope and source mapping)

Each step is a self-contained commit. Existing behavior doesn't change — just where the code lives.

## What NOT to Extract

- `renderFrame()` — completely different per renderer, no shared skeleton worth extracting
- `static create()` — async factory with renderer-specific init; keep per-renderer
- `getTexture()` — different return types (regl.Texture2D vs three.Texture vs null)
- Hydra's `setMouseScope()`, `stop()`, source mapping — truly unique
- Canvas/Textmode's RAF loop and pause/resume — unique to those renderers

## Estimated Impact

| Metric | Before | After |
| --- | --- | --- |
| Total lines across 5 renderers | ~2,400 | ~1,400 |
| Lines to add a new renderer | ~500 | ~80-120 |
| Places to fix a messaging bug | 5 | 1 |
| Shared code in one place | 0 | ~350 lines (BaseWorkerRenderer) |
