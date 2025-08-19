import type { GLUniformDef } from '../../types/uniform-config';
import type { MIDIInputConfig, MIDIOutputConfig } from '$lib/canvas/MIDISystem';

// AI Node Data Types
export interface AiImageNodeData {
	prompt: string;
}

export interface AiTextNodeData {
	prompt: string;
}

export interface AiMusicNodeData {
	prompt: string;
}

export interface TTSOptions {
	text: string;
	emotionVoice?: string;
	language?: string;
	speed?: number;
	volume?: number;
	pitch?: number;
	voiceId?: string;
}

export type AiSpeechNodeData = TTSOptions;

// Canvas Node Data Types
export interface CodeNodeData {
	code: string;
}

export interface GLSLCanvasNodeData {
	code: string;
	glUniformDefs: GLUniformDef[];
}

export type P5CanvasNodeData = CodeNodeData;
export type JSCanvasNodeData = CodeNodeData;
export type HydraNodeData = CodeNodeData;
export type SwissGLNodeData = CodeNodeData;
export type StrudelNodeData = CodeNodeData;

// Block Node Data Types
export interface JSBlockNodeData {
	code: string;
	showConsole?: boolean;
	runOnMount?: boolean;
}

export interface PythonNodeData {
	code: string;
	showConsole?: boolean;
}

// UI Control Node Data Types
export interface SliderNodeData {
	min?: number;
	max?: number;
	defaultValue?: number;
	isFloat?: boolean;
	value?: number;
}

export interface MessageNodeData {
	message: string;
}

export interface MarkdownNodeData {
	markdown: string;
}

// MIDI Node Data Types
export type MIDIInputNodeData = MIDIInputConfig;
export type MIDIOutputNodeData = MIDIOutputConfig;

// Object Node Data Types
export interface ObjectNodeData {
	expr: string;
	name: string;
	params: unknown[];
}

// Visualization Node Data Types
export interface ButterchurnNodeData {
	currentPreset: string;
}

// Nodes without data properties
export type EmptyNodeData = Record<string, never>;

// Union type for all node data types
export type NodeData =
	| AiImageNodeData
	| AiTextNodeData
	| AiMusicNodeData
	| AiSpeechNodeData
	| GLSLCanvasNodeData
	| P5CanvasNodeData
	| JSCanvasNodeData
	| HydraNodeData
	| SwissGLNodeData
	| StrudelNodeData
	| JSBlockNodeData
	| PythonNodeData
	| SliderNodeData
	| MessageNodeData
	| MarkdownNodeData
	| MIDIInputNodeData
	| MIDIOutputNodeData
	| ObjectNodeData
	| ButterchurnNodeData
	| EmptyNodeData;

// Type mapping for specific node types
export interface NodeDataTypeMap {
	'ai.image': AiImageNodeData;
	'ai.text': AiTextNodeData;
	'ai.music': AiMusicNodeData;
	'ai.speech': AiSpeechNodeData;
	'glsl-canvas': GLSLCanvasNodeData;
	'p5-canvas': P5CanvasNodeData;
	'js-canvas': JSCanvasNodeData;
	hydra: HydraNodeData;
	swissgl: SwissGLNodeData;
	strudel: StrudelNodeData;
	'js-block': JSBlockNodeData;
	python: PythonNodeData;
	slider: SliderNodeData;
	message: MessageNodeData;
	markdown: MarkdownNodeData;
	'midi-input': MIDIInputNodeData;
	'midi-output': MIDIOutputNodeData;
	object: ObjectNodeData;
	butterchurn: ButterchurnNodeData;
	bang: EmptyNodeData;
	'background-output': EmptyNodeData;
}
