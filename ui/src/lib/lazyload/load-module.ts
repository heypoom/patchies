import { match } from 'ts-pattern';
import type P5 from 'p5';
import type Regl from 'regl';
import type * as HydraTS from 'hydra-ts';

// Represents untyped modules.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;

export interface LazyModules {
	p5: typeof P5;
	ml5: Untyped;
	regl: typeof Regl;
	'hydra-ts': typeof HydraTS;
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
			// @ts-expect-error -- no type for ML5.js
			const { default: ml5 } = await import('ml5');
			return ml5;
		})
		.with('regl', async () => {
			const { default: regl } = await import('regl');
			return regl;
		})
		.with('hydra-ts', () => import('hydra-ts'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/core', () => import('@strudel/core'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/draw', () => import('@strudel/draw'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/transpiler', () => import('@strudel/transpiler'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/webaudio', () => import('@strudel/webaudio'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/codemirror', () => import('@strudel/codemirror'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/mini', () => import('@strudel/mini'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/tonal', () => import('@strudel/tonal'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/hydra', () => import('@strudel/hydra'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/soundfonts', () => import('@strudel/soundfonts'))
		// @ts-expect-error -- no type for strudel
		.with('@strudel/midi', () => import('@strudel/midi'))
		.exhaustive();
