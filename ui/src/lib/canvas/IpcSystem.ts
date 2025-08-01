import { match } from 'ts-pattern';

type IpcScreen = 'patch' | 'output';

type IpcEvent =
	| { type: 'renderOutput'; bitmap: ImageBitmap }
	| { type: 'outputScreenRegistered' }
	| { type: 'ackScreenRegistration' };

export class IpcSystem {
	channel = new BroadcastChannel('patchies-ipc');

	public screen: IpcScreen = 'patch';
	private static instance: IpcSystem;

	public hasOutputScreen = false;

	public onOutput = (image: ImageBitmap) => console.log('default onOutput');
	public onAckScreenRegistration = () => console.log('default onAckScreenRegistration');

	static getInstance() {
		if (!IpcSystem.instance) {
			IpcSystem.instance = new IpcSystem();
		}

		// @ts-expect-error -- expose globally for debugging
		window.ipcSystem = IpcSystem.instance;

		return IpcSystem.instance;
	}

	constructor() {
		this.channel.addEventListener('message', this.handleMessage.bind(this));
	}

	handleMessage(event: MessageEvent<IpcEvent>) {
		console.log('[ipc]', event.data.type);

		match(event.data)
			.with({ type: 'renderOutput' }, (data) => {
				console.log('[ipc] renderOutput');
				this.onOutput(data.bitmap);
			})
			.with({ type: 'ackScreenRegistration' }, () => {
				this.onAckScreenRegistration();
			})
			.with({ type: 'outputScreenRegistered' }, () => {
				this.hasOutputScreen = true;
				console.log('output screen registered!');

				if (this.screen === 'patch') {
					this.send({ type: 'ackScreenRegistration' });
				}
			});
	}

	send(event: IpcEvent) {
		this.channel.postMessage(event);
	}
}
