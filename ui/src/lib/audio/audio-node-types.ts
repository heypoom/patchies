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

interface PatchStrudelNode extends AudioNodeBase {
	type: 'strudel';
	node: GainNode;
}

interface PatchCsoundNode extends AudioNodeBase {
	type: 'csound~';
	node: GainNode;
	inputNode: GainNode;
	csoundManager?: CsoundManager;
}

export type V1PatchAudioNode = PatchLyriaNode | PatchStrudelNode | PatchCsoundNode;

export type V1PatchAudioType = V1PatchAudioNode['type'];
export type V1PatchAudioNodeGroup = AudioNodeGroup;
