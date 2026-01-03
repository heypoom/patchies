/**
 * Import and define all audio node classes here.
 */

import { AddNodeV2 } from './AddNode';
import { AllpassNode } from './AllpassNode';
import { AudioService } from '../AudioService';
import { BandpassNode } from './BandpassNode';
import { CompressorNode } from './CompressorNode';
import { ConvolverNodeV2 } from './ConvolverNode';
import { DacNode } from './DacNode';
import { DelayNodeV2 } from './DelayNode';
import { FftNode } from './FftNode';
import { GainNodeV2 } from './GainNode';
import { HighpassNode } from './HighpassNode';
import { HighshelfNode } from './HighshelfNode';
import { LowpassNode } from './LowpassNode';
import { LowshelfNode } from './LowshelfNode';
import { NotchNode } from './NotchNode';
import { OscNode } from './OscNode';
import { PanNodeV2 } from './PanNode';
import { PeakingNode } from './PeakingNode';
import { SigNode } from './SigNode';
import { WaveShaperNodeV2 } from './WaveShaperNode';

import type { AudioNodeClass } from '../interfaces/audio-nodes';

const AUDIO_NODES = [
	AddNodeV2,
	AllpassNode,
	BandpassNode,
	CompressorNode,
	ConvolverNodeV2,
	DacNode,
	DelayNodeV2,
	FftNode,
	GainNodeV2,
	HighpassNode,
	HighshelfNode,
	LowpassNode,
	LowshelfNode,
	NotchNode,
	OscNode,
	PanNodeV2,
	PeakingNode,
	SigNode,
	WaveShaperNodeV2
] as const satisfies AudioNodeClass[];

/**
 * Define all v2 audio nodes with the AudioService.
 * This should be called during application initialization.
 */
export function registerAudioNodes(): void {
	const audioService = AudioService.getInstance();

	AUDIO_NODES.forEach((node) => audioService.define(node));
}
