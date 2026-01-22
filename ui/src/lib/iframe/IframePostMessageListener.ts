import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

/**
 * Global listener for postMessage events from iframes.
 * Dispatches messages to the event bus so iframe nodes can filter
 * and forward messages from their own iframes.
 */
export class IframePostMessageListener {
	private static instance: IframePostMessageListener | null = null;
	private eventBus: PatchiesEventBus;
	private boundHandler: (event: MessageEvent) => void;

	private constructor() {
		this.eventBus = PatchiesEventBus.getInstance();
		this.boundHandler = this.handleMessage.bind(this);

		if (typeof window !== 'undefined') {
			window.addEventListener('message', this.boundHandler);
		}
	}

	private handleMessage(event: MessageEvent) {
		// Only dispatch if the source is a window (from an iframe)
		// Skip messages from extensions, workers, or same-window postMessages
		if (!event.source || event.source === window) {
			return;
		}

		this.eventBus.dispatch({
			type: 'iframePostMessage',
			source: event.source as Window,
			data: event.data,
			origin: event.origin
		});
	}

	static getInstance(): IframePostMessageListener {
		if (!IframePostMessageListener.instance) {
			IframePostMessageListener.instance = new IframePostMessageListener();
		}

		return IframePostMessageListener.instance;
	}

	destroy() {
		if (typeof window !== 'undefined') {
			window.removeEventListener('message', this.boundHandler);
		}

		IframePostMessageListener.instance = null;
	}
}
