import type { AudioNodeGroup } from './v2/interfaces/audio-nodes';

// No V1 audio nodes remaining - all migrated to V2 or don't use audio graph
export type V1PatchAudioNode = never;
export type V1PatchAudioType = never;
export type V1PatchAudioNodeGroup = AudioNodeGroup;
