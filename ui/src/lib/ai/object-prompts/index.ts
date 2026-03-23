/**
 * Object-specific prompts for AI code generation.
 * Each object type has its own file containing detailed instructions.
 */

import { asmPrompt } from './asm';
import { bgOutPrompt } from './bg.out';
import { buttonPrompt } from './button';
import { bytebeatPrompt } from './bytebeat~';
import { canvasDomPrompt } from './canvas.dom';
import { canvasPrompt } from './canvas';
import { chuckPrompt } from './chuck~';
import { csoundPrompt } from './csound~';
import { defaultPrompt } from './default';
import { domPrompt } from './dom';
import { dspPrompt } from './dsp~';
import { exprPrompt } from './expr';
import { exprTildePrompt } from './expr~';
import { glslPrompt } from './glsl';
import { hydraPrompt } from './hydra';
import { jsPrompt } from './js';
import { markdownPrompt } from './markdown';
import { msgPrompt } from './msg';
import { objectPrompt } from './object';
import { orcaPrompt } from './orca';
import { p5Prompt } from './p5';
import { pythonPrompt } from './python';
import { recvPrompt } from './recv';
import { recvVdoPrompt } from './recv.vdo';
import { rubyPrompt } from './ruby';
import { sendPrompt } from './send';
import { sendVdoPrompt } from './send.vdo';
import { samplerPrompt } from './sampler~';
import { padsPrompt } from '$objects/pads/prompt';
import { projmapPrompt } from '$objects/projmap/prompt';
import { sampleratePrompt } from './samplerate~';
import { sliderPrompt } from './slider';
import { soundfilePrompt } from './soundfile~';
import { strudelPrompt } from './strudel';
import { swglPrompt } from './swgl';
import { textboxPrompt } from './textbox';
import { togglePrompt } from './toggle';
import { tonePrompt } from './tone~';
import { uxnPrompt } from './uxn';
import { sonicPrompt } from './sonic~';
import { elemPrompt } from './elem~';
import { labelPrompt } from './label';
import { vuePrompt } from './vue';
import { threePrompt } from './three';
import { threeDomPrompt } from './three.dom';
import { wgpuPrompt } from './wgpu';
import { workerPrompt } from './worker';
import { scopePrompt } from './scope~';
import { sequencerPrompt } from './sequencer';
import { stackPrompt } from './stack';
import { queuePrompt } from './queue';
import {
  visionHandPrompt,
  visionBodyPrompt,
  visionFacePrompt,
  visionSegmentPrompt,
  visionDetectPrompt,
  visionGesturePrompt,
  visionClassifyPrompt
} from '$objects/mediapipe/prompts';
import { serialPrompt, serialTermPrompt, dmxPrompt } from '$objects/serial/prompts';

/**
 * Mapping of object types to their instruction prompts.
 */
export const objectPrompts: Record<string, string> = {
  'tone~': tonePrompt,
  'dsp~': dspPrompt,
  p5: p5Prompt,
  hydra: hydraPrompt,
  glsl: glslPrompt,
  'canvas.dom': canvasDomPrompt,
  dom: domPrompt,
  vue: vuePrompt,
  slider: sliderPrompt,
  js: jsPrompt,
  expr: exprPrompt,
  'expr~': exprTildePrompt,
  button: buttonPrompt,
  toggle: togglePrompt,
  msg: msgPrompt,
  textbox: textboxPrompt,
  canvas: canvasPrompt,
  strudel: strudelPrompt,
  python: pythonPrompt,
  ruby: rubyPrompt,
  swgl: swglPrompt,
  uxn: uxnPrompt,
  asm: asmPrompt,
  orca: orcaPrompt,
  'chuck~': chuckPrompt,
  'csound~': csoundPrompt,
  'soundfile~': soundfilePrompt,
  'sampler~': samplerPrompt,
  'pads~': padsPrompt,
  markdown: markdownPrompt,
  object: objectPrompt,
  'bg.out': bgOutPrompt,
  'sonic~': sonicPrompt,
  'elem~': elemPrompt,
  label: labelPrompt,
  three: threePrompt,
  'three.dom': threeDomPrompt,
  projmap: projmapPrompt,
  'wgpu.compute': wgpuPrompt,
  worker: workerPrompt,
  send: sendPrompt,
  recv: recvPrompt,
  'send.vdo': sendVdoPrompt,
  'recv.vdo': recvVdoPrompt,
  'bytebeat~': bytebeatPrompt,
  'samplerate~': sampleratePrompt,
  sequencer: sequencerPrompt,
  stack: stackPrompt,
  queue: queuePrompt,
  'scope~': scopePrompt,
  serial: serialPrompt,
  'serial.term': serialTermPrompt,
  'serial.dmx': dmxPrompt,
  'vision.hand': visionHandPrompt,
  'vision.body': visionBodyPrompt,
  'vision.face': visionFacePrompt,
  'vision.segment': visionSegmentPrompt,
  'vision.detect': visionDetectPrompt,
  'vision.gesture': visionGesturePrompt,
  'vision.classify': visionClassifyPrompt
};

/**
 * Returns detailed instructions and examples for a specific object type.
 * Used by both single and multi-object generation.
 */
export function getObjectSpecificInstructions(objectType: string): string {
  return objectPrompts[objectType] ?? defaultPrompt(objectType);
}
