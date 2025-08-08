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

export type PsAudioNode = PsOsc | PsGain | PsDac | PsAdd;
export type PsAudioType = PsAudioNode['type'];
export type PsAudioNodeGroup = 'sources' | 'processors' | 'destinations';
