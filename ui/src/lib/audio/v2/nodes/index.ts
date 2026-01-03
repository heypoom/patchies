/**
 * Node definition file.
 * Import and define all v2 audio nodes here.
 */

import { AudioService } from '../AudioService';
import { OscNode } from './OscNode';
import { GainNodeV2 } from './GainNode';
import { DacNode } from './DacNode';
import { SigNode } from './SigNode';
import { AddNodeV2 } from './AddNode';
import { PanNodeV2 } from './PanNode';
import { DelayNodeV2 } from './DelayNode';

/**
 * Define all v2 audio nodes with the AudioService.
 * This should be called during application initialization.
 */
export function registerAudioNodes(): void {
	const audioService = AudioService.getInstance();

	audioService.define(OscNode);
	audioService.define(GainNodeV2);
	audioService.define(DacNode);
	audioService.define(SigNode);
	audioService.define(AddNodeV2);
	audioService.define(PanNodeV2);
	audioService.define(DelayNodeV2);
}
