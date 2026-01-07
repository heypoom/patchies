// ❌ BAD: import SuperSonic from 'supersonic-scsynth';
// ❌ BAD: import type SuperSonic from 'supersonic-scsynth';
// ✅ GOOD: Use dynamic imports only

import { logger } from '$lib/utils/logger';

// Use generic types to avoid importing SuperSonic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperSonicInstance = any; // Will be actual SuperSonic instance

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SuperSonicClass = any; // Will be actual SuperSonic constructor

export class SuperSonicManager {
	private static instance: SuperSonicManager | null = null;
	private sonicInstance: SuperSonicInstance | null = null;
	private SuperSonicClass: SuperSonicClass | null = null;
	private initPromise: Promise<void> | null = null;
	private audioContext: AudioContext | null = null;

	private constructor() {}

	/**
	 * Lazy load SuperSonic only when needed.
	 * This is called when the first sonic~ node is created.
	 * @param audioContext - The AudioContext to use (should be from AudioService)
	 */
	async ensureSuperSonic(audioContext: AudioContext): Promise<{
		sonic: SuperSonicInstance;
		SuperSonic: SuperSonicClass;
	}> {
		if (!this.initPromise) {
			this.audioContext = audioContext;
			this.initPromise = this.initialize();
		}
		await this.initPromise;
		return {
			sonic: this.sonicInstance!,
			SuperSonic: this.SuperSonicClass!
		};
	}

	private async initialize(): Promise<void> {
		logger.log('Lazy loading SuperSonic...');

		if (!this.audioContext) {
			throw new Error('AudioContext must be provided to SuperSonicManager');
		}

		// Dynamic import - only loads when first sonic~ node is created
		const SuperSonicModule = await import('supersonic-scsynth');
		this.SuperSonicClass = SuperSonicModule.default || SuperSonicModule.SuperSonic;

		// Configure SuperSonic to use unpkg.com CDN for assets
		// This is necessary because the npm package only includes the main JS file
		const version = '0.25.5'; // Match package.json version
		const cdnBase = 'https://unpkg.com/';

		this.sonicInstance = new this.SuperSonicClass({
			// Use the shared AudioContext from AudioService
			audioContext: this.audioContext,

			// Disable auto-connect to speakers - we'll connect through SonicNode's gain node
			autoConnect: false,

			// Use unpkg CDN for all assets (WASM, workers, samples, synthdefs)
			coreBaseURL: `${cdnBase}supersonic-scsynth-core@${version}/`,
			sampleBaseURL: `${cdnBase}supersonic-scsynth-samples@${version}/samples/`,
			synthdefBaseURL: `${cdnBase}supersonic-scsynth-synthdefs@${version}/synthdefs/`,
			mode: 'postMessage' // Use postMessage mode (doesn't require COOP/COEP headers)
		});

		// Set up event listeners for debugging
		this.sonicInstance.on('ready', () => logger.log('SuperSonic ready'));

		this.sonicInstance.on('error', (err: unknown) => logger.error('[SuperSonic] error:', err));

		this.sonicInstance.on(
			'loading:start',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			({ type, name }: any) => logger.log(`[SuperSonic] loading ${type}: ${name}`)
		);

		this.sonicInstance.on(
			'loading:complete',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			({ type, name }: any) => logger.log(`[SuperSonic] loaded ${type}: ${name}`)
		);

		await this.sonicInstance.init();

		logger.log('[SuperSonic] initialized');
	}

	static getInstance(): SuperSonicManager {
		if (!SuperSonicManager.instance) {
			SuperSonicManager.instance = new SuperSonicManager();
		}

		return SuperSonicManager.instance;
	}

	destroy(): void {
		if (this.sonicInstance) {
			// Use shutdown() instead of destroy() to allow re-init
			this.sonicInstance.shutdown();
		}
	}
}
