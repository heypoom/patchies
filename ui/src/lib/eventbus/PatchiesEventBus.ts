export type PatchiesEvent = GLPreviewFrameCapturedEvent | { type: 'placeholder'; foo: unknown };

export type GLPreviewFrameCapturedEvent = {
	type: 'previewFrameCaptured';
	nodeId: string;
	requestId: string;
	success: boolean;
	bitmap?: ImageBitmap;
};

type PatchiesEventListener = (event: PatchiesEvent) => void;
type PatchiesEventListenerMap = Map<PatchiesEvent['type'], PatchiesEventListener[]>;

export type PatchiesTypedEventListener<T extends PatchiesEvent['type']> = T extends PatchiesEvent
	? Extract<PatchiesEvent, { type: T }>
	: never;

export class PatchiesEventBus {
	private static instance: PatchiesEventBus;
	private listeners: PatchiesEventListenerMap = new Map();

	dispatch<E extends PatchiesEvent>(event: E): void {
		const listeners = this.listeners.get(event.type) ?? [];

		for (const listener of listeners) listener(event);
	}

	addEventListener<T extends PatchiesEvent['type']>(
		type: T,
		listener: (event: PatchiesTypedEventListener<T>) => void
	): void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, []);
		}

		this.listeners.get(type)?.push(listener as PatchiesEventListener);
	}

	removeEventListener<T extends PatchiesEvent['type']>(
		type: T,
		listener: (event: PatchiesTypedEventListener<T>) => void
	): void {
		const listeners = this.listeners.get(type);

		if (listeners) {
			this.listeners.set(
				type,
				listeners.filter((l) => l !== listener)
			);
		}
	}

	static getInstance(): PatchiesEventBus {
		if (!PatchiesEventBus.instance) {
			PatchiesEventBus.instance = new PatchiesEventBus();
		}

		return PatchiesEventBus.instance;
	}
}
