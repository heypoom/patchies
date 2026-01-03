import type { ChuckManager } from './ChuckManager';
import type { ToneManager } from './ToneManager';
import type { ElementaryAudioManager } from './ElementaryAudioManager';
import type { CsoundManager } from './nodes/CsoundManager';
import type { AudioNodeGroup } from './v2/interfaces/audio-nodes';

interface AudioNodeBase {
	node: AudioNode;
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
	| PatchLyriaNode
	| PatchAnalyzerNode
	| PatchMicNode
	| PatchExprNode
	| PatchChuckNode
	| PatchCompressorNode
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
export type V1PatchAudioNodeGroup = AudioNodeGroup;
