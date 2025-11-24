export interface ProjectLicense {
	name: string;
	version: string;
	license: string;
	url?: string;
}

export interface LicenseSection {
	title: string;
	description: string;
	license: string;
	whatItMeans: string[];
	fullLicenseUrl: string;
	fullLicenseText: string;
}

export interface DependenciesSection {
	title: string;
	description: string;
	dependencies: ProjectLicense[];
}

export const projectLicense: LicenseSection = {
	title: 'Project License',
	description: 'Patchies is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).',
	license: 'GNU Affero General Public License v3.0 (AGPL-3.0)',
	whatItMeans: [
		'✅ Free to use, modify, and distribute',
		'✅ Share your modifications under the same license',
		'🌐 If you use the code in web services: provide source code to users'
	],
	fullLicenseUrl: 'https://github.com/heypoom/patchies/blob/main/LICENSE',
	fullLicenseText: 'View Full AGPL-3.0 License'
};

export const dependencies: ProjectLicense[] = [
	{
		name: '@codemirror/autocomplete',
		version: '^6.18.7',
		license: 'MIT',
		url: 'https://npmjs.com/package/@codemirror/autocomplete'
	},
	{
		name: '@codemirror/lang-javascript',
		version: '^6.2.4',
		license: 'MIT',
		url: 'https://npmjs.com/package/@codemirror/lang-javascript'
	},
	{
		name: '@codemirror/lang-markdown',
		version: '^6.3.4',
		license: 'MIT',
		url: 'https://npmjs.com/package/@codemirror/lang-markdown'
	},
	{
		name: '@codemirror/lang-python',
		version: '^6.2.1',
		license: 'MIT',
		url: 'https://npmjs.com/package/@codemirror/lang-python'
	},
	{
		name: '@codemirror/language',
		version: '^6.11.2',
		license: 'MIT',
		url: 'https://npmjs.com/package/@codemirror/language'
	},
	{
		name: '@codemirror/state',
		version: '^6.5.2',
		license: 'MIT',
		url: 'https://npmjs.com/package/@codemirror/state'
	},
	{
		name: '@codemirror/theme-one-dark',
		version: '^6.1.3',
		license: 'MIT',
		url: 'https://npmjs.com/package/@codemirror/theme-one-dark'
	},
	{
		name: '@codemirror/view',
		version: '^6.38.1',
		license: 'MIT',
		url: 'https://npmjs.com/package/@codemirror/view'
	},
	{
		name: '@csound/browser',
		version: '^7.0.0-beta8',
		license: 'LGPL-2.1',
		url: 'https://npmjs.com/package/@csound/browser'
	},
	{
		name: '@elemaudio/core',
		version: '^4.0.1',
		license: 'MIT',
		url: 'https://npmjs.com/package/@elemaudio/core'
	},
	{
		name: '@elemaudio/web-renderer',
		version: '^4.0.3',
		license: 'MIT',
		url: 'https://npmjs.com/package/@elemaudio/web-renderer'
	},
	{
		name: '@google/genai',
		version: '^1.11.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/@google/genai'
	},
	{
		name: '@iconify/svelte',
		version: '^5.0.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/@iconify/svelte'
	},
	{
		name: '@lezer/generator',
		version: '^1.8.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/@lezer/generator'
	},
	{
		name: '@lezer/highlight',
		version: '^1.2.1',
		license: 'MIT',
		url: 'https://npmjs.com/package/@lezer/highlight'
	},
	{
		name: '@replit/codemirror-vim',
		version: '^6.3.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/@replit/codemirror-vim'
	},
	{
		name: '@rollup/browser',
		version: '^4.50.1',
		license: 'MIT',
		url: 'https://npmjs.com/package/@rollup/browser'
	},
	{
		name: '@strudel/codemirror',
		version: '^1.2.2',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/codemirror'
	},
	{
		name: '@strudel/core',
		version: '^1.2.2',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/core'
	},
	{
		name: '@strudel/draw',
		version: '^1.2.2',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/draw'
	},
	{
		name: '@strudel/hydra',
		version: '^1.2.2',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/hydra'
	},
	{
		name: '@strudel/mini',
		version: '^1.2.2',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/mini'
	},
	{
		name: '@strudel/midi',
		version: '^1.2.3',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/midi'
	},
	{
		name: '@strudel/repl',
		version: '^1.2.3',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/repl'
	},
	{
		name: '@strudel/soundfonts',
		version: '^1.2.3',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/soundfonts'
	},
	{
		name: '@strudel/tonal',
		version: '^1.2.2',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/tonal'
	},
	{
		name: '@strudel/transpiler',
		version: '^1.2.2',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/transpiler'
	},
	{
		name: '@strudel/web',
		version: '^1.2.3',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/web'
	},
	{
		name: '@strudel/webaudio',
		version: '^1.2.3',
		license: 'AGPL-3.0',
		url: 'https://npmjs.com/package/@strudel/webaudio'
	},
	{
		name: '@sveltejs/adapter-cloudflare',
		version: '^7.0.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/@sveltejs/adapter-cloudflare'
	},
	{
		name: '@sveltejs/adapter-static',
		version: '^3.0.8',
		license: 'MIT',
		url: 'https://npmjs.com/package/@sveltejs/adapter-static'
	},
	{
		name: '@sveltejs/kit',
		version: '^2.22.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/@sveltejs/kit'
	},
	{
		name: '@uiw/codemirror-theme-tokyo-night',
		version: '^4.24.2',
		license: 'MIT',
		url: 'https://npmjs.com/package/@uiw/codemirror-theme-tokyo-night'
	},
	{
		name: '@xyflow/svelte',
		version: '^1.2.2',
		license: 'MIT',
		url: 'https://npmjs.com/package/@xyflow/svelte'
	},
	{
		name: 'butterchurn',
		version: '^2.6.7',
		license: 'MIT',
		url: 'https://npmjs.com/package/butterchurn'
	},
	{
		name: 'butterchurn-presets',
		version: '^2.4.7',
		license: 'MIT',
		url: 'https://npmjs.com/package/butterchurn-presets'
	},
	{
		name: 'codemirror',
		version: '^6.0.2',
		license: 'MIT',
		url: 'https://npmjs.com/package/codemirror'
	},
	{
		name: 'expr-eval',
		version: '^2.0.2',
		license: 'MIT',
		url: 'https://npmjs.com/package/expr-eval'
	},
	{
		name: 'fuse.js',
		version: '^7.1.0',
		license: 'Apache-2.0',
		url: 'https://npmjs.com/package/fuse.js'
	},
	{
		name: 'highlight.js',
		version: '^11.11.1',
		license: 'BSD-3-Clause',
		url: 'https://npmjs.com/package/highlight.js'
	},
	{
		name: 'hydra-ts',
		version: '^1.0.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/hydra-ts'
	},
	{ name: 'json5', version: '^2.2.3', license: 'MIT', url: 'https://npmjs.com/package/json5' },
	{
		name: 'lezer-glsl',
		version: '^0.6.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/lezer-glsl'
	},
	{ name: 'lodash', version: '^4.17.21', license: 'MIT', url: 'https://npmjs.com/package/lodash' },
	{
		name: 'machine',
		version: './src/assets/vasm',
		license: 'MIT',
		url: 'https://npmjs.com/package/machine'
	},
	{ name: 'marked', version: '^16.1.2', license: 'MIT', url: 'https://npmjs.com/package/marked' },
	{
		name: 'matter-js',
		version: '^0.20.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/matter-js'
	},
	{ name: 'memfs', version: '^4.39.0', license: 'MIT', url: 'https://npmjs.com/package/memfs' },
	{ name: 'meyda', version: '^5.6.3', license: 'MIT', url: 'https://npmjs.com/package/meyda' },
	{ name: 'ml5', version: '^1.2.1', license: 'MIT', url: 'https://npmjs.com/package/ml5' },
	{ name: 'p5', version: '^1.11.9', license: 'LGPL-2.1', url: 'https://npmjs.com/package/p5' },
	{
		name: 'pocketbase',
		version: '^0.26.2',
		license: 'Other',
		url: 'https://npmjs.com/package/pocketbase'
	},
	{ name: 'pyodide', version: '^0.28.1', license: 'MIT', url: 'https://npmjs.com/package/pyodide' },
	{ name: 'regl', version: '^2.1.1', license: 'MIT', url: 'https://npmjs.com/package/regl' },
	{
		name: 'stats.js',
		version: '^0.17.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/stats.js'
	},
	{ name: 'tone', version: '^15.1.22', license: 'MIT', url: 'https://npmjs.com/package/tone' },
	{
		name: 'ts-pattern',
		version: '^5.8.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/ts-pattern'
	},
	{
		name: 'vite-plugin-static-copy',
		version: '^3.1.1',
		license: 'MIT',
		url: 'https://npmjs.com/package/vite-plugin-static-copy'
	},
	{
		name: 'webchuck',
		version: '^1.2.10',
		license: 'Apache-2.0',
		url: 'https://npmjs.com/package/webchuck'
	},
	{
		name: 'webmidi',
		version: '^3.1.12',
		license: 'Apache-2.0',
		url: 'https://npmjs.com/package/webmidi'
	}
];

export const dependenciesSection: DependenciesSection = {
	title: 'Awesome packages we use',
	description: 'Complete list of all third-party packages used in Patchies, sorted alphabetically:',
	dependencies
};
