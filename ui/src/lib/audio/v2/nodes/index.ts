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
import { LowpassNode } from './LowpassNode';
import { HighpassNode } from './HighpassNode';
import { BandpassNode } from './BandpassNode';
import { AllpassNode } from './AllpassNode';
import { NotchNode } from './NotchNode';
import { LowshelfNode } from './LowshelfNode';
import { HighshelfNode } from './HighshelfNode';
import { PeakingNode } from './PeakingNode';

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
	audioService.define(LowpassNode);
	audioService.define(HighpassNode);
	audioService.define(BandpassNode);
	audioService.define(AllpassNode);
	audioService.define(NotchNode);
	audioService.define(LowshelfNode);
	audioService.define(HighshelfNode);
	audioService.define(PeakingNode);
}
