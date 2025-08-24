import P5CanvasNode from '$lib/components/nodes/P5CanvasNode.svelte';
import JSBlockNode from '$lib/components/nodes/JSBlockNode.svelte';
import HydraNode from '$lib/components/nodes/HydraNode.svelte';
import JSCanvasNode from '$lib/components/nodes/JSCanvasNode.svelte';
import GLSLCanvasNode from '$lib/components/nodes/GLSLCanvasNode.svelte';
import SwissGLNode from '$lib/components/nodes/SwissGLNode.svelte';
import StrudelNode from '$lib/components/nodes/StrudelNode.svelte';
import ButterchurnNode from '$lib/components/nodes/ButterchurnNode.svelte';
import AiImageNode from '$lib/components/nodes/AiImageNode.svelte';
import AiTextNode from '$lib/components/nodes/AiTextNode.svelte';
import MessageNode from '$lib/components/nodes/MessageNode.svelte';
import BangNode from '$lib/components/nodes/BangNode.svelte';
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

export const nodeTypes = {
	object: ObjectNode,
	bang: BangNode,
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
	'ai.music': AiMusicNode,
	'ai.tts': AiSpeechNode,
	'midi.in': MIDIInputNode,
	'midi.out': MIDIOutputNode,
	slider: SliderNode,
	python: PythonNode,
	markdown: MarkdownNode,
	expr: ExprNode,
	'expr~': AudioExprNode
} as const;

export const nodeNames = Object.keys(nodeTypes) as Array<keyof typeof nodeTypes>;

export type NodeTypeName = keyof typeof nodeTypes;
