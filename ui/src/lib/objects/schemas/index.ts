export * from '$lib/objects/schemas/types';
export * from './utils';
export * from '$lib/objects/schemas/helpers';
export * from '$lib/objects/schemas/common';
export * from '$lib/objects/schemas/midi-messages';
export * from '$objects/trigger/schema';
export * from '$objects/p5/schema';
export * from '$objects/hydra/schema';
export * from '$objects/glsl/schema';
export * from '$objects/canvas/schema';
export * from '$objects/surface/schema';
export * from '$objects/shaderpark/schema';
export * from '$objects/float.tex/schema';
export * from '$objects/swgl/schema';
export * from '$objects/textmode/schema';
export * from '$objects/three/schema';
export * from '$objects/regl/schema';
export * from '$objects/img/schema';
export * from '$objects/video/schema';
export * from '$objects/webcam/schema';
export * from '$objects/screen/schema';
export * from '$objects/iframe/schema';
export * from '$objects/button/schema';
export * from '$objects/toggle/schema';
export * from '$objects/switch/schema';
export * from '$objects/msg/schema';
export * from '$objects/slider/schema';
export * from '$objects/knob/schema';
export * from '$objects/textbox/schema';
export * from '$objects/keyboard/schema';
export * from '$objects/soundfile~/schema';
export * from '$objects/sampler~/schema';
export * from '$objects/table/schema';
export * from '$objects/orca/schema';
export * from '$objects/strudel/schema';
export * from '$objects/chuck~/schema';
export * from '$objects/mqtt/schema';
export * from '$objects/sse/schema';
export * from '$objects/tts/schema';
export * from '$objects/stt/schema';
export * from '$objects/netsend/schema';
export * from '$objects/netrecv/schema';
export * from '$objects/ai.txt/schema';
export * from '$objects/ai.img/schema';
export * from '$objects/ai.music/schema';
export * from '$objects/ai.tts/schema';
export * from '$objects/ai.stt/schema';
export * from '$objects/midi/midi-in.schema';
export * from '$objects/midi/midi-out.schema';
export * from '$objects/midi.file/schema';
export * from '$objects/vdo-ninja/vdo-ninja-push.schema';
export * from '$objects/vdo-ninja/vdo-ninja-pull.schema';
export * from '$objects/js/schema';
export * from '$objects/worker/schema';
export * from '$objects/vue/schema';
export * from '$objects/dom/schema';
export * from '$objects/uxn/schema';
export * from '$objects/uiua/schema';
export * from '$objects/ruby/schema';
export * from '$objects/python/schema';
export * from '$objects/expr/schema';
export * from '$objects/filter/schema';
export * from '$objects/map/schema';
export * from '$objects/tap/schema';
export * from '$objects/tap~/schema';
export * from '$objects/scan/schema';
export * from '$objects/uniq/schema';
export * from '$objects/peek/schema';
export * from '$objects/loadbang/schema';
export * from '$objects/metro/schema';
export * from '$objects/markdown/schema';
export * from '$objects/tone~/schema';
export * from '$objects/elem~/schema';
export * from '$objects/sonic~/schema';
export * from '$objects/csound~/schema';
export * from '$objects/dsp~/schema';
export * from '$objects/expr~/schema';
export * from '$objects/osc~/schema';
export * from '$objects/waveshaper~/schema';
export * from '$objects/convolver~/schema';
export * from '$objects/asm/asm.schema';
export * from '$objects/asm/asm-mem.schema';
export * from '$objects/wgpu.compute/schema';
export * from '$objects/bg.out/schema';
export * from '$objects/send.vdo/schema';
export * from '$objects/recv.vdo/schema';
export * from '$objects/note/schema';
export * from '$objects/group/schema';
export * from '$objects/label/schema';
export * from '$objects/title/schema';
export * from '$objects/link/schema';
export * from '$objects/meter~/schema';
export * from '$objects/sequencer/schema';
export * from '$objects/bytebeat~/schema';
export * from '$objects/projmap/schema';
export * from '$objects/ngea/schema';
export * from '$objects/anupars/schema';
export * from '$objects/sheet/schema';
export * from '$objects/smplr/schema';
export * from './from-v2-node';
export * from '$objects/mediapipe/schemas';

import type { ObjectSchemaRegistry } from '$lib/objects/schemas/types';
import { generatedObjectSchemas } from '$lib/generated/object-schemas.generated';

