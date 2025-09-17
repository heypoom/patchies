import P5CanvasNode from '$lib/components/nodes/P5CanvasNode.svelte';
import JSBlockNode from '$lib/components/nodes/JSBlockNode.svelte';
import HydraNode from '$lib/components/nodes/HydraNode.svelte';
import JSCanvasNode from '$lib/components/nodes/JSCanvasNode.svelte';
import GLSLCanvasNode from '$lib/components/nodes/GLSLCanvasNode.svelte';
import SwissGLNode from '$lib/components/nodes/SwissGLNode.svelte';
import StrudelNode from '$lib/components/nodes/StrudelNode.svelte';
import ButterchurnNode from '$lib/components/nodes/ButterchurnNode.svelte';
import AiImageNode from '$lib/components/nodes/AiImageNode.svelte';
import ImageNode from '$lib/components/nodes/ImageNode.svelte';
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
import ToggleButtonNode from '$lib/components/nodes/ToggleButtonNode.svelte';
import LabelNode from '$lib/components/nodes/LabelNode.svelte';
import LinkButton from '$lib/components/nodes/LinkButton.svelte';
import { AssemblyMachine } from '$lib/assembly';
import AssemblyValueViewer from '$lib/components/nodes/AssemblyValueViewer.svelte';
import AssemblyMemory from '$lib/components/nodes/AssemblyMemory.svelte';

export const nodeTypes = {
	object: ObjectNode,
	button: ButtonNode,
	toggle: ToggleButtonNode,
	msg: MessageNode,
	p5: P5CanvasNode,
	js: JSBlockNode,
	hydra: HydraNode,
	swgl: SwissGLNode,
	canvas: JSCanvasNode,
	glsl: GLSLCanvasNode,
	strudel: StrudelNode,
	bchrn: ButterchurnNode,
	'bg.out': BackgroundOutputNode,
	'ai.txt': AiTextNode,
	'ai.img': AiImageNode,
	img: ImageNode,
	'ai.music': AiMusicNode,
	'ai.tts': AiSpeechNode,
	'midi.in': MIDIInputNode,
	'midi.out': MIDIOutputNode,
	slider: SliderNode,
	python: PythonNode,
	markdown: MarkdownNode,
	expr: ExprNode,
	'expr~': AudioExprNode,
	chuck: ChuckNode,
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
	label: LabelNode,
	link: LinkButton,
	asm: AssemblyMachine,
	'asm.value': AssemblyValueViewer,
	'asm.mem': AssemblyMemory
} as const;

export const nodeNames = Object.keys(nodeTypes) as Array<keyof typeof nodeTypes>;

export type NodeTypeName = keyof typeof nodeTypes;
