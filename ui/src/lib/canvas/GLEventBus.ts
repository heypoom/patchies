export type GLEvent = GLPreviewFrameCapturedEvent | { type: 'placeholder'; foo: unknown };

export type GLPreviewFrameCapturedEvent = {
	type: 'previewFrameCaptured';
	nodeId: string;
	requestId: string;
	success: boolean;
	bitmap?: ImageBitmap;
};

type GLEventListener = (event: GLEvent) => void;
type GLEventListenerMap = Map<GLEvent['type'], GLEventListener[]>;

export type GLTypedEventListener<T extends GLEvent['type']> = T extends GLEvent
	? Extract<GLEvent, { type: T }>
	: never;

export class GLEventBus {
	private static instance: GLEventBus;
	private listeners: GLEventListenerMap = new Map();

	dispatch<E extends GLEvent>(event: E): void {
		const listeners = this.listeners.get(event.type) ?? [];

		for (const listener of listeners) listener(event);
	}

	addEventListener<T extends GLEvent['type']>(
		type: T,
		listener: (event: GLTypedEventListener<T>) => void
	): void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, []);
		}

		this.listeners.get(type)?.push(listener as GLEventListener);
	}

	removeEventListener<T extends GLEvent['type']>(
		type: T,
		listener: (event: GLTypedEventListener<T>) => void
	): void {
		const listeners = this.listeners.get(type);

		if (listeners) {
			this.listeners.set(
				type,
				listeners.filter((l) => l !== listener)
			);
		}
	}

	static getInstance(): GLEventBus {
		if (!GLEventBus.instance) {
			GLEventBus.instance = new GLEventBus();
		}

		return GLEventBus.instance;
	}
}
