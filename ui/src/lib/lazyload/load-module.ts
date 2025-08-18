import { match } from 'ts-pattern';
import type P5 from 'p5';

// Represents untyped modules.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

export interface LazyModules {
	p5: typeof P5;
	ml5: Untyped;
	'@strudel/core': Untyped;
	'@strudel/draw': Untyped;
	'@strudel/transpiler': Untyped;
	'@strudel/webaudio': Untyped;
	'@strudel/codemirror': Untyped;
	'@strudel/mini': Untyped;
	'@strudel/tonal': Untyped;
	'@strudel/hydra': Untyped;
	'@strudel/soundfonts': Untyped;
	'@strudel/midi': Untyped;
}

export type LazyModuleName = keyof LazyModules;

export const loadModule = <M extends LazyModuleName>(name: M): Promise<LazyModules[M]> =>
	match(name as LazyModuleName)
		.with('p5', async () => {
			const { default: P5 } = await import('p5');
			return P5;
		})
		.with('ml5', async () => {
			// @ts-expect-error -- no typedef for ML5.js
			const { default: ml5 } = await import('ml5');
			return ml5;
		})
		.with('@strudel/core', () => import('@strudel/core'))
		.with('@strudel/draw', () => import('@strudel/draw'))
		.with('@strudel/transpiler', () => import('@strudel/transpiler'))
		.with('@strudel/webaudio', () => import('@strudel/webaudio'))
		.with('@strudel/codemirror', () => import('@strudel/codemirror'))
		.with('@strudel/mini', () => import('@strudel/mini'))
		.with('@strudel/tonal', () => import('@strudel/tonal'))
		.with('@strudel/hydra', () => import('@strudel/hydra'))
		.with('@strudel/soundfonts', () => import('@strudel/soundfonts'))
		.with('@strudel/midi', () => import('@strudel/midi'))
		.exhaustive();
