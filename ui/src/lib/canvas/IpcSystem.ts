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

	sendRenderOutput(bitmap: ImageBitmap) {
		this.outputWindow?.postMessage(
			{ type: 'renderOutput', bitmap },
			{ transfer: [bitmap], targetOrigin: '*' }
		);
	}

	openOutputWindow() {
		this.outputWindow = window.open('/output', '_blank');

		this.outputWindow?.addEventListener('close', () => {
			this.outputWindow = null;
		});
	}
}
