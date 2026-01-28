import P5CanvasNode from '$lib/components/nodes/P5CanvasNode.svelte';
import JSBlockNode from '$lib/components/nodes/JSBlockNode.svelte';
import HydraNode from '$lib/components/nodes/HydraNode.svelte';
import JSCanvasNode from '$lib/components/nodes/JSCanvasNode.svelte';
import TextmodeNode from '$lib/components/nodes/TextmodeNode.svelte';
import TextmodeDom from '$lib/components/nodes/TextmodeDom.svelte';
import CanvasDom from '$lib/components/nodes/CanvasDom.svelte';
import ThreeNode from '$lib/components/nodes/ThreeNode.svelte';
import ThreeDom from '$lib/components/nodes/ThreeDom.svelte';
import GLSLCanvasNode from '$lib/components/nodes/GLSLCanvasNode.svelte';
import SwissGLNode from '$lib/components/nodes/SwissGLNode.svelte';
import StrudelNode from '$lib/components/nodes/StrudelNode.svelte';
import ButterchurnNode from '$lib/components/nodes/ButterchurnNode.svelte';
import AiImageNode from '$lib/components/nodes/AiImageNode.svelte';
import ImageNode from '$lib/components/nodes/ImageNode.svelte';
import IframeNode from '$lib/components/nodes/IframeNode.svelte';
import AiTextNode from '$lib/components/nodes/AiTextNode.svelte';
import MessageNode from '$lib/components/nodes/MessageNode.svelte';
import ButtonNode from '$lib/components/nodes/ButtonNode.svelte';
import AiMusicNode from '$lib/components/nodes/AiMusicNode.svelte';
import BackgroundOutputNode from '$lib/components/nodes/BackgroundOutputNode.svelte';
import AiSpeechNode from '$lib/components/nodes/AiSpeechNode.svelte';
import MIDIInputNode from '$lib/components/nodes/MIDIInputNode.svelte';
import MIDIOutputNode from '$lib/components/nodes/MIDIOutputNode.svelte';
import ObjectNode from '$lib/components/nodes/ObjectNode.svelte';
import SliderNode from '$lib/components/nodes/SliderNode.svelte';
import PythonNode from '$lib/components/nodes/PythonNode.svelte';
import MarkdownNode from '$lib/components/nodes/MarkdownNode.svelte';
import ExprNode from '$lib/components/nodes/ExprNode.svelte';
import AudioExprNode from '$lib/components/nodes/AudioExprNode.svelte';
import ChuckNode from '$lib/components/nodes/ChuckNode.svelte';
import SoundFile from '$lib/components/nodes/SoundFile.svelte';
import SamplerNode from '$lib/components/nodes/SamplerNode.svelte';
import NetSendNode from '$lib/components/nodes/NetSendNode.svelte';
import NetRecvNode from '$lib/components/nodes/NetRecvNode.svelte';
import ScreenCaptureNode from '$lib/components/nodes/ScreenCaptureNode.svelte';
import WebcamNode from '$lib/components/nodes/WebcamNode.svelte';
import VideoNode from '$lib/components/nodes/VideoNode.svelte';
import TextInputNode from '$lib/components/nodes/TextInputNode.svelte';
import DSPNode from '$lib/components/nodes/DSPNode.svelte';
import ToneNode from '$lib/components/nodes/ToneNode.svelte';
import SonicNode from '$lib/components/nodes/SonicNode.svelte';
import ElementaryAudioNode from '$lib/components/nodes/ElementaryAudioNode.svelte';
import CsoundNode from '$lib/components/nodes/CsoundNode.svelte';
import ToggleButtonNode from '$lib/components/nodes/ToggleButtonNode.svelte';
import LabelNode from '$lib/components/nodes/LabelNode.svelte';
import LinkButton from '$lib/components/nodes/LinkButton.svelte';
import ChannelMergerNode from '$lib/components/nodes/ChannelMergerNode.svelte';
import ChannelSplitterNode from '$lib/components/nodes/ChannelSplitterNode.svelte';
import MicNode from '$lib/components/nodes/MicNode.svelte';
import DacNode from '$lib/components/nodes/DacNode.svelte';
import MeterNode from '$lib/components/nodes/MeterNode.svelte';
import { AssemblyMachine } from '$lib/assembly';
import AssemblyValueViewer from '$lib/components/nodes/AssemblyValueViewer.svelte';
import AssemblyMemory from '$lib/components/nodes/AssemblyMemory.svelte';
import KeyboardNode from '$lib/components/nodes/KeyboardNode.svelte';
import OrcaNode from '$lib/components/nodes/OrcaNode.svelte';
import UxnNode from '$lib/components/nodes/UxnNode.svelte';
import DomNode from '$lib/components/nodes/DomNode.svelte';
import VueNode from '$lib/components/nodes/VueNode.svelte';
import MqttNode from '$lib/components/nodes/MqttNode.svelte';
import EventSourceNode from '$lib/components/nodes/EventSourceNode.svelte';
import TtsNode from '$lib/components/nodes/TtsNode.svelte';
import VdoNinjaPushNode from '$lib/components/nodes/VdoNinjaPushNode.svelte';
import VdoNinjaPullNode from '$lib/components/nodes/VdoNinjaPullNode.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, any> = {
	object: ObjectNode,
	button: ButtonNode,
	toggle: ToggleButtonNode,
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
	'midi.in': MIDIInputNode,
	'midi.out': MIDIOutputNode,
	slider: SliderNode,
	python: PythonNode,
	markdown: MarkdownNode,
	expr: ExprNode,
	'expr~': AudioExprNode,
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
	'dac~': DacNode,
	'meter~': MeterNode,
	keyboard: KeyboardNode,
	orca: OrcaNode,
	uxn: UxnNode,
	mqtt: MqttNode,
	sse: EventSourceNode,
	tts: TtsNode,
	'vdo.ninja.push': VdoNinjaPushNode,
	'vdo.ninja.pull': VdoNinjaPullNode
} as const;

export const nodeNames = Object.keys(nodeTypes) as (keyof typeof nodeTypes)[];

export type NodeTypeName = keyof typeof nodeTypes;
