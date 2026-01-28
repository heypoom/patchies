/**
 * Global VDO.Ninja SDK loader
 * Ensures the SDK is only loaded once across all nodes
 */

/**
 * Configuration options for VDONinjaSDK constructor
 */
export interface VDONinjaSDKOptions {
	/** WebSocket signaling server URL (default: 'wss://wss.vdo.ninja') */
	host?: string;

	/** Room name to join on connect */
	room?: string;

	/** Room password (default: "someEncryptionKey123", false to disable encryption) */
	password?: string | false;

	/** Enable debug logging (default: false) */
	debug?: boolean;

	/**
	 * TURN server configuration:
	 * - undefined/null: Auto-fetch optimal TURN servers from API (default)
	 * - false: Disable TURN servers, use only STUN
	 * - Array: Custom TURN server configuration
	 */
	turnServers?: RTCIceServer[] | false | null;

	/** Force relay mode through TURN servers for privacy (default: false) */
	forceTURN?: boolean;

	/** TURN server cache time-to-live in minutes (default: 5) */
	turnCacheTTL?: number;

	/** STUN server configuration (default: Google & VDO.Ninja STUN servers) */
	stunServers?: RTCIceServer[];

	/** Maximum reconnection attempts (default: 5) */
	maxReconnectAttempts?: number;

	/** Initial reconnection delay in ms (default: 1000) */
	reconnectDelay?: number;

	/** Enable viewer-side auto ping (default: false) */
	autoPingViewer?: boolean;

	/** Auto ping interval in ms (default: 10000) */
	autoPingInterval?: number;

	salt?: string;
}

export interface VDONinjaSDK {
	connect(): Promise<void>;

	/** Join a room. Pass password: null to disable hashing. */
	joinRoom(opts: { room: string; password?: string | null }): Promise<void>;

	announce(opts: { streamID: string }): Promise<void>;
	publish(stream: MediaStream, opts?: { streamID?: string }): Promise<void>;
	view(streamId: string, opts?: { audio?: boolean; video?: boolean }): Promise<RTCPeerConnection>;
	sendData(data: unknown, opts?: { allowFallback?: boolean }): void;
	disconnect(): void;
	addEventListener(event: string, handler: (e: CustomEvent) => void): void;
	removeEventListener(event: string, handler: (e: CustomEvent) => void): void;

	/** Auto-connect mode for simpler data-only mesh networking */
	autoConnect(room?: string, opts?: { streamID?: string }): Promise<void>;

	salt?: string;
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
	if (
		(window as unknown as { VDONinjaSDK?: new (options?: VDONinjaSDKOptions) => VDONinjaSDK })
			.VDONinjaSDK
	) {
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
export function getVdoNinjaSdkConstructor(): new (options?: VDONinjaSDKOptions) => VDONinjaSDK {
	const sdk = (
		window as unknown as { VDONinjaSDK?: new (options?: VDONinjaSDKOptions) => VDONinjaSDK }
	).VDONinjaSDK;

	if (!sdk) {
		throw new Error('VDO.Ninja SDK not loaded');
	}

	return sdk;
}

/**
 * Create a new VDO.Ninja SDK instance
 * @param options - Configuration options for the SDK instance
 */
export function createVdoNinjaInstance(options?: VDONinjaSDKOptions): VDONinjaSDK {
	const Constructor = getVdoNinjaSdkConstructor();

	return new Constructor(options);
}
