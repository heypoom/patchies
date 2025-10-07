import type { ChuckManager } from './ChuckManager';
import type { ToneManager } from './ToneManager';
import type { ElementaryAudioManager } from './ElementaryAudioManager';
import type { CsoundManager } from './nodes/CsoundManager';

interface PsBase {
	node: AudioNode;
}

interface PsOsc extends PsBase {
	type: 'osc~';
	node: OscillatorNode;
}

interface PsGain extends PsBase {
	type: 'gain~';
	node: GainNode;
}

interface PsDac extends PsBase {
	type: 'dac~';
	node: GainNode; // dac uses the outGain node
}

interface PsAdd extends PsBase {
	type: '+~';
	node: GainNode;
}

/**
 * Lyria music generator by Google DeepMind.
 * Used by the `AiMusicNode`.
 **/
interface PsLyria extends PsBase {
	type: 'lyria';
	node: GainNode;
}

interface PsAnalyzer extends PsBase {
	type: 'fft~';
	node: AnalyserNode;
}

interface PsMic extends PsBase {
	type: 'mic~';
	node: GainNode;
	mediaStream?: MediaStream;
	mediaStreamSource?: MediaStreamAudioSourceNode;
}

interface PsLowpass extends PsBase {
	type: 'lowpass~';
	node: BiquadFilterNode;
}

interface PsHighpass extends PsBase {
	type: 'highpass~';
	node: BiquadFilterNode;
}

interface PsBandpass extends PsBase {
	type: 'bandpass~';
	node: BiquadFilterNode;
}

interface PsAllpass extends PsBase {
	type: 'allpass~';
	node: BiquadFilterNode;
}

interface PsNotch extends PsBase {
	type: 'notch~';
	node: BiquadFilterNode;
}

interface PsLowshelf extends PsBase {
	type: 'lowshelf~';
	node: BiquadFilterNode;
}

interface PsHighshelf extends PsBase {
	type: 'highshelf~';
	node: BiquadFilterNode;
}

interface PsPeaking extends PsBase {
	type: 'peaking~';
	node: BiquadFilterNode;
}

interface PsExpr extends PsBase {
	type: 'expr~';
	node: AudioWorkletNode;
}

interface PsChuck extends PsBase {
	type: 'chuck';
	node: GainNode;
	chuckManager?: ChuckManager;
}

interface PsCompressor extends PsBase {
	type: 'compressor~';
	node: DynamicsCompressorNode;
}

interface PsPan extends PsBase {
	type: 'pan~';
	node: StereoPannerNode;
}

interface PsSig extends PsBase {
	type: 'sig~';
	node: ConstantSourceNode;
}

interface PsDelay extends PsBase {
	type: 'delay~';
	node: DelayNode;
}

interface PsSoundfile extends PsBase {
	type: 'soundfile~';
	node: MediaElementAudioSourceNode;
	audioElement: HTMLAudioElement;
}

interface PsWaveshaper extends PsBase {
	type: 'waveshaper~';
	node: WaveShaperNode;
}

interface PsSampler extends PsBase {
	type: 'sampler~';
	node: GainNode;
	destinationNode: MediaStreamAudioDestinationNode;
	mediaRecorder?: MediaRecorder;
	audioBuffer?: AudioBuffer;
	sourceNode?: AudioBufferSourceNode;
}

interface PsConvolver extends PsBase {
	type: 'convolver~';
	node: ConvolverNode;
}

interface PsStrudel extends PsBase {
	type: 'strudel';
	node: GainNode;
}

interface PsDsp extends PsBase {
	type: 'dsp~';
	node: AudioWorkletNode;
}

interface PsTone extends PsBase {
	type: 'tone~';
	node: GainNode;
	inputNode: GainNode;
	toneManager?: ToneManager;
}

interface PsElementary extends PsBase {
	type: 'elem~';
	node: GainNode;
	inputNode: GainNode;
	elementaryManager?: ElementaryAudioManager;
}

interface PsCsound extends PsBase {
	type: 'csound~';
	node: GainNode;
	inputNode: GainNode;
	csoundManager?: CsoundManager;
}

interface PsChannelMerger extends PsBase {
	type: 'merge~';
	node: ChannelMergerNode;
}

interface PsChannelSplitter extends PsBase {
	type: 'split~';
	node: ChannelSplitterNode;
}

export type PsAudioNode =
	| PsOsc
	| PsGain
	| PsDac
	| PsAdd
	| PsLyria
	| PsAnalyzer
	| PsMic
	| PsLowpass
	| PsHighpass
	| PsBandpass
	| PsAllpass
	| PsNotch
	| PsLowshelf
	| PsHighshelf
	| PsPeaking
	| PsExpr
	| PsChuck
	| PsCompressor
	| PsPan
	| PsSig
	| PsDelay
	| PsSoundfile
	| PsWaveshaper
	| PsSampler
	| PsConvolver
	| PsStrudel
	| PsDsp
	| PsTone
	| PsElementary
	| PsCsound
	| PsChannelMerger
	| PsChannelSplitter;

export type PsAudioType = PsAudioNode['type'];
export type PsAudioNodeGroup = 'sources' | 'processors' | 'destinations';
