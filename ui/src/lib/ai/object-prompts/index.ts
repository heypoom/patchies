/**
 * Object-specific prompts for AI code generation.
 * Each object type has its own file containing detailed instructions.
 */

import { asmPrompt } from '$objects/asm/prompt';
import { bgOutPrompt } from '$objects/bg.out/prompt';
import { buttonPrompt } from '$objects/button/prompt';
import { bytebeatPrompt } from '$objects/bytebeat~/prompt';
import { canvasDomPrompt } from '$objects/canvas/canvas.dom.prompt';
import { canvasPrompt } from '$objects/canvas/canvas.prompt';
import { chuckPrompt } from '$objects/chuck~/prompt';
import { csoundPrompt } from '$objects/csound~/prompt';
import { defaultPrompt } from './default';
import { sheetPrompt } from '$objects/sheet/prompt';
import { domPrompt } from '$objects/dom/prompt';
import { dspPrompt } from '$objects/dsp~/prompt';
import { exprPrompt } from '$objects/expr/prompt';
import { exprTildePrompt } from '$objects/expr~/prompt';
import { glslPrompt } from '$objects/glsl/prompt';
import { floatTexPrompt } from '$objects/float.tex/prompt';
import { groupPrompt } from '$objects/group/prompt';
import { hydraPrompt } from '$objects/hydra/prompt';
import { jsPrompt } from '$objects/js/prompt';
import { markdownPrompt } from '$objects/markdown/prompt';
import { msgPrompt } from '$objects/msg/prompt';
import { midiFilePrompt } from '$objects/midi.file/prompts';
import { numericOperatorsPrompt } from '$objects/numeric-operators/numeric-operators.prompt';
import { objectPrompt } from '$objects/object/prompt';
import { orcaPrompt } from '$objects/orca/prompt';
import { p5Prompt } from '$objects/p5/prompt';
import { patchbayPrompt } from '$objects/patchbay/prompt';
import { pythonPrompt } from '$objects/python/prompt';
import { peppermintPrompt } from '$objects/peppermint/prompt';
import { recvPrompt } from '$objects/send-recv/recv.prompt';
import { recvVdoPrompt } from '$objects/recv.vdo/prompt';
import { rubyPrompt } from '$objects/ruby/prompt';
import { sendPrompt } from '$objects/send-recv/send.prompt';
import { sendVdoPrompt } from '$objects/send.vdo/prompt';
import { shaderparkPrompt } from '$objects/shaderpark/prompt';
import { samplerPrompt } from '$objects/sampler~/prompt';
import { smplrInstrumentPrompt } from '$objects/smplr/prompt';
import { padsPrompt } from '$objects/pads/prompt';
import { projmapPrompt } from '$objects/projmap/prompt';
import { sampleratePrompt } from '$objects/samplerate~/prompt';
import { sliderPrompt } from '$objects/slider/prompt';
import { soundfilePrompt } from '$objects/soundfile~/prompt';
import { strudelPrompt } from '$objects/strudel/prompt';
import { surfacePrompt } from '$objects/surface/prompt';
import { swglPrompt } from '$objects/swgl/prompt';
import { textboxPrompt } from '$objects/textbox/prompt';
import { togglePrompt } from '$objects/toggle/prompt';
import { tonePrompt } from '$objects/tone~/prompt';
import { uxnPrompt } from '$objects/uxn/prompt';
import { sonicPrompt } from '$objects/sonic~/prompt';
import { elemPrompt } from '$objects/elem~/prompt';
import { labelPrompt } from '$objects/label/prompt';
import { titlePrompt } from '$objects/title/prompt';
import { vuePrompt } from '$objects/vue/prompt';
import { reglPrompt } from '$objects/regl/prompt';
import { threePrompt } from '$objects/three/three.prompt';
import { threeDomPrompt } from '$objects/three/three.dom.prompt';
import { wgpuPrompt } from '$objects/wgpu.compute/prompt';
import { workerPrompt } from '$objects/worker/prompt';
import { scopePrompt } from '$objects/scope~/prompt';
import { tapTildePrompt } from '$objects/tap~/prompt';
import { sequencerPrompt } from '$objects/sequencer/prompt';
import { stackPrompt } from '$objects/stack/prompt';
import { queuePrompt } from '$objects/queue/prompt';
import { packPrompt } from '$objects/pack/prompt';
import { scalePrompt } from '$objects/scale/prompt';
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
import { ngeaPrompt } from '$objects/ngea/prompts';

