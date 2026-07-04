/**
 * Import and define all audio node classes here.
 */

import { AddNode } from '$objects/audio-math/native-dsp/nodes/add.node';
import { BeatNode } from '$objects/beat~/native-dsp/nodes/beat.node';
import { AiSttAudioNode } from '$objects/ai-stt-audio/AiSttAudioNode';
import { AllpassNode } from '$objects/allpass~/AllpassNode';
import { BandpassNode } from '$objects/bandpass~/BandpassNode';
import { ChuckNode } from '$objects/chuck~/ChuckNode';
import { CompressorNode } from '$objects/compressor~/CompressorNode';
import { ConvolverNodeV2 } from '$objects/convolver~/ConvolverNode';
import { CsoundNode } from '$objects/csound~/CsoundNode';
import { AudioOutputNode } from '$objects/out~/AudioOutputNode';
import { DelayNodeV2 } from '$objects/delay~/DelayNode';
import { DspNode } from '$objects/dsp~/DspNode';
import { ElementaryNode } from '$objects/elem~/ElementaryNode';
import { ExprNode } from '$objects/expr~/ExprNode';
import { FExprNode } from '$objects/expr~/FExprNode';
import { FFTNode } from '$objects/fft~/FFTNode';
import { GainNodeV2 } from '$objects/gain~/GainNode';
import { HighpassNode } from '$objects/highpass~/HighpassNode';
import { HighshelfNode } from '$objects/highshelf~/HighshelfNode';
import { LowpassNode } from '$objects/lowpass~/LowpassNode';
import { LowshelfNode } from '$objects/lowshelf~/LowshelfNode';
import { MergeNode } from '$objects/audio-channel/MergeNode';
import { MeterAudioNode } from '$objects/meter~/MeterAudioNode';
import { MicNode } from '$objects/mic~/MicNode';
import { NotchNode } from '$objects/notch~/NotchNode';
import { OscNode } from '$objects/osc~/OscNode';
import { PanNodeV2 } from '$objects/pan~/PanNode';
import { PeakingNode } from '$objects/peaking~/PeakingNode';
import { SigNode } from '$objects/sig~/SigNode';
import { SplitNode } from '$objects/audio-channel/SplitNode';
import { SamplerNode } from '$objects/sampler~/SamplerNode';
import { SonicNode } from '$objects/sonic~/SonicNode';
import { SoundfileNode } from '$objects/soundfile~/SoundfileNode';
import { ToneNode } from '$objects/tone~/ToneNode';
import { VdoNinjaPullNode } from '$objects/vdo-ninja/VdoNinjaNode';
import { VdoNinjaPushNode } from '$objects/vdo-ninja/VdoNinjaPushNode';
import { WaveShaperNodeV2 } from '$objects/waveshaper~/WaveShaperNode';
import { SendAudioNode } from '$objects/send-audio/SendAudioNode';
import { RecvAudioNode } from '$objects/recv-audio/RecvAudioNode';
import { LineNode } from '$objects/line~/native-dsp/nodes/line.node';
import { NoiseNode } from '$objects/noise~/native-dsp/nodes/noise.node';
import { PhasorNode } from '$objects/phasor~/native-dsp/nodes/phasor.node';
import { SnapshotNode } from '$objects/snapshot~/native-dsp/nodes/snapshot.node';
import { BangNode } from '$objects/bang~/native-dsp/nodes/bang.node';
import { MultiplyNode } from '$objects/audio-math/native-dsp/nodes/multiply.node';
import { SubtractNode } from '$objects/audio-math/native-dsp/nodes/subtract.node';
import { DivideNode } from '$objects/audio-math/native-dsp/nodes/divide.node';
import { MinNode } from '$objects/audio-math/native-dsp/nodes/min.node';
import { MaxNode } from '$objects/audio-math/native-dsp/nodes/max.node';
import { ClipNode } from '$objects/clip~/native-dsp/nodes/clip.node';
import { WrapNode } from '$objects/audio-math/native-dsp/nodes/wrap.node';
import { AbsNode } from '$objects/audio-math/native-dsp/nodes/abs.node';
import { PowNode } from '$objects/audio-math/native-dsp/nodes/pow.node';
import { GtNode } from '$objects/audio-math/native-dsp/nodes/gt.node';
import { LtNode } from '$objects/audio-math/native-dsp/nodes/lt.node';
import { SampholdNode } from '$objects/samphold~/native-dsp/nodes/samphold.node';
import { AdsrNode } from '$objects/adsr~/native-dsp/nodes/adsr.node';
import { EnvNode } from '$objects/env~/native-dsp/nodes/env.node';
import { VlineNode } from '$objects/vline~/native-dsp/nodes/vline.node';
import { LatchNode } from '$objects/latch~/native-dsp/nodes/latch.node';
import { PinkNode } from '$objects/pink~/native-dsp/nodes/pink.node';
import { PulseNode } from '$objects/pulse~/native-dsp/nodes/pulse.node';
import { CombNode } from '$objects/comb~/native-dsp/nodes/comb.node';
import { ThresholdNode } from '$objects/threshold~/native-dsp/nodes/threshold.node';
import { TabwriteNode } from '$objects/table-audio/native-dsp/nodes/tabwrite.node';
import { TabreadNode } from '$objects/table-audio/native-dsp/nodes/tabread.node';
import { Tabread4Node } from '$objects/table-audio/native-dsp/nodes/tabread4.node';
import { ScopeAudioNode } from '$objects/scope~/ScopeAudioNode';
import { TapNode } from '$objects/tap~/native-dsp/nodes/tap.node';
import { MtofNode } from '$objects/mtof~/native-dsp/nodes/mtof.node';
import { FtomNode } from '$objects/ftom~/native-dsp/nodes/ftom.node';
import { SqrtNode } from '$objects/audio-math/native-dsp/nodes/sqrt.node';
import { LogNode } from '$objects/audio-math/native-dsp/nodes/log.node';
import { ExpNode } from '$objects/audio-math/native-dsp/nodes/exp.node';
import { RsqrtNode } from '$objects/audio-math/native-dsp/nodes/rsqrt.node';
import { CosNode } from '$objects/audio-math/native-dsp/nodes/cos.node';
import { Tabosc4Node } from '$objects/table-audio/native-dsp/nodes/tabosc4.node';
import { VcfNode } from '$objects/vcf~/native-dsp/nodes/vcf.node';
import { BiquadNode } from '$objects/biquad~/native-dsp/nodes/biquad.node';
import { SlopNode } from '$objects/slop~/native-dsp/nodes/slop.node';
import { DelwriteNode } from '$objects/delay-lines/native-dsp/nodes/delwrite.node';
import { DelreadNode } from '$objects/delay-lines/native-dsp/nodes/delread.node';
import { Delread4Node } from '$objects/delay-lines/native-dsp/nodes/delread4.node';
import { BytebeatNode } from '$objects/bytebeat~/BytebeatNode';
import { PadsAudioNode } from '$objects/pads/PadsAudioNode';
import { SMPLR_AUDIO_NODES } from '$objects/smplr/audio-nodes';

