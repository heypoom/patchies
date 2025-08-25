import type { Chuck } from 'webchuck';

interface PsBase {
	node: AudioNode;
}

interface PsOsc extends PsBase {
	type: 'osc';
	node: OscillatorNode;
}

interface PsGain extends PsBase {
	type: 'gain';
	node: GainNode;
}

interface PsDac extends PsBase {
	type: 'dac';
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
	type: 'fft';
	node: AnalyserNode;
}

interface PsMic extends PsBase {
	type: 'mic';
	node: GainNode;
	mediaStream?: MediaStream;
	mediaStreamSource?: MediaStreamAudioSourceNode;
}

interface PsLpf extends PsBase {
	type: 'lpf';
	node: BiquadFilterNode;
}

interface PsHpf extends PsBase {
	type: 'hpf';
	node: BiquadFilterNode;
}

interface PsBpf extends PsBase {
	type: 'bpf';
	node: BiquadFilterNode;
}

interface PsExpr extends PsBase {
	type: 'expr~';
	node: AudioWorkletNode;
}

interface PsChuck extends PsBase {
	type: 'chuck';
	node: GainNode;
	chuck?: Chuck;

	// TODO: support multiple shreds at once.
	shredId?: number;
}

export type PsAudioNode =
	| PsOsc
	| PsGain
	| PsDac
	| PsAdd
	| PsLyria
	| PsAnalyzer
	| PsMic
	| PsLpf
	| PsHpf
	| PsBpf
	| PsExpr
	| PsChuck;
export type PsAudioType = PsAudioNode['type'];
export type PsAudioNodeGroup = 'sources' | 'processors' | 'destinations';
