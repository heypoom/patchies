/**
 * Node definition file.
 * Import and define all v2 audio nodes here.
 */

import { AudioService } from '../AudioService';
import { OscNode } from './OscNode';
import { GainNodeV2 } from './GainNode';

/**
 * Define all v2 audio nodes with the AudioService.
 * This should be called during application initialization.
 */
export function registerAudioNodes(): void {
	const audioService = AudioService.getInstance();

	audioService.define(OscNode);
	audioService.define(GainNodeV2);
}
