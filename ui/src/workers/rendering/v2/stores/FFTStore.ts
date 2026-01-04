import type regl from 'regl';

import type {
	AudioAnalysisType,
	AudioAnalysisPayloadWithType,
	GlslFFTInletMeta
} from '$lib/audio/AudioAnalysisSystem';

/**
 * FFTStore manages FFT textures and inlet bindings for audio analysis.
 * GLSL nodes use this store to access FFT data as textures during render.
 */
export class FFTStore {
	/** FFT textures: analyzerNodeId -> analysisType -> texture */
	private textures = new Map<string, Map<AudioAnalysisType, regl.Texture2D>>();

	/** FFT inlet bindings: nodeId -> inlet metadata */
	private inlets = new Map<string, GlslFFTInletMeta>();

	/**
	 * Get an FFT texture for a specific analyzer and analysis type.
	 */
	getTexture(analyzerNodeId: string, type: AudioAnalysisType): regl.Texture2D | undefined {
		return this.textures.get(analyzerNodeId)?.get(type);
	}

	/**
	 * Set an FFT texture for a specific analyzer and analysis type.
	 */
	setTexture(analyzerNodeId: string, type: AudioAnalysisType, texture: regl.Texture2D): void {
		if (!this.textures.has(analyzerNodeId)) {
			this.textures.set(analyzerNodeId, new Map());
		}

		this.textures.get(analyzerNodeId)!.set(type, texture);
	}

	/**
	 * Update FFT texture from payload, creating or updating the texture as needed.
	 */
	updateFromPayload(payload: AudioAnalysisPayloadWithType, reglInstance: regl.Regl): void {
		// TODO: support multiple inlets
		const inlet = payload.inlets?.[0];
		if (!inlet) return;

		const { analyzerNodeId } = inlet;

		// Store the FFT inlet associated with the node
		// TODO: support multiple inlets
		// TODO: only do this once instead of on every single frame
		this.inlets.set(payload.nodeId, inlet);

		if (!this.textures.has(analyzerNodeId)) {
			this.textures.set(analyzerNodeId, new Map());
		}

		const textureByAnalyzer = this.textures.get(analyzerNodeId)!;
		const existingTexture = textureByAnalyzer.get(payload.analysisType);

		const width = payload.array.length;
		const height = 1;

		const shouldCreateNewTexture = !existingTexture || existingTexture.height !== 1;

		// The existing texture is unsuitable for FFT. We must delete it.
		if (existingTexture && shouldCreateNewTexture) {
			existingTexture.destroy();
		}

		const texType = payload.format === 'int' ? 'uint8' : 'float';
		const texFormat = 'luminance';

		if (shouldCreateNewTexture) {
			const nextTexture = reglInstance.texture({
				width,
				height,
				data: payload.array,
				format: texFormat,
				type: texType,
				wrapS: 'clamp',
				wrapT: 'clamp',
				min: 'nearest',
				mag: 'nearest'
			});

			textureByAnalyzer.set(payload.analysisType, nextTexture);
		} else {
			existingTexture({
				width,
				height,
				data: payload.array,
				format: texFormat,
				type: texType
			});
		}
	}

	/**
	 * Get the FFT inlet metadata for a specific node.
	 */
	getInlet(nodeId: string): GlslFFTInletMeta | undefined {
		return this.inlets.get(nodeId);
	}

	/**
	 * Set the FFT inlet metadata for a specific node.
	 */
	setInlet(nodeId: string, inlet: GlslFFTInletMeta): void {
		this.inlets.set(nodeId, inlet);
	}

	/**
	 * Clear all FFT data for a specific node.
	 */
	clearNode(nodeId: string): void {
		this.inlets.delete(nodeId);
		// Note: We don't delete textures as they are shared across nodes
	}
}