// Manual schema imports (for visual/UI objects that don't have V2 classes)
import { triggerSchema } from '$objects/trigger/schema';
import { p5Schema } from '$objects/p5/schema';
import { hydraSchema } from '$objects/hydra/schema';
import { glslSchema } from '$objects/glsl/schema';
import { canvasSchema, canvasDomSchema } from '$objects/canvas/schema';
import { surfaceSchema } from '$objects/surface/schema';
import { shaderparkSchema } from '$objects/shaderpark/schema';
import { floatTexSchema } from '$objects/float.tex/schema';
import { swglSchema } from '$objects/swgl/schema';
import { textmodeSchema, textmodeDomSchema } from '$objects/textmode/schema';
import { threeSchema, threeDomSchema } from '$objects/three/schema';
import { reglSchema } from '$objects/regl/schema';
import { imgSchema } from '$objects/img/schema';
import { videoSchema } from '$objects/video/schema';
import { webcamSchema } from '$objects/webcam/schema';
import { screenSchema } from '$objects/screen/schema';
import { iframeSchema } from '$objects/iframe/schema';
import { buttonSchema } from '$objects/button/schema';
import { toggleSchema } from '$objects/toggle/schema';
import { switchSchema } from '$objects/switch/schema';
import { msgSchema } from '$objects/msg/schema';
import { sliderSchema } from '$objects/slider/schema';
import { knobSchema } from '$objects/knob/schema';
import { textboxSchema } from '$objects/textbox/schema';
import { keyboardSchema } from '$objects/keyboard/schema';
import { soundfileSchema } from '$objects/soundfile~/schema';
import { samplerSchema } from '$objects/sampler~/schema';
import { tableSchema } from '$objects/table/schema';
import { orcaSchema } from '$objects/orca/schema';
import { strudelSchema } from '$objects/strudel/schema';
import { chuckSchema } from '$objects/chuck~/schema';
import { mqttSchema } from '$objects/mqtt/schema';
import { sseSchema } from '$objects/sse/schema';
import { ttsSchema } from '$objects/tts/schema';
import { sttSchema } from '$objects/stt/schema';
import { netsendSchema } from '$objects/netsend/schema';
import { netrecvSchema } from '$objects/netrecv/schema';
import { aiTxtSchema } from '$objects/ai.txt/schema';
import { aiImgSchema } from '$objects/ai.img/schema';
import { aiMusicSchema } from '$objects/ai.music/schema';
import { aiTtsSchema } from '$objects/ai.tts/schema';
import { aiSttSchema } from '$objects/ai.stt/schema';
import { midiInSchema } from '$objects/midi/midi-in.schema';
import { midiOutSchema } from '$objects/midi/midi-out.schema';
import { midiFileSchema } from '$objects/midi.file/schema';
import { vdoNinjaPushSchema } from '$objects/vdo-ninja/vdo-ninja-push.schema';
import { vdoNinjaPullSchema } from '$objects/vdo-ninja/vdo-ninja-pull.schema';
import { jsSchema } from '$objects/js/schema';
import { workerSchema } from '$objects/worker/schema';
import { vueSchema } from '$objects/vue/schema';
import { domSchema } from '$objects/dom/schema';
import { uxnSchema } from '$objects/uxn/schema';
import { uiuaSchema } from '$objects/uiua/schema';
import { rubySchema } from '$objects/ruby/schema';
import { pythonSchema } from '$objects/python/schema';
import { peppermintSchema } from '$objects/peppermint/schema';
import { exprSchema } from '$objects/expr/schema';
import { filterSchema } from '$objects/filter/schema';
import { mapSchema } from '$objects/map/schema';
import { tapSchema } from '$objects/tap/schema';
import { tapTildeSchema } from '$objects/tap~/schema';
import { scanSchema } from '$objects/scan/schema';
import { uniqSchema } from '$objects/uniq/schema';
import { peekSchema } from '$objects/peek/schema';
import { loadbangSchema } from '$objects/loadbang/schema';
import { metroSchema } from '$objects/metro/schema';
import { markdownSchema } from '$objects/markdown/schema';
import { toneSchema } from '$objects/tone~/schema';
import { elemSchema } from '$objects/elem~/schema';
import { sonicSchema } from '$objects/sonic~/schema';
import { csoundSchema } from '$objects/csound~/schema';
import { dspSchema } from '$objects/dsp~/schema';
import { exprAudioSchema } from '$objects/expr~/schema';
import { oscSchema } from '$objects/osc~/schema';
import { waveshaperSchema } from '$objects/waveshaper~/schema';
import { convolverSchema } from '$objects/convolver~/schema';
import { asmSchema } from '$objects/asm/asm.schema';
import { asmMemSchema } from '$objects/asm/asm-mem.schema';
import { wgpuComputeSchema } from '$objects/wgpu.compute/schema';
import { bgOutSchema } from '$objects/bg.out/schema';
import { sendVdoSchema } from '$objects/send.vdo/schema';
import { recvVdoSchema } from '$objects/recv.vdo/schema';
import { noteSchema } from '$objects/note/schema';
import { groupSchema } from '$objects/group/schema';
import { labelSchema } from '$objects/label/schema';
import { titleSchema } from '$objects/title/schema';
import { linkSchema } from '$objects/link/schema';
import { meterSchema } from '$objects/meter~/schema';
import { sequencerSchema } from '$objects/sequencer/schema';
import { bytebeatSchema } from '$objects/bytebeat~/schema';
import { projmapSchema } from '$objects/projmap/schema';
import { ngeaSchema } from '$objects/ngea/schema';
import { anuparsSchema } from '$objects/anupars/schema';
import { sheetSchema } from '$objects/sheet/schema';
import { curveSchema } from '$objects/curve/schema';
import { serialSchema, serialTermSchema, dmxSchema } from '$objects/serial/schema';
import {
  gmSchema,
  soundfontSchema,
  soundfont2Schema,
  pianoSchema,
  epianoSchema,
  drumMachineSchema,
  malletSchema,
  mellotronSchema,
  versilianSchema,
  smolkenSchema
} from '$objects/smplr/schema';
import {
  visionHandSchema,
  visionBodySchema,
  visionFaceSchema,
  visionGestureSchema,
  visionClassifySchema,
  visionDetectSchema,
  visionSegmentSchema
} from '$objects/mediapipe/schemas';

