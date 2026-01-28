/**
 * Import and define all audio node classes here.
 */

import { AddNodeV2 } from './AddNode';
import { AllpassNode } from './AllpassNode';
import { BandpassNode } from './BandpassNode';
import { ChuckNode } from './ChuckNode';
import { CompressorNode } from './CompressorNode';
import { ConvolverNodeV2 } from './ConvolverNode';
import { CsoundNode } from './CsoundNode';
import { DacNode } from './DacNode';
import { DelayNodeV2 } from './DelayNode';
import { DspNode } from './DspNode';
import { ElementaryNode } from './ElementaryNode';
import { ExprNode } from './ExprNode';
import { FFTNode } from './FFTNode';
import { GainNodeV2 } from './GainNode';
import { HighpassNode } from './HighpassNode';
import { HighshelfNode } from './HighshelfNode';
import { LowpassNode } from './LowpassNode';
import { LowshelfNode } from './LowshelfNode';
import { MergeNode } from './MergeNode';
import { MicNode } from './MicNode';
import { NotchNode } from './NotchNode';
import { OscNode } from './OscNode';
import { PanNodeV2 } from './PanNode';
import { PeakingNode } from './PeakingNode';
import { SigNode } from './SigNode';
import { SplitNode } from './SplitNode';
import { SamplerNode } from './SamplerNode';
import { SonicNode } from './SonicNode';
import { SoundfileNode } from './SoundfileNode';
import { ToneNode } from './ToneNode';
import { VdoNinjaPullNode } from './VdoNinjaNode';
import { VdoNinjaPushNode } from './VdoNinjaPushNode';
import { WaveShaperNodeV2 } from './WaveShaperNode';

import { AudioRegistry } from '$lib/registry/AudioRegistry';

import type { AudioNodeClass } from '../interfaces/audio-nodes';

const AUDIO_NODES = [
	AddNodeV2,
	AllpassNode,
	BandpassNode,
	ChuckNode,
	CompressorNode,
	ConvolverNodeV2,
	CsoundNode,
	DacNode,
	DelayNodeV2,
	DspNode,
	ElementaryNode,
	ExprNode,
	FFTNode,
	GainNodeV2,
	HighpassNode,
	HighshelfNode,
	LowpassNode,
	LowshelfNode,
	MergeNode,
	MicNode,
	NotchNode,
	OscNode,
	PanNodeV2,
	PeakingNode,
	SigNode,
	SplitNode,
	SamplerNode,
	SonicNode,
	SoundfileNode,
	ToneNode,
	VdoNinjaPullNode,
	VdoNinjaPushNode,
	WaveShaperNodeV2
] as const satisfies AudioNodeClass[];

/**
 * Define all v2 audio nodes with the AudioRegistry.
 * This should be called during application initialization.
 */
export function registerAudioNodes(): void {
	const registry = AudioRegistry.getInstance();

	AUDIO_NODES.forEach((node) => registry.register(node));
}
