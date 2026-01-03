import type { ChuckManager } from './ChuckManager';
import type { ToneManager } from './ToneManager';
import type { ElementaryAudioManager } from './ElementaryAudioManager';
import type { CsoundManager } from './nodes/CsoundManager';

interface AudioNodeBase {
	node: AudioNode;
}

interface PatchDacNode extends AudioNodeBase {
	type: 'dac~';
	node: GainNode; // dac uses the outGain node
}

interface PatchAddNode extends AudioNodeBase {
	type: '+~';
	node: GainNode;
}

/**
 * Lyria music generator by Google DeepMind.
 * Used by the `AiMusicNode`.
 **/
interface PatchLyriaNode extends AudioNodeBase {
	type: 'lyria';
	node: GainNode;
}

interface PatchAnalyzerNode extends AudioNodeBase {
	type: 'fft~';
	node: AnalyserNode;
}

interface PatchMicNode extends AudioNodeBase {
	type: 'mic~';
	node: GainNode;
	mediaStream?: MediaStream;
	mediaStreamSource?: MediaStreamAudioSourceNode;
}

interface PatchLowpassNode extends AudioNodeBase {
	type: 'lowpass~';
	node: BiquadFilterNode;
}

interface PatchHighpassNode extends AudioNodeBase {
	type: 'highpass~';
	node: BiquadFilterNode;
}

interface PatchBandpassNode extends AudioNodeBase {
	type: 'bandpass~';
	node: BiquadFilterNode;
}

interface PatchAllpassNode extends AudioNodeBase {
	type: 'allpass~';
	node: BiquadFilterNode;
}

interface PatchNotchNode extends AudioNodeBase {
	type: 'notch~';
	node: BiquadFilterNode;
}

interface PatchLowshelfNode extends AudioNodeBase {
	type: 'lowshelf~';
	node: BiquadFilterNode;
}

interface PatchHighshelfNode extends AudioNodeBase {
	type: 'highshelf~';
	node: BiquadFilterNode;
}

interface PatchPeakingNode extends AudioNodeBase {
	type: 'peaking~';
	node: BiquadFilterNode;
}

interface PatchExprNode extends AudioNodeBase {
	type: 'expr~';
	node: AudioWorkletNode;
}

interface PatchChuckNode extends AudioNodeBase {
	type: 'chuck';
	node: GainNode;
	chuckManager?: ChuckManager;
}

interface PatchCompressorNode extends AudioNodeBase {
	type: 'compressor~';
	node: DynamicsCompressorNode;
}

interface PatchPanNode extends AudioNodeBase {
	type: 'pan~';
	node: StereoPannerNode;
}

interface PatchSigNode extends AudioNodeBase {
	type: 'sig~';
	node: ConstantSourceNode;
}

interface PatchDelayNode extends AudioNodeBase {
	type: 'delay~';
	node: DelayNode;
}

interface PatchSoundfileNode extends AudioNodeBase {
	type: 'soundfile~';
	node: MediaElementAudioSourceNode;
	audioElement: HTMLAudioElement;
}

interface PatchWaveshaperNode extends AudioNodeBase {
	type: 'waveshaper~';
	node: WaveShaperNode;
}

interface PatchSamplerNode extends AudioNodeBase {
	type: 'sampler~';
	node: GainNode;
	destinationNode: MediaStreamAudioDestinationNode;
	mediaRecorder?: MediaRecorder;
	audioBuffer?: AudioBuffer;
	sourceNode?: AudioBufferSourceNode;
	loopStart?: number;
	loopEnd?: number;
	playbackRate?: number;
	detune?: number;
}

interface PatchConvolverNode extends AudioNodeBase {
	type: 'convolver~';
	node: ConvolverNode;
}

interface PatchStrudelNode extends AudioNodeBase {
	type: 'strudel';
	node: GainNode;
}

interface PatchDspNode extends AudioNodeBase {
	type: 'dsp~';
	node: AudioWorkletNode;
}

interface PatchToneNode extends AudioNodeBase {
	type: 'tone~';
	node: GainNode;
	inputNode: GainNode;
	toneManager?: ToneManager;
}

interface PatchElementaryNode extends AudioNodeBase {
	type: 'elem~';
	node: GainNode;
	inputNode: GainNode;
	elementaryManager?: ElementaryAudioManager;
}

interface PatchCsoundNode extends AudioNodeBase {
	type: 'csound~';
	node: GainNode;
	inputNode: GainNode;
	csoundManager?: CsoundManager;
}

interface PatchChannelMergerNode extends AudioNodeBase {
	type: 'merge~';
	node: ChannelMergerNode;
}

interface PatchChannelSplitterNode extends AudioNodeBase {
	type: 'split~';
	node: ChannelSplitterNode;
}

export type V1PatchAudioNode =
	| PatchDacNode
	| PatchAddNode
	| PatchLyriaNode
	| PatchAnalyzerNode
	| PatchMicNode
	| PatchLowpassNode
	| PatchHighpassNode
	| PatchBandpassNode
	| PatchAllpassNode
	| PatchNotchNode
	| PatchLowshelfNode
	| PatchHighshelfNode
	| PatchPeakingNode
	| PatchExprNode
	| PatchChuckNode
	| PatchCompressorNode
	| PatchPanNode
	| PatchSigNode
	| PatchDelayNode
	| PatchSoundfileNode
	| PatchWaveshaperNode
	| PatchSamplerNode
	| PatchConvolverNode
	| PatchStrudelNode
	| PatchDspNode
	| PatchToneNode
	| PatchElementaryNode
	| PatchCsoundNode
	| PatchChannelMergerNode
	| PatchChannelSplitterNode;

export type V1PatchAudioType = V1PatchAudioNode['type'];
export type V1PatchAudioNodeGroup = 'sources' | 'processors' | 'destinations';
