export * from './types';
export * from './utils';
export * from './helpers';
export * from './common';
export * from './trigger';
export * from './p5';
export * from './hydra';
export * from './glsl';
export * from './canvas';
export * from './swgl';
export * from './textmode';
export * from './three';
export * from './img';
export * from './video';
export * from './webcam';
export * from './iframe';
export * from './button';
export * from './toggle';
export * from './msg';
export * from './slider';
export * from './knob';
export * from './textbox';
export * from './keyboard';
export * from './soundfile';
export * from './sampler';
export * from './orca';
export * from './strudel';
export * from './chuck';
export * from './mqtt';
export * from './sse';
export * from './tts';
export * from './netsend';
export * from './netrecv';
export * from './ai-txt';
export * from './ai-img';
export * from './ai-music';
export * from './ai-tts';
export * from './midi-in';
export * from './midi-out';
export * from './vdo-ninja-push';
export * from './vdo-ninja-pull';
export * from './js';
export * from './worker';
export * from './vue';
export * from './dom';
export * from './uxn';
export * from './ruby';
export * from './python';
export * from './expr';
export * from './filter';
export * from './map';
export * from './tap';
export * from './scan';
export * from './uniq';
export * from './peek';
export * from './loadbang';
export * from './metro';
export * from './delay';
export * from './markdown';
export * from './tone';
export * from './elem';
export * from './sonic';
export * from './csound';
export * from './dsp';
export * from './expr-audio';
export * from './osc';
export * from './waveshaper';
export * from './convolver';
export * from './adsr';
export * from './asm';
export * from './asm-mem';
export * from './wgpu-compute';
export * from './bg-out';
export * from './send-vdo';
export * from './recv-vdo';
export * from './note';
export * from './from-v2-node';

import type { ObjectSchemaRegistry } from './types';
import { schemaFromNode } from './from-v2-node';

// Manual schema imports (for visual/UI objects that don't have V2 classes)
import { triggerSchema } from './trigger';
import { p5Schema } from './p5';
import { hydraSchema } from './hydra';
import { glslSchema } from './glsl';
import { canvasSchema, canvasDomSchema } from './canvas';
import { swglSchema } from './swgl';
import { textmodeSchema, textmodeDomSchema } from './textmode';
import { threeSchema, threeDomSchema } from './three';
import { imgSchema } from './img';
import { videoSchema } from './video';
import { webcamSchema } from './webcam';
import { iframeSchema } from './iframe';
import { buttonSchema } from './button';
import { toggleSchema } from './toggle';
import { msgSchema } from './msg';
import { sliderSchema } from './slider';
import { knobSchema } from './knob';
import { textboxSchema } from './textbox';
import { keyboardSchema } from './keyboard';
import { soundfileSchema } from './soundfile';
import { samplerSchema } from './sampler';
import { orcaSchema } from './orca';
import { strudelSchema } from './strudel';
import { chuckSchema } from './chuck';
import { mqttSchema } from './mqtt';
import { sseSchema } from './sse';
import { ttsSchema } from './tts';
import { netsendSchema } from './netsend';
import { netrecvSchema } from './netrecv';
import { aiTxtSchema } from './ai-txt';
import { aiImgSchema } from './ai-img';
import { aiMusicSchema } from './ai-music';
import { aiTtsSchema } from './ai-tts';
import { midiInSchema } from './midi-in';
import { midiOutSchema } from './midi-out';
import { vdoNinjaPushSchema } from './vdo-ninja-push';
import { vdoNinjaPullSchema } from './vdo-ninja-pull';
import { jsSchema } from './js';
import { workerSchema } from './worker';
import { vueSchema } from './vue';
import { domSchema } from './dom';
import { uxnSchema } from './uxn';
import { rubySchema } from './ruby';
import { pythonSchema } from './python';
import { exprSchema } from './expr';
import { filterSchema } from './filter';
import { mapSchema } from './map';
import { tapSchema } from './tap';
import { scanSchema } from './scan';
import { uniqSchema } from './uniq';
import { peekSchema } from './peek';
import { loadbangSchema } from './loadbang';
import { metroSchema } from './metro';
import { delaySchema } from './delay';
import { markdownSchema } from './markdown';
import { toneSchema } from './tone';
import { elemSchema } from './elem';
import { sonicSchema } from './sonic';
import { csoundSchema } from './csound';
import { dspSchema } from './dsp';
import { exprAudioSchema } from './expr-audio';
import { oscSchema } from './osc';
import { waveshaperSchema } from './waveshaper';
import { convolverSchema } from './convolver';
import { adsrSchema } from './adsr';
import { asmSchema } from './asm';
import { asmMemSchema } from './asm-mem';
import { wgpuComputeSchema } from './wgpu-compute';
import { bgOutSchema } from './bg-out';
import { sendVdoSchema } from './send-vdo';
import { recvVdoSchema } from './recv-vdo';
import { noteSchema } from './note';

