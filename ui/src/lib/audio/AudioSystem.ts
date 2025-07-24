import Meyda, { type MeydaFeaturesObject } from 'meyda';
import type { MeydaAnalyzer } from 'meyda/dist/esm/meyda-wa';
import { getAudioContext } from '@strudel/webaudio';

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

	// nodeId -> AudioNode[] (Strudel's audio nodes for each node)
	private strudelAudioNodes = new Map<string, AudioNode[]>();

	// External audio nodes that should receive audio from all Strudel sources
	private externalAudioNodes = new Set<AudioNode>();

	// nodeId -> callbacks for audio analysis data
	private audioCallbacks = new Map<string, ((analysis: AudioAnalysis) => void)[]>();

	private strudelAudioContext: AudioContext;
	private strudelMeydaAnalyzer: MeydaAnalyzer;
	private strudelMeydaGainNode: GainNode;
	private previousStrudelLastNode: AudioNode | null = null;
	private isStrudelMeydaRunning = false;

	private constructor() {
		this.strudelAudioContext = getAudioContext();
		this.strudelMeydaGainNode = this.strudelAudioContext.createGain();

		this.strudelMeydaAnalyzer = Meyda.createMeydaAnalyzer({
			audioContext: this.strudelAudioContext,
			source: this.strudelMeydaGainNode,
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

				// @ts-expect-error -- audio analysis log
				window.latestAudioAnalysis = analysis;

				// Notify all registered audio sources
				for (const [sourceId] of this.audioSources) {
					this.notifyTargetsWithAnalysis(sourceId, analysis);
				}
			}
		});
	}

	static getInstance(): AudioSystem {
		if (!AudioSystem.instance) {
			AudioSystem.instance = new AudioSystem();
		}

		return AudioSystem.instance;
	}

	/**
	 * Register a node's audio source
	 */
	registerAudioSource(nodeId: string, audioNode: AudioNode): void {
		this.audioSources.set(nodeId, audioNode);
		// With the global audio tap, we don't need per-node analyzers anymore
		// The global analysis will handle all audio from superdough
		this.notifyTargets();
	}

	/**
	 * Register Strudel audio nodes for a specific node
	 */
	sendStrudelAudioNodes(objectId: string, audioNodes: AudioNode[]): void {
		const last = audioNodes[audioNodes.length - 1];
		this.strudelAudioNodes.set(objectId, audioNodes);

		if (this.previousStrudelLastNode) {
			this.previousStrudelLastNode.disconnect(this.strudelMeydaGainNode);
		}

		last.connect(this.strudelMeydaGainNode);
		this.connectExternalNodes();

		try {
			// Create Meyda analyzer using the mixer node as source
			if (!this.isStrudelMeydaRunning) {
				this.strudelMeydaAnalyzer.start();
				this.isStrudelMeydaRunning = true;
				console.log('restarting mayda');
			}
		} catch (error) {
			console.warn('Failed to setup Strudel audio analysis:', error);
		}

		this.previousStrudelLastNode = last;
	}

	/**
	 * Connect an external audio node to receive audio from all Strudel sources
	 */
	connectToStrudelAudio(externalNode: AudioNode): void {
		this.externalAudioNodes.add(externalNode);
		this.connectExternalNodes();
	}

	/**
	 * Disconnect an external audio node from Strudel sources
	 */
	disconnectFromStrudelAudio(externalNode: AudioNode): void {
		this.externalAudioNodes.delete(externalNode);

		// If no external nodes left, stop the Meyda analyzer
		if (this.externalAudioNodes.size === 0) {
			this.strudelMeydaAnalyzer?.stop();
		}
	}

	/**
	 * Connect all external nodes to current Strudel audio sources
	 */
	private connectExternalNodes(): void {
		if (!this.strudelAudioContext || this.externalAudioNodes.size === 0) return;

		for (const externalNode of this.externalAudioNodes) {
			this.strudelMeydaGainNode.connect(externalNode);
		}
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
		this.notifyTargets();
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
		this.strudelAudioNodes.delete(nodeId);
		this.audioCallbacks.delete(nodeId);

		// Remove from connections
		this.audioConnections.delete(nodeId);
		for (const [sourceId, targets] of this.audioConnections) {
			const newTargets = targets.filter((id) => id !== nodeId);
			this.audioConnections.set(sourceId, newTargets);
		}

		// If no more audio sources, stop the Meyda analyzer
		if (this.audioSources.size === 0 && this.strudelMeydaAnalyzer) {
			this.strudelMeydaAnalyzer.stop();
			this.isStrudelMeydaRunning = false;
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
			(this.audioSources.has(conn.source) && (conn.targetHandle?.startsWith('video') ?? false))
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
	private notifyTargets(): void {
		// For now, just trigger analysis setup - the actual data flow happens via callbacks
		// Could trigger initial analysis here if needed
	}

	public setStrudelPlaying(playing: boolean): void {
		if (!playing) {
			this.strudelMeydaAnalyzer?.stop();
		}
	}
}