/**
 * Mapping of object types to their instruction prompts.
 */
export const objectPrompts: Record<string, string> = {
  'tone~': tonePrompt,
  'dsp~': dspPrompt,
  p5: p5Prompt,
  hydra: hydraPrompt,
  glsl: glslPrompt,
  group: groupPrompt,
  'float.tex': floatTexPrompt,
  shaderpark: shaderparkPrompt,
  'canvas.dom': canvasDomPrompt,
  dom: domPrompt,
  vue: vuePrompt,
  slider: sliderPrompt,
  js: jsPrompt,
  expr: exprPrompt,
  '+': numericOperatorsPrompt,
  '-': numericOperatorsPrompt,
  '*': numericOperatorsPrompt,
  '/': numericOperatorsPrompt,
  'expr~': exprTildePrompt,
  button: buttonPrompt,
  toggle: togglePrompt,
  'midi.file': midiFilePrompt,
  msg: msgPrompt,
  sheet: sheetPrompt,
  textbox: textboxPrompt,
  canvas: canvasPrompt,
  surface: surfacePrompt,
  strudel: strudelPrompt,
  python: pythonPrompt,
  peppermint: peppermintPrompt,
  ruby: rubyPrompt,
  swgl: swglPrompt,
  uxn: uxnPrompt,
  asm: asmPrompt,
  orca: orcaPrompt,
  'chuck~': chuckPrompt,
  'csound~': csoundPrompt,
  'soundfile~': soundfilePrompt,
  'sampler~': samplerPrompt,
  'gm~': smplrInstrumentPrompt,
  'soundfont~': smplrInstrumentPrompt,
  'soundfont2~': smplrInstrumentPrompt,
  'piano~': smplrInstrumentPrompt,
  'epiano~': smplrInstrumentPrompt,
  'drums~': smplrInstrumentPrompt,
  'mallet~': smplrInstrumentPrompt,
  'mellotron~': smplrInstrumentPrompt,
  'versilian~': smplrInstrumentPrompt,
  'smolken~': smplrInstrumentPrompt,
  'pads~': padsPrompt,
  markdown: markdownPrompt,
  object: objectPrompt,
  patchbay: patchbayPrompt,
  'bg.out': bgOutPrompt,
  'sonic~': sonicPrompt,
  'elem~': elemPrompt,
  label: labelPrompt,
  title: titlePrompt,
  regl: reglPrompt,
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
  pack: packPrompt,
  scale: scalePrompt,
  'scope~': scopePrompt,
  'tap~': tapTildePrompt,
  serial: serialPrompt,
  'serial.term': serialTermPrompt,
  'serial.dmx': dmxPrompt,
  'vision.hand': visionHandPrompt,
  'vision.body': visionBodyPrompt,
  'vision.face': visionFacePrompt,
  'vision.segment': visionSegmentPrompt,
  'vision.detect': visionDetectPrompt,
  'vision.gesture': visionGesturePrompt,
  'vision.classify': visionClassifyPrompt,
  ngea: ngeaPrompt
};

/**
 * Returns detailed instructions and examples for a specific object type.
 * Used by both single and multi-object generation.
 */
export function getObjectSpecificInstructions(objectType: string): string {
  return objectPrompts[objectType] ?? defaultPrompt(objectType);
}
