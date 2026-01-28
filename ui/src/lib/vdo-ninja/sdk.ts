/**
 * Global VDO.Ninja SDK loader
 * Ensures the SDK is only loaded once across all nodes
 */

export interface VDONinjaSDK {
	connect(): Promise<void>;
	joinRoom(opts: { room: string; password?: string }): Promise<void>;
	announce(opts: { streamId: string }): Promise<void>;
	publish(stream: MediaStream, opts: { streamId?: string }): Promise<void>;
	view(streamId: string, opts?: { audio?: boolean; video?: boolean }): Promise<RTCPeerConnection>;
	sendData(data: unknown, opts?: { allowFallback?: boolean }): void;
	disconnect(): void;
	addEventListener(event: string, handler: (e: CustomEvent) => void): void;
	removeEventListener(event: string, handler: (e: CustomEvent) => void): void;
	// Auto-connect mode for simpler data-only mesh networking
	autoConnect(room: string, opts?: { streamId?: string }): Promise<void>;
}

type SDKState = 'idle' | 'loading' | 'loaded' | 'error';

let sdkState: SDKState = 'idle';
let sdkPromise: Promise<void> | null = null;
let sdkError: Error | null = null;

const SDK_URL = 'https://cdn.jsdelivr.net/gh/steveseguin/ninjasdk@latest/vdoninja-sdk.min.js';

/**
 * Load the VDO.Ninja SDK. Safe to call multiple times - will only load once.
 */
export async function loadVdoNinjaSdk(): Promise<void> {
	// Already loaded
	if (sdkState === 'loaded') {
		return;
	}

	// Already errored
	if (sdkState === 'error' && sdkError) {
		throw sdkError;
	}

	// Already loading - wait for the existing promise
	if (sdkState === 'loading' && sdkPromise) {
		return sdkPromise;
	}

	// Check if SDK is already in window (e.g., loaded by another means)
	if ((window as unknown as { VDONinjaSDK?: new () => VDONinjaSDK }).VDONinjaSDK) {
		sdkState = 'loaded';
		return;
	}

	// Start loading
	sdkState = 'loading';

	sdkPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = SDK_URL;
		script.onload = () => {
			sdkState = 'loaded';
			resolve();
		};

		script.onerror = () => {
			sdkState = 'error';
			sdkError = new Error('Failed to load VDO.Ninja SDK');
			reject(sdkError);
		};

		document.head.appendChild(script);
	});

	return sdkPromise;
}

/**
 * Check if the SDK is loaded
 */
export function isVdoNinjaSdkLoaded(): boolean {
	return sdkState === 'loaded';
}

/**
 * Get the VDONinjaSDK constructor from window
 */
export function getVdoNinjaSdkConstructor(): new () => VDONinjaSDK {
	const sdk = (window as unknown as { VDONinjaSDK?: new () => VDONinjaSDK }).VDONinjaSDK;

	if (!sdk) {
		throw new Error('VDO.Ninja SDK not loaded');
	}

	return sdk;
}

/**
 * Create a new VDO.Ninja SDK instance
 */
export function createVdoNinjaInstance(): VDONinjaSDK {
	const Constructor = getVdoNinjaSdkConstructor();
	return new Constructor();
}