import { AudioRegistry } from '$lib/registry/AudioRegistry';

import type { AudioNodeClass } from '$lib/audio/v2/interfaces/audio-nodes';

export const AUDIO_NODES = [
  AddNode,
  AiSttAudioNode,
  BeatNode,
  AllpassNode,
  BandpassNode,
  ChuckNode,
  CompressorNode,
  ConvolverNodeV2,
  CsoundNode,
  DelayNodeV2,
  DspNode,
  ElementaryNode,
  ExprNode,
  FExprNode,
  FFTNode,
  GainNodeV2,
  HighpassNode,
  HighshelfNode,
  LowpassNode,
  LowshelfNode,
  MergeNode,
  MeterAudioNode,
  MicNode,
  NotchNode,
  OscNode,
  AudioOutputNode,
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
  WaveShaperNodeV2,
  SendAudioNode,
  RecvAudioNode,
  LineNode,
  NoiseNode,
  PhasorNode,
  SnapshotNode,
  BangNode,
  MultiplyNode,
  SubtractNode,
  DivideNode,
  MinNode,
  MaxNode,
  ClipNode,
  WrapNode,
  AbsNode,
  PowNode,
  GtNode,
  LtNode,
  SampholdNode,
  AdsrNode,
  EnvNode,
  VlineNode,
  LatchNode,
  PinkNode,
  PulseNode,
  CombNode,
  ThresholdNode,
  TabwriteNode,
  TabreadNode,
  Tabread4Node,
  ScopeAudioNode,
  TapNode,
  MtofNode,
  FtomNode,
  SqrtNode,
  LogNode,
  ExpNode,
  RsqrtNode,
  CosNode,
  Tabosc4Node,
  VcfNode,
  BiquadNode,
  SlopNode,
  DelwriteNode,
  DelreadNode,
  Delread4Node,
  BytebeatNode,
  PadsAudioNode,
  ...SMPLR_AUDIO_NODES
] as const satisfies AudioNodeClass[];

/**
 * Define all v2 audio nodes with the AudioRegistry.
 * This should be called during application initialization.
 */
export function registerAudioNodes(): void {
  const registry = AudioRegistry.getInstance();

  AUDIO_NODES.forEach((node) => registry.register(node));
}