/**
 * Registry of all object schemas.
 *
 * Auto-generated schemas come from the build-time generated file.
 * Manual schemas are used for visual/UI objects that don't have V2 classes.
 */
export const objectSchemas: ObjectSchemaRegistry = {
  // Auto-generated from V2 nodes at build time (spread first so manual schemas can override)
  ...generatedObjectSchemas,

  // Manual schemas (override auto-generated where both exist)
  trigger: triggerSchema,
  p5: p5Schema,
  hydra: hydraSchema,
  glsl: glslSchema,
  canvas: canvasSchema,
  'canvas.dom': canvasDomSchema,
  surface: surfaceSchema,
  shaderpark: shaderparkSchema,
  'float.tex': floatTexSchema,
  swgl: swglSchema,
  textmode: textmodeSchema,
  'textmode.dom': textmodeDomSchema,
  three: threeSchema,
  'three.dom': threeDomSchema,
  regl: reglSchema,
  img: imgSchema,
  video: videoSchema,
  webcam: webcamSchema,
  screen: screenSchema,
  iframe: iframeSchema,
  button: buttonSchema,
  toggle: toggleSchema,
  switch: switchSchema,
  msg: msgSchema,
  slider: sliderSchema,
  knob: knobSchema,
  textbox: textboxSchema,
  keyboard: keyboardSchema,
  'soundfile~': soundfileSchema,
  'sampler~': samplerSchema,
  table: tableSchema,
  orca: orcaSchema,
  strudel: strudelSchema,
  'chuck~': chuckSchema,
  mqtt: mqttSchema,
  sse: sseSchema,
  tts: ttsSchema,
  stt: sttSchema,
  netsend: netsendSchema,
  netrecv: netrecvSchema,
  'ai.txt': aiTxtSchema,
  'ai.img': aiImgSchema,
  'ai.music': aiMusicSchema,
  'ai.tts': aiTtsSchema,
  'ai.stt': aiSttSchema,
  'midi.in': midiInSchema,
  'midi.out': midiOutSchema,
  'midi.file': midiFileSchema,
  'vdo.ninja.push': vdoNinjaPushSchema,
  'vdo.ninja.pull': vdoNinjaPullSchema,
  js: jsSchema,
  worker: workerSchema,
  vue: vueSchema,
  dom: domSchema,
  uxn: uxnSchema,
  uiua: uiuaSchema,
  ruby: rubySchema,
  python: pythonSchema,
  peppermint: peppermintSchema,
  expr: exprSchema,
  filter: filterSchema,
  map: mapSchema,
  tap: tapSchema,
  'tap~': tapTildeSchema,
  scan: scanSchema,
  uniq: uniqSchema,
  peek: peekSchema,
  loadbang: loadbangSchema,
  metro: metroSchema,
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
  asm: asmSchema,
  'asm.mem': asmMemSchema,
  'wgpu.compute': wgpuComputeSchema,
  'bg.out': bgOutSchema,
  'send.vdo': sendVdoSchema,
  'recv.vdo': recvVdoSchema,
  note: noteSchema,
  group: groupSchema,
  label: labelSchema,
  title: titleSchema,
  link: linkSchema,
  'meter~': meterSchema,
  sequencer: sequencerSchema,
  'bytebeat~': bytebeatSchema,
  projmap: projmapSchema,
  curve: curveSchema,
  serial: serialSchema,
  'serial.term': serialTermSchema,
  'serial.dmx': dmxSchema,
  'gm~': gmSchema,
  'soundfont~': soundfontSchema,
  'soundfont2~': soundfont2Schema,
  'piano~': pianoSchema,
  'epiano~': epianoSchema,
  'drums~': drumMachineSchema,
  'mallet~': malletSchema,
  'mellotron~': mellotronSchema,
  'versilian~': versilianSchema,
  'smolken~': smolkenSchema,
  'vision.hand': visionHandSchema,
  'vision.body': visionBodySchema,
  'vision.face': visionFaceSchema,
  'vision.gesture': visionGestureSchema,
  'vision.classify': visionClassifySchema,
  'vision.detect': visionDetectSchema,
  'vision.segment': visionSegmentSchema,
  ngea: ngeaSchema,
  anupars: anuparsSchema,
  sheet: sheetSchema
};

/**
 * Get schema for an object type.
 */
export function getObjectSchema(type: string) {
  return objectSchemas[type];
}
