import P5CanvasNode from '$objects/p5/P5CanvasNode.svelte';
import JSBlockNode from '$objects/js/JSBlockNode.svelte';
import HydraNode from '$objects/hydra/HydraNode.svelte';
import JSCanvasNode from '$objects/canvas/JSCanvasNode.svelte';
import TextmodeNode from '$objects/textmode/TextmodeNode.svelte';
import TextmodeDom from '$objects/textmode/TextmodeDom.svelte';
import CanvasDom from '$objects/canvas/CanvasDom.svelte';
import ThreeNode from '$objects/three/ThreeNode.svelte';
import ThreeDom from '$objects/three/ThreeDom.svelte';
import GLSLCanvasNode from '$objects/glsl/GLSLCanvasNode.svelte';
import SwissGLNode from '$objects/swgl/SwissGLNode.svelte';
import ReglNode from '$objects/regl/ReglNode.svelte';
import ShaderParkNode from '$objects/shaderpark/ShaderParkNode.svelte';
import FloatTextureNode from '$objects/float.tex/FloatTextureNode.svelte';
import StrudelNode from '$objects/strudel/StrudelNode.svelte';
import ButterchurnNode from '$objects/bchrn/ButterchurnNode.svelte';
import AiImageNode from '$objects/ai.img/AiImageNode.svelte';
import ImageNode from '$objects/img/ImageNode.svelte';
import IframeNode from '$objects/iframe/IframeNode.svelte';
import AiTextNode from '$objects/ai.txt/AiTextNode.svelte';
import MessageNode from '$objects/msg/MessageNode.svelte';
import ButtonNode from '$objects/button/ButtonNode.svelte';
import AiMusicNode from '$objects/ai.music/AiMusicNode.svelte';
import BackgroundOutputNode from '$objects/bg.out/BackgroundOutputNode.svelte';
import AiSpeechNode from '$objects/ai.tts/AiSpeechNode.svelte';
import AiSttNode from '$objects/ai.stt/AiSttNode.svelte';
import MIDIInputNode from '$objects/midi/MIDIInputNode.svelte';
import MIDIOutputNode from '$objects/midi/MIDIOutputNode.svelte';
import MIDIFileNode from '$objects/midi.file/components/MIDIFileNode.svelte';
import ObjectNode from '$objects/object/ObjectNode.svelte';
import SliderNode from '$objects/slider/SliderNode.svelte';
import KnobNode from '$objects/knob/KnobNode.svelte';
import PythonNode from '$objects/python/PythonNode.svelte';
import PeppermintNode from '$objects/peppermint/PeppermintNode.svelte';
import MarkdownNode from '$objects/markdown/MarkdownNode.svelte';
import ExprNode from '$objects/expr/ExprNode.svelte';
import FilterNode from '$objects/filter/FilterNode.svelte';
import MapNode from '$objects/map/MapNode.svelte';
import TapNode from '$objects/tap/TapNode.svelte';
import ScanNode from '$objects/scan/ScanNode.svelte';
import UniqNode from '$objects/uniq/UniqNode.svelte';
import AudioExprNode from '$objects/expr~/AudioExprNode.svelte';
import AudioFExprNode from '$objects/expr~/AudioFExprNode.svelte';
import ChuckNode from '$objects/chuck~/ChuckNode.svelte';
import SoundFile from '$objects/soundfile~/SoundFile.svelte';
import SamplerNode from '$objects/sampler~/SamplerNode.svelte';
import NetSendNode from '$objects/netsend/NetSendNode.svelte';
import NetRecvNode from '$objects/netrecv/NetRecvNode.svelte';
import ScreenCaptureNode from '$objects/screen/ScreenCaptureNode.svelte';
import WebcamNode from '$objects/webcam/WebcamNode.svelte';
import VideoNode from '$objects/video/VideoNode.svelte';
import TextInputNode from '$objects/textbox/TextInputNode.svelte';
import DSPNode from '$objects/dsp~/DSPNode.svelte';
import ToneNode from '$objects/tone~/ToneNode.svelte';
import SonicNode from '$objects/sonic~/SonicNode.svelte';
import ElementaryAudioNode from '$objects/elem~/ElementaryAudioNode.svelte';
import CsoundNode from '$objects/csound~/CsoundNode.svelte';
import ToggleButtonNode from '$objects/toggle/ToggleButtonNode.svelte';
import SwitchNode from '$objects/switch/SwitchNode.svelte';
import LabelNode from '$objects/label/LabelNode.svelte';
import LinkButton from '$objects/link/LinkButton.svelte';
import ChannelMergerNode from '$objects/audio-channel/ChannelMergerNode.svelte';
import ChannelSplitterNode from '$objects/audio-channel/ChannelSplitterNode.svelte';
import MicNode from '$objects/mic~/MicNode.svelte';
import AudioOutputNode from '$objects/out~/AudioOutputNode.svelte';
import MeterNode from '$objects/meter~/MeterNode.svelte';
import { AssemblyMachine } from '$objects/asm';
import AssemblyValueViewer from '$objects/asm/AssemblyValueViewer.svelte';
import AssemblyMemory from '$objects/asm/AssemblyMemory.svelte';
import KeyboardNode from '$objects/keyboard/KeyboardNode.svelte';
import OrcaNode from '$objects/orca/OrcaNode.svelte';
import UxnNode from '$objects/uxn/UxnNode.svelte';
import DomNode from '$objects/dom/DomNode.svelte';
import VueNode from '$objects/vue/VueNode.svelte';
import MqttNode from '$objects/mqtt/MqttNode.svelte';
import EventSourceNode from '$objects/sse/EventSourceNode.svelte';
import TtsNode from '$objects/tts/TtsNode.svelte';
import SttNode from '$objects/stt/SttNode.svelte';
import VdoNinjaPushNode from '$objects/vdo-ninja/VdoNinjaPushNode.svelte';
import VdoNinjaPullNode from '$objects/vdo-ninja/VdoNinjaPullNode.svelte';
import PeekNode from '$objects/peek/PeekNode.svelte';
import WorkerNode from '$objects/worker/WorkerNode.svelte';
import RubyNode from '$objects/ruby/RubyNode.svelte';
import WGPUNode from '$objects/wgpu.compute/WGPUNode.svelte';
import TriggerNode from '$objects/trigger/TriggerNode.svelte';
import TableNode from '$objects/table/TableNode.svelte';
import SendVideoNode from '$objects/send.vdo/SendVideoNode.svelte';
import RecvVideoNode from '$objects/recv.vdo/RecvVideoNode.svelte';
import PostItNode from '$objects/note/PostItNode.svelte';
import PatchbayNode from '$objects/patchbay/PatchbayNode.svelte';
import TitleNode from '$objects/title/TitleNode.svelte';
import ScopeNode from '$objects/scope~/ScopeNode.svelte';
import TapTildeNode from '$objects/tap~/TapTildeNode.svelte';
import UiuaNode from '$objects/uiua/UiuaNode.svelte';
import BytebeatNode from '$objects/bytebeat~/BytebeatNode.svelte';
import SequencerNode from '$objects/sequencer/SequencerNode.svelte';
import CurveNode from '$objects/curve/CurveNode.svelte';
import PadsNode from '$objects/pads/PadsNode.svelte';
import SerialNode from '$objects/serial/SerialNode.svelte';
import SerialTerminalNode from '$objects/serial/SerialTerminalNode.svelte';
import DmxNode from '$objects/serial/DmxNode.svelte';
import ProjectionMapNode from '$objects/projmap/ProjectionMapNode.svelte';
import VisionHandNode from '$objects/mediapipe/components/VisionHandNode.svelte';
import VisionBodyNode from '$objects/mediapipe/components/VisionBodyNode.svelte';
import VisionFaceNode from '$objects/mediapipe/components/VisionFaceNode.svelte';
import VisionSegmentNode from '$objects/mediapipe/components/VisionSegmentNode.svelte';
import VisionDetectNode from '$objects/mediapipe/components/VisionDetectNode.svelte';
import VisionGestureNode from '$objects/mediapipe/components/VisionGestureNode.svelte';
import VisionClassifyNode from '$objects/mediapipe/components/VisionClassifyNode.svelte';
import NgeaNode from '$objects/ngea/components/NgeaNode.svelte';
import AnuparsNode from '$objects/anupars/components/AnuparsNode.svelte';
import SurfaceNode from '$objects/surface/SurfaceNode.svelte';
import SheetNode from '$objects/sheet/SheetNode.svelte';
import GroupNode from '$objects/group/GroupNode.svelte';
import GmNode from '$objects/smplr/GmNode.svelte';
import SoundfontNode from '$objects/smplr/SoundfontNode.svelte';
import Soundfont2Node from '$objects/smplr/Soundfont2Node.svelte';
import PianoNode from '$objects/smplr/PianoNode.svelte';
import ElectricPianoNode from '$objects/smplr/ElectricPianoNode.svelte';
import DrumMachineNode from '$objects/smplr/DrumMachineNode.svelte';
import MalletNode from '$objects/smplr/MalletNode.svelte';
import MellotronNode from '$objects/smplr/MellotronNode.svelte';
import VersilianNode from '$objects/smplr/VersilianNode.svelte';
import SmolkenNode from '$objects/smplr/SmolkenNode.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, any> = {
  object: ObjectNode,
  button: ButtonNode,
  toggle: ToggleButtonNode,
  switch: SwitchNode,
  msg: MessageNode,
  p5: P5CanvasNode,
  js: JSBlockNode,
  hydra: HydraNode,
  swgl: SwissGLNode,
  canvas: JSCanvasNode,
  textmode: TextmodeNode,
  'textmode.dom': TextmodeDom,
  'canvas.dom': CanvasDom,
  three: ThreeNode,
  'three.dom': ThreeDom,
  dom: DomNode,
  vue: VueNode,
  regl: ReglNode,
  shaderpark: ShaderParkNode,
  'float.tex': FloatTextureNode,
  glsl: GLSLCanvasNode,
  strudel: StrudelNode,
  bchrn: ButterchurnNode,
  'bg.out': BackgroundOutputNode,
  'ai.txt': AiTextNode,
  'ai.img': AiImageNode,
  img: ImageNode,
  iframe: IframeNode,
  'ai.music': AiMusicNode,
  'ai.tts': AiSpeechNode,
  'ai.stt': AiSttNode,
  'midi.in': MIDIInputNode,
  'midi.out': MIDIOutputNode,
  'midi.file': MIDIFileNode,
  slider: SliderNode,
  knob: KnobNode,
  python: PythonNode,
  peppermint: PeppermintNode,
  markdown: MarkdownNode,
  expr: ExprNode,
  filter: FilterNode,
  map: MapNode,
  tap: TapNode,
  scan: ScanNode,
  uniq: UniqNode,
  'expr~': AudioExprNode,
  'fexpr~': AudioFExprNode,
  'chuck~': ChuckNode,
  'soundfile~': SoundFile,
  'sampler~': SamplerNode,
  netsend: NetSendNode,
  netrecv: NetRecvNode,
  screen: ScreenCaptureNode,
  webcam: WebcamNode,
  video: VideoNode,
  textbox: TextInputNode,
  'dsp~': DSPNode,
  'tone~': ToneNode,
  'sonic~': SonicNode,
  'elem~': ElementaryAudioNode,
  'csound~': CsoundNode,
  label: LabelNode,
  link: LinkButton,
  asm: AssemblyMachine,
  'asm.value': AssemblyValueViewer,
  'asm.mem': AssemblyMemory,
  'merge~': ChannelMergerNode,
  'split~': ChannelSplitterNode,
  'mic~': MicNode,
  'out~': AudioOutputNode,
  'meter~': MeterNode,
  keyboard: KeyboardNode,
  orca: OrcaNode,
  uxn: UxnNode,
  mqtt: MqttNode,
  sse: EventSourceNode,
  tts: TtsNode,
  stt: SttNode,
  'vdo.ninja.push': VdoNinjaPushNode,
  'vdo.ninja.pull': VdoNinjaPullNode,
  peek: PeekNode,
  worker: WorkerNode,
  ruby: RubyNode,
  'wgpu.compute': WGPUNode,
  trigger: TriggerNode,
  table: TableNode,
  'send.vdo': SendVideoNode,
  'recv.vdo': RecvVideoNode,
  patchbay: PatchbayNode,
  note: PostItNode,
  title: TitleNode,
  'scope~': ScopeNode,
  'tap~': TapTildeNode,
  uiua: UiuaNode,
  'bytebeat~': BytebeatNode,
  sequencer: SequencerNode,
  curve: CurveNode,
  'pads~': PadsNode,
  serial: SerialNode,
  'serial.term': SerialTerminalNode,
  'serial.dmx': DmxNode,
  projmap: ProjectionMapNode,
  'vision.hand': VisionHandNode,
  'vision.body': VisionBodyNode,
  'vision.face': VisionFaceNode,
  'vision.segment': VisionSegmentNode,
  'vision.detect': VisionDetectNode,
  'vision.gesture': VisionGestureNode,
  'vision.classify': VisionClassifyNode,
  ngea: NgeaNode,
  anupars: AnuparsNode,
  surface: SurfaceNode,
  sheet: SheetNode,
  group: GroupNode,
  'gm~': GmNode,
  'soundfont~': SoundfontNode,
  'soundfont2~': Soundfont2Node,
  'piano~': PianoNode,
  'epiano~': ElectricPianoNode,
  'drums~': DrumMachineNode,
  'mallet~': MalletNode,
  'mellotron~': MellotronNode,
  'versilian~': VersilianNode,
  'smolken~': SmolkenNode
} as const;

export const nodeNames = Object.keys(nodeTypes) as (keyof typeof nodeTypes)[];

export type NodeTypeName = keyof typeof nodeTypes;