// V2 Audio Node imports (source of truth for audio objects)
import { AddNodeV2 } from '$lib/audio/v2/nodes/AddNode';
import { AllpassNode } from '$lib/audio/v2/nodes/AllpassNode';
import { BandpassNode } from '$lib/audio/v2/nodes/BandpassNode';
import { CompressorNode } from '$lib/audio/v2/nodes/CompressorNode';
import { DelayNodeV2 } from '$lib/audio/v2/nodes/DelayNode';
import { FFTNode } from '$lib/audio/v2/nodes/FFTNode';
import { GainNodeV2 } from '$lib/audio/v2/nodes/GainNode';
import { HighpassNode } from '$lib/audio/v2/nodes/HighpassNode';
import { HighshelfNode } from '$lib/audio/v2/nodes/HighshelfNode';
import { LowpassNode } from '$lib/audio/v2/nodes/LowpassNode';
import { LowshelfNode } from '$lib/audio/v2/nodes/LowshelfNode';
import { MergeNode } from '$lib/audio/v2/nodes/MergeNode';
import { MicNode } from '$lib/audio/v2/nodes/MicNode';
import { NotchNode } from '$lib/audio/v2/nodes/NotchNode';
import { AudioOutputNode } from '$lib/audio/v2/nodes/AudioOutputNode';
import { PanNodeV2 } from '$lib/audio/v2/nodes/PanNode';
import { PeakingNode } from '$lib/audio/v2/nodes/PeakingNode';
import { SigNode } from '$lib/audio/v2/nodes/SigNode';
import { SplitNode } from '$lib/audio/v2/nodes/SplitNode';

// V2 Text Object imports (source of truth for control objects)
import { DebounceObject } from '$lib/objects/v2/nodes/DebounceObject';
import { MtofObject } from '$lib/objects/v2/nodes/MtofObject';
import { SpigotObject } from '$lib/objects/v2/nodes/SpigotObject';
import { ThrottleObject } from '$lib/objects/v2/nodes/ThrottleObject';
import { UniqbyObject } from '$lib/objects/v2/nodes/UniqbyObject';
import { WebMidiLinkObject } from '$lib/objects/v2/nodes/WebMidiLinkObject';
import { SendObject } from '$lib/objects/v2/nodes/SendObject';
import { RecvObject } from '$lib/objects/v2/nodes/RecvObject';
import { KVObject } from '$lib/objects/v2/nodes/KVObject';
import { SendAudioNode } from '$lib/audio/v2/nodes/SendAudioNode';
import { RecvAudioNode } from '$lib/audio/v2/nodes/RecvAudioNode';
import { IntObject } from '../v2/nodes/IntObject';
import { FloatObject } from '../v2/nodes/FloatObject';

/**
 * Registry of all object schemas.
 *
 * Manual schemas are used for visual/UI objects.
 * V2 node classes are used as source of truth for audio and control objects.
 */
