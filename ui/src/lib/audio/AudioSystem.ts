import Meyda, { type MeydaFeaturesObject } from 'meyda';
import type { MeydaAnalyzer } from 'meyda/dist/esm/meyda-wa';

/**
 * Standardized audio analysis data structure
 */
export interface AudioAnalysis {
	rms: number; // Root mean square (overall loudness)
	spectralCentroid: number; // Brightness of the sound (timbral centroid)
	zcr: number; // Zero crossing rate (noisiness vs smoothness)
	spectrum?: Float32Array; // FFT binning with amplitude spectrum
	timestamp: number; // Audio context time
}

/**
 * AudioSystem manages audio connections and analysis between audio nodes
 * for the audio analysis feature.
 */
export class AudioSystem {
	private static instance: AudioSystem;

	// sourceNodeId -> [targetNodeIds]
	private audioConnections = new Map<string, string[]>();

	// nodeId -> AudioNode (audio source)
	private audioSources = new Map<string, AudioNode>();

	// nodeId -> callbacks for audio analysis data
	private audioCallbacks = new Map<string, ((analysis: AudioAnalysis) => void)[]>();

	private strudelAudioContext: AudioContext | null = null;
	private strudelMeydaAnalyzer: MeydaAnalyzer | null = null;

	private constructor() {}

	static getInstance(): AudioSystem {
		if (!AudioSystem.instance) {
			AudioSystem.instance = new AudioSystem();
		}

		return AudioSystem.instance;
	}

	/**
	 * Set the Strudel audio context (should be the same one used by Strudel/superdough)
	 */
	setStrudelAudioContext(context: AudioContext): void {
		this.strudelAudioContext = context;
		this.setupStrudelAudioTap();
	}

	/**
	 * Set up Meyda analyzer to analyze Strudel audio output
	 */
	private setupStrudelAudioTap(): void {
		if (!this.strudelAudioContext) return;

		try {
			// Create Meyda analyzer to analyze all audio in the context
			const analyzer = Meyda.createMeydaAnalyzer({
				audioContext: this.strudelAudioContext,
				source: this.strudelAudioContext.destination,
				bufferSize: 512,
				featureExtractors: ['rms', 'spectralCentroid', 'zcr', 'amplitudeSpectrum'],
				callback: (features: Partial<MeydaFeaturesObject>) => {
					const analysis: AudioAnalysis = {
						rms: features.rms ?? 0,
						spectralCentroid: features.spectralCentroid ?? 0,
						zcr: features.zcr ?? 0,
						spectrum: features.amplitudeSpectrum,
						timestamp: this.strudelAudioContext!.currentTime
					};

					// Notify all registered audio sources
					for (const [sourceId] of this.audioSources) {
						this.notifyTargetsWithAnalysis(sourceId, analysis);
					}
				}
			});

			analyzer.start();

			this.strudelMeydaAnalyzer = analyzer;
		} catch (error) {
			console.warn('Failed to setup Strudel audio analysis:', error);
		}
	}

	/**
	 * Register a node's audio source
	 */
	registerAudioSource(nodeId: string, audioNode: AudioNode): void {
		this.audioSources.set(nodeId, audioNode);
		// With the global audio tap, we don't need per-node analyzers anymore
		// The global analysis will handle all audio from superdough
		this.notifyTargets(nodeId);
	}

	/**
	 * Update audio connections when XYFlow connections change
	 */
	updateAudioConnections(
		connections: Array<{
			source: string;
			target: string;
			sourceHandle?: string;
			targetHandle?: string;
		}>
	): void {
		// Clear existing connections
		this.audioConnections.clear();

		// Rebuild connections - for now, any connection from strudel to p5/hydra is audio
		for (const conn of connections) {
			// Look for connections from strudel nodes to visual nodes
			if (this.isAudioConnection(conn)) {
				const sourceTargets = this.audioConnections.get(conn.source) || [];
				sourceTargets.push(conn.target);
				this.audioConnections.set(conn.source, sourceTargets);
			}
		}

		// Notify all targets of changes
		for (const [sourceId] of this.audioConnections) {
			this.notifyTargets(sourceId);
		}
	}

	/**
	 * Subscribe to audio analysis data for a target node
	 */
	onAudioAnalysis(nodeId: string, callback: (analysis: AudioAnalysis) => void): void {
		const callbacks = this.audioCallbacks.get(nodeId) || [];
		callbacks.push(callback);
		this.audioCallbacks.set(nodeId, callbacks);
	}

	/**
	 * Unregister a node when it's destroyed
	 */
	unregisterNode(nodeId: string): void {
		this.audioSources.delete(nodeId);
		this.audioCallbacks.delete(nodeId);

		// Remove from connections
		this.audioConnections.delete(nodeId);
		for (const [sourceId, targets] of this.audioConnections) {
			const newTargets = targets.filter((id) => id !== nodeId);
			this.audioConnections.set(sourceId, newTargets);
		}

		// If no more audio sources, stop the Meyda analyzer
		if (this.audioSources.size === 0 && this.strudelMeydaAnalyzer) {
			(this.strudelMeydaAnalyzer as any).stop();
			this.strudelMeydaAnalyzer = null;
		}
	}

	/**
	 * Determine if a connection should be treated as an audio connection
	 */
	private isAudioConnection(conn: {
		source: string;
		target: string;
		sourceHandle?: string;
		targetHandle?: string;
	}): boolean {
		// Check if this is an audio handle connection (audio-out from strudel to video-in on visual nodes)
		return (
			conn.sourceHandle === 'audio-out' ||
			(this.audioSources.has(conn.source) && conn.targetHandle?.startsWith('video'))
		);
	}

	/**
	 * Notify target nodes of audio analysis updates
	 */
	private notifyTargetsWithAnalysis(sourceId: string, analysis: AudioAnalysis): void {
		const targets = this.audioConnections.get(sourceId) || [];

		for (const targetId of targets) {
			const callbacks = this.audioCallbacks.get(targetId) || [];

			for (const callback of callbacks) {
				callback(analysis);
			}
		}
	}

	/**
	 * Notify target nodes of connection changes
	 */
	private notifyTargets(sourceId: string): void {
		// For now, just trigger analysis setup - the actual data flow happens via callbacks
		const targets = this.audioConnections.get(sourceId) || [];
		// Could trigger initial analysis here if needed
	}
}
