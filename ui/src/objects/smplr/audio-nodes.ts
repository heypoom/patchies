import { createSmplrAudioNodeClass } from './SmplrInstrumentAudioNode';
import { smplrDescriptors } from './descriptors';

export const SoundfontAudioNode = createSmplrAudioNodeClass(smplrDescriptors['soundfont~']);
export const Soundfont2AudioNode = createSmplrAudioNodeClass(smplrDescriptors['soundfont2~']);
export const PianoAudioNode = createSmplrAudioNodeClass(smplrDescriptors['piano~']);
export const ElectricPianoAudioNode = createSmplrAudioNodeClass(smplrDescriptors['epiano~']);
export const DrumMachineAudioNode = createSmplrAudioNodeClass(smplrDescriptors['drum-machine~']);
export const MalletAudioNode = createSmplrAudioNodeClass(smplrDescriptors['mallet~']);
export const MellotronAudioNode = createSmplrAudioNodeClass(smplrDescriptors['mellotron~']);
export const VersilianAudioNode = createSmplrAudioNodeClass(smplrDescriptors['versilian~']);
export const SmolkenAudioNode = createSmplrAudioNodeClass(smplrDescriptors['smolken~']);

export const SMPLR_AUDIO_NODES = [
  SoundfontAudioNode,
  Soundfont2AudioNode,
  PianoAudioNode,
  ElectricPianoAudioNode,
  DrumMachineAudioNode,
  MalletAudioNode,
  MellotronAudioNode,
  VersilianAudioNode,
  SmolkenAudioNode
] as const;
