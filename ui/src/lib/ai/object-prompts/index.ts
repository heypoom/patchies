/**
 * Object-specific prompts for AI code generation.
 * Each object type has its own file containing detailed instructions.
 */

import { asmPrompt } from './asm';
import { bgOutPrompt } from './bg.out';
import { buttonPrompt } from './button';
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
import { rubyPrompt } from './ruby';
import { samplerPrompt } from './sampler~';
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
import { workerPrompt } from './worker';

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
  markdown: markdownPrompt,
  object: objectPrompt,
  'bg.out': bgOutPrompt,
  'sonic~': sonicPrompt,
  'elem~': elemPrompt,
  label: labelPrompt,
  three: threePrompt,
  'three.dom': threeDomPrompt,
  worker: workerPrompt
};

/**
 * Returns detailed instructions and examples for a specific object type.
 * Used by both single and multi-object generation.
 */
export function getObjectSpecificInstructions(objectType: string): string {
  return objectPrompts[objectType] ?? defaultPrompt(objectType);
}