export const objectSchemas: ObjectSchemaRegistry = {
  // Visual/UI objects (manual schemas)
  trigger: triggerSchema,
  p5: p5Schema,
  hydra: hydraSchema,
  glsl: glslSchema,
  canvas: canvasSchema,
  'canvas.dom': canvasDomSchema,
  swgl: swglSchema,
  textmode: textmodeSchema,
  'textmode.dom': textmodeDomSchema,
  three: threeSchema,
  'three.dom': threeDomSchema,
  img: imgSchema,
  video: videoSchema,
  webcam: webcamSchema,
  iframe: iframeSchema,
  button: buttonSchema,
  toggle: toggleSchema,
  msg: msgSchema,
  slider: sliderSchema,
  knob: knobSchema,
  textbox: textboxSchema,
  keyboard: keyboardSchema,
  'soundfile~': soundfileSchema,
  'sampler~': samplerSchema,
  orca: orcaSchema,
  strudel: strudelSchema,
  'chuck~': chuckSchema,
  mqtt: mqttSchema,
  sse: sseSchema,
  tts: ttsSchema,
  netsend: netsendSchema,
  netrecv: netrecvSchema,
  'ai.txt': aiTxtSchema,
  'ai.img': aiImgSchema,
  'ai.music': aiMusicSchema,
  'ai.tts': aiTtsSchema,
  'midi.in': midiInSchema,
  'midi.out': midiOutSchema,
  'vdo.ninja.push': vdoNinjaPushSchema,
  'vdo.ninja.pull': vdoNinjaPullSchema,
  js: jsSchema,
  worker: workerSchema,
  vue: vueSchema,
  dom: domSchema,
  uxn: uxnSchema,
  ruby: rubySchema,
  python: pythonSchema,
  expr: exprSchema,
  filter: filterSchema,
  map: mapSchema,
  tap: tapSchema,
  scan: scanSchema,
  uniq: uniqSchema,
  peek: peekSchema,
  loadbang: loadbangSchema,
  metro: metroSchema,
  delay: delaySchema,
  markdown: markdownSchema,
  'tone~': toneSchema,
  'elem~': elemSchema,
  'sonic~': sonicSchema,
  'csound~': csoundSchema,
  'dsp~': dspSchema,
  'expr~': exprAudioSchema,
  'osc~': oscSchema,
  'waveshaper~': waveshaperSchema,
  'convolver~': convolverSchema,
  adsr: adsrSchema,
  asm: asmSchema,
  'asm.mem': asmMemSchema,
  'wgpu.compute': wgpuComputeSchema,
  'bg.out': bgOutSchema,
  'send.vdo': sendVdoSchema,
  'recv.vdo': recvVdoSchema,
  note: noteSchema,

  // Audio objects (generated from V2 nodes - single source of truth)
  'gain~': schemaFromNode(GainNodeV2, 'audio'),
  'lowpass~': schemaFromNode(LowpassNode, 'audio'),
  'highpass~': schemaFromNode(HighpassNode, 'audio'),
  'bandpass~': schemaFromNode(BandpassNode, 'audio'),
  'allpass~': schemaFromNode(AllpassNode, 'audio'),
  'notch~': schemaFromNode(NotchNode, 'audio'),
  'lowshelf~': schemaFromNode(LowshelfNode, 'audio'),
  'highshelf~': schemaFromNode(HighshelfNode, 'audio'),
  'peaking~': schemaFromNode(PeakingNode, 'audio'),
  'compressor~': schemaFromNode(CompressorNode, 'audio'),
  'pan~': schemaFromNode(PanNodeV2, 'audio'),
  'delay~': schemaFromNode(DelayNodeV2, 'audio'),
  'sig~': schemaFromNode(SigNode, 'audio'),
  'fft~': schemaFromNode(FFTNode, 'audio'),
  'mic~': schemaFromNode(MicNode, 'audio'),
  'out~': schemaFromNode(AudioOutputNode, 'audio'),
  'split~': schemaFromNode(SplitNode, 'audio'),
  'merge~': schemaFromNode(MergeNode, 'audio'),
  '+~': schemaFromNode(AddNodeV2, 'audio'),
  'send~': schemaFromNode(SendAudioNode, 'audio'),
  'recv~': schemaFromNode(RecvAudioNode, 'audio'),

  // Control objects (generated from V2 nodes - single source of truth)
  mtof: schemaFromNode(MtofObject, 'control'),
  debounce: schemaFromNode(DebounceObject, 'control'),
  throttle: schemaFromNode(ThrottleObject, 'control'),
  spigot: schemaFromNode(SpigotObject, 'control'),
  uniqby: schemaFromNode(UniqbyObject, 'control'),
  webmidilink: schemaFromNode(WebMidiLinkObject, 'control'),
  send: schemaFromNode(SendObject, 'control'),
  recv: schemaFromNode(RecvObject, 'control'),
  s: schemaFromNode(SendObject, 'control'),
  r: schemaFromNode(RecvObject, 'control'),
  kv: schemaFromNode(KVObject, 'control'),
  i: schemaFromNode(IntObject, 'control'),
  f: schemaFromNode(FloatObject, 'control'),
  int: schemaFromNode(IntObject, 'control'),
  float: schemaFromNode(FloatObject, 'control')
};

/**
 * Get schema for an object type.
 */
export function getObjectSchema(type: string) {
  return objectSchemas[type];
}
