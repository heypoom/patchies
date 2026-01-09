import type regl from 'regl';
import type { RenderParams } from '$lib/rendering/types';
import type { Message } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { VideoContext } from '../VideoContext';
import type { UniformsStore } from '../stores/UniformsStore';
import type { FFTStore } from '../stores/FFTStore';
import type { TextureStore } from '../stores/TextureStore';

/**
 * Video node group type.
 * - generators: Nodes that generate video (no inputs, has outputs)
 * - processors: Nodes that process video (has inputs and outputs)
 * - outputs: Nodes that output video (has inputs, no outputs)
 */
export type VideoNodeGroup = 'generators' | 'processors' | 'outputs';

/**
 * Container for all persistent stores that nodes can access.
 */
export interface VideoStores {
	uniforms: UniformsStore;
	fft: FFTStore;
	textures: TextureStore;
}

/**
 * Interface for V2 video nodes.
 * All video node classes must implement this interface.
 */
export interface VideoNodeV2 {
	/** Unique identifier for this node */
	readonly nodeId: string;

	/** The framebuffer this node renders to */
	readonly framebuffer: regl.Framebuffer2D;

	/** The texture attached to the framebuffer */
	readonly texture: regl.Texture2D;

	/**
	 * Initialize the node with data and stores.
	 * Optional: if not implemented, node has no initialization logic.
	 * Can be async for nodes that need to load resources (e.g., libraries).
	 *
	 * @param data - Node-specific data (e.g., code, settings)
	 * @param stores - Access to persistent stores
	 */
	create?(data: unknown, stores: VideoStores): Promise<void> | void;

	/**
	 * Render a frame.
	 * Optional: if not implemented, node doesn't render (e.g., passthrough nodes).
	 *
	 * @param params - Rendering parameters (time, frame count, etc.)
	 * @param inputs - Input textures mapped by inlet index
	 */
	render?(params: RenderParams, inputs: Map<number, regl.Texture2D>): void;

	/**
	 * Handle incoming messages.
	 * Optional: if not implemented, node doesn't handle messages.
	 *
	 * @param data - Message data
	 * @param message - Full message object with metadata
	 */
	onMessage?(data: unknown, message: Message): void;

	/**
	 * Receive FFT data for audio analysis.
	 * Optional: only implement for nodes that support FFT (e.g., Hydra, Canvas).
	 *
	 * @param payload - FFT analysis data
	 */
	setFFTData?(payload: AudioAnalysisPayloadWithType): void;

	/**
	 * Clean up resources.
	 * Optional: if not implemented, only framebuffer and texture are cleaned up.
	 */
	destroy?(): void;
}

/**
 * Constructor signature for video node classes.
 */
export type VideoNodeConstructor = new (nodeId: string, ctx: VideoContext) => VideoNodeV2;

/**
 * Video node class type including required static properties.
 */
export type VideoNodeClass = {
	/** Type identifier of the video node (e.g., 'glsl', 'hydra') */
	type: string;

	/** Group of the video node */
	group: VideoNodeGroup;
} & VideoNodeConstructor;
