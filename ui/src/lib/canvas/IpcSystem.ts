import {
  dispatchOutputToMainMessage,
  hasConnectedOutputWindow,
  type CodeOverlayMirrorState,
  type MainToOutputMessage,
  type OutputSurfaceInputSink,
  type OutputToMainMessage,
  type SurfaceOverlayMirrorState
} from './secondary-output-ipc';

const IPC_CHANNEL = 'patchies-ipc';

export class IpcSystem {
  private static instance: IpcSystem;

  public outputWindow: Window | null = null;

  private outputSurfaceInputSink: OutputSurfaceInputSink | null = null;
  private pendingSurfaceOverlayCanvas: HTMLCanvasElement | null = null;

  private surfaceFrameScheduled = false;
  private surfaceFrameInFlight = false;
  private lastCodeOverlayState: CodeOverlayMirrorState | null = null;
  private lastSurfaceOverlayState: SurfaceOverlayMirrorState | null = null;

  static getInstance() {
    if (!IpcSystem.instance) {
      IpcSystem.instance = new IpcSystem();
    }

    // @ts-expect-error -- expose globally for debugging
    window.ipcSystem = IpcSystem.instance;

    return IpcSystem.instance;
  }

  constructor() {
    // Listen for output window announcing itself (handles reloads on either side)
    window.addEventListener('message', (event) => {
      const message = event.data as OutputToMainMessage | undefined;

      if (message?.type === 'outputReady' && event.source) {
        this.outputWindow = event.source as Window;

        this.postToOutput({ type: 'codeOverlayState', state: this.lastCodeOverlayState });
        this.postToOutput({ type: 'surfaceOverlayState', state: this.lastSurfaceOverlayState });

        return;
      }

      if (!message) return;

      dispatchOutputToMainMessage(message, this.outputSurfaceInputSink);
    });

    // Ping any existing output windows to re-announce (handles main page reload)
    const channel = new BroadcastChannel(IPC_CHANNEL);
    channel.postMessage({ type: 'ping' });
    channel.close();
  }

  sendRenderOutput(bitmap: ImageBitmap) {
    this.postToOutput({ type: 'renderOutput', bitmap }, [bitmap]);
  }

  sendCodeOverlayState(state: CodeOverlayMirrorState | null) {
    this.lastCodeOverlayState = state;

    this.postToOutput({ type: 'codeOverlayState', state });
  }

  sendSurfaceOverlayState(state: SurfaceOverlayMirrorState | null) {
    this.lastSurfaceOverlayState = state;

    this.postToOutput({ type: 'surfaceOverlayState', state });
  }

  requestSurfaceOverlayFrame(canvas: HTMLCanvasElement) {
    if (!this.hasConnectedOutputWindow()) return;

    this.pendingSurfaceOverlayCanvas = canvas;

    if (this.surfaceFrameScheduled || this.surfaceFrameInFlight) return;

    this.surfaceFrameScheduled = true;

    requestAnimationFrame(() => {
      this.surfaceFrameScheduled = false;

      const nextCanvas = this.pendingSurfaceOverlayCanvas;
      this.pendingSurfaceOverlayCanvas = null;

      if (nextCanvas) {
        this.sendSurfaceOverlayFrame(nextCanvas);
      }
    });
  }

  setOutputSurfaceInputSink(sink: OutputSurfaceInputSink | null) {
    this.outputSurfaceInputSink = sink;
  }

  openOutputWindow() {
    this.outputWindow = window.open('/output', '_blank');
  }

  hasConnectedOutputWindow() {
    return hasConnectedOutputWindow(this.outputWindow);
  }

  private async sendSurfaceOverlayFrame(canvas: HTMLCanvasElement) {
    if (this.surfaceFrameInFlight || !this.hasConnectedOutputWindow()) return;

    this.surfaceFrameInFlight = true;

    try {
      const bitmap = await createImageBitmap(canvas);

      this.postToOutput({ type: 'surfaceOverlayFrame', bitmap }, [bitmap]);
    } catch (error) {
      console.warn('[IpcSystem] Failed to mirror surface overlay frame', error);
    } finally {
      this.surfaceFrameInFlight = false;

      if (this.pendingSurfaceOverlayCanvas) {
        const nextCanvas = this.pendingSurfaceOverlayCanvas;

        this.pendingSurfaceOverlayCanvas = null;
        this.requestSurfaceOverlayFrame(nextCanvas);
      }
    }
  }

  private postToOutput(message: MainToOutputMessage, transfer?: Transferable[]) {
    this.outputWindow?.postMessage(message, {
      transfer,
      targetOrigin: '*'
    });
  }
}
