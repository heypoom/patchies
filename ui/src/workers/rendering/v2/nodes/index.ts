/**
 * Import and register all V2 video node classes here.
 */

import { GlslNode } from './GlslNode';
import { ImgNode } from './ImgNode';

import { VideoRegistry } from '../VideoRegistry';

import type { VideoNodeClass } from '../interfaces/video-nodes';

const VIDEO_NODES = [GlslNode, ImgNode] as const satisfies readonly VideoNodeClass[];

/**
 * Register all V2 video nodes with the VideoRegistry.
 * This should be called during worker initialization.
 */
export function registerVideoNodes(): void {
	const registry = VideoRegistry.getInstance();

	VIDEO_NODES.forEach((node) => registry.register(node));
}
