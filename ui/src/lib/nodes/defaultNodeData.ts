import { match } from 'ts-pattern';
import {
	DEFAULT_JS_CODE,
	DEFAULT_GLSL_CODE,
	DEFAULT_STRUDEL_CODE,
	DEFAULT_AI_IMAGE_PROMPT,
	DEFAULT_BUTTERCHURN_PRESET
} from '$lib/canvas/constants';
import { DEFAULT_P5_CODE } from '$lib/p5/constants';
import { DEFAULT_HYDRA_CODE } from '$lib/hydra/constants';
import type { GLUniformDef } from '../../types/uniform-config';

// TODO: make this type-safe!
export type NodeData = {
	[key: string]: any;
};

export function getDefaultNodeData(nodeType: string): NodeData {
	return match(nodeType)
		.with('js', () => ({ code: DEFAULT_JS_CODE, showConsole: true }))
		.with('glsl', () => ({ code: DEFAULT_GLSL_CODE, uniformDefs: DEFAULT_GL_UNIFORM_DEFS }))
		.with('strudel', () => ({ code: DEFAULT_STRUDEL_CODE }))
		.with('ai.img', () => ({ prompt: DEFAULT_AI_IMAGE_PROMPT }))
		.with('ai.txt', () => ({ prompt: 'Write a creative story about...' }))
		.with('msg', () => ({ message: '' }))
		.with('bang', () => ({}))
		.with('bchrn', () => ({ currentPreset: DEFAULT_BUTTERCHURN_PRESET }))
		.with('p5', () => ({ code: DEFAULT_P5_CODE }))
		.with('hydra', () => ({ code: DEFAULT_HYDRA_CODE }))
		.with('canvas', () => ({}))
		.with('ai.music', () => ({}))
		.with('ai.tts', () => ({}))
		.with('bg.out', () => ({}))
		.otherwise(() => ({}));
}

export const DEFAULT_GL_UNIFORM_DEFS: GLUniformDef[] = [
	{ name: 'iChannel0', type: 'sampler2D' },
	{ name: 'iChannel1', type: 'sampler2D' },
	{ name: 'iChannel2', type: 'sampler2D' },
	{ name: 'iChannel3', type: 'sampler2D' }
];
