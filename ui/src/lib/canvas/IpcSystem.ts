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
    // Listen for output window announcing itself (handles reloads)
    window.addEventListener('message', (event) => {
      if (event.data.type === 'outputReady' && event.source) {
        this.outputWindow = event.source as Window;
      }
    });
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
