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

interface PatchChuckNode extends AudioNodeBase {
	type: 'chuck';
	node: GainNode;
	chuckManager?: ChuckManager;
}

interface PatchStrudelNode extends AudioNodeBase {
	type: 'strudel';
	node: GainNode;
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

export type V1PatchAudioNode =
	| PatchLyriaNode
	| PatchChuckNode
	| PatchStrudelNode
	| PatchToneNode
	| PatchElementaryNode
	| PatchCsoundNode;

export type V1PatchAudioType = V1PatchAudioNode['type'];
export type V1PatchAudioNodeGroup = AudioNodeGroup;
