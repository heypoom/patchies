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
export * from './textbox';
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

import type { ObjectSchemaRegistry } from './types';
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
import { textboxSchema } from './textbox';
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

/**
 * Registry of all object schemas.
 * Add new schemas here as they are created.
 */
export const objectSchemas: ObjectSchemaRegistry = {
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
  textbox: textboxSchema,
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
  'expr~': exprAudioSchema
};

/**
 * Get schema for an object type.
 */
export function getObjectSchema(type: string) {
  return objectSchemas[type];
}
