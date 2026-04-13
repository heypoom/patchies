const IPC_CHANNEL = 'patchies-ipc';

export class IpcSystem {
  private static instance: IpcSystem;

  public outputWindow: Window | null = null;

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
      if (event.data.type === 'outputReady' && event.source) {
        this.outputWindow = event.source as Window;
      }
    });

    // Ping any existing output windows to re-announce (handles main page reload)
    const channel = new BroadcastChannel(IPC_CHANNEL);
    channel.postMessage({ type: 'ping' });
    channel.close();
  }

  sendRenderOutput(bitmap: ImageBitmap) {
    this.outputWindow?.postMessage(
      { type: 'renderOutput', bitmap },
      { transfer: [bitmap], targetOrigin: '*' }
    );
  }

  openOutputWindow() {
    this.outputWindow = window.open('/output', '_blank');
  }
}
