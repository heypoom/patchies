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

export interface PortedCode {
	name: string;
	description: string;
	authors: string;
	repository: string;
	license: string;
	copyright?: string;
	notes?: string;
}

export const projectLicense: LicenseSection = {
	title: 'Project License',
	description: 'Patchies is licensed under the GNU Affero General Public License v3.0:',
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
		license: 'Apache-2.0',
		url: 'https://npmjs.com/package/@google/genai'
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
	{
		name: 'mode-watcher',
		version: '0.5.1',
		license: 'MIT',
		url: 'https://npmjs.com/package/mode-watcher'
	},
	{ name: 'ohash', version: '^2.0.11', license: 'MIT', url: 'https://npmjs.com/package/ohash' },
	{
		name: 'overtype',
		version: '^1.1.1',
		license: 'MIT',
		url: 'https://npmjs.com/package/overtype'
	},
	{ name: 'p2pkit', version: '^0.0.0-2', license: 'MIT', url: 'https://npmjs.com/package/p2pkit' },
	{ name: 'p2pt', version: '^1.5.1', license: 'MIT', url: 'https://npmjs.com/package/p2pt' },
	{ name: 'p5', version: '^1.11.9', license: 'LGPL-2.1', url: 'https://npmjs.com/package/p5' },
	{
		name: 'trystero',
		version: '^0.22.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/trystero'
	},
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
	{
		name: 'supersonic-scsynth',
		version: '^0.25.5',
		license: 'Tiered: MIT (client) + GPL-3.0-or-later (core)',
		url: 'https://npmjs.com/package/supersonic-scsynth'
	},
	{
		name: 'textmode.filters.js',
		version: '^1.0.1',
		license: 'MIT',
		url: 'https://code.textmode.art'
	},
	{
		name: 'textmode.js',
		version: '^0.8.1',
		license: 'MIT',
		url: 'https://code.textmode.art'
	},
	{
		name: 'three',
		version: '^0.172.0',
		license: 'MIT',
		url: 'https://threejs.org'
	},
	{ name: 'tailwindcss', version: '^4.0.0', license: 'MIT', url: 'https://tailwindcss.com' },
	{ name: 'tone', version: '^15.1.22', license: 'MIT', url: 'https://npmjs.com/package/tone' },
	{
		name: 'ts-pattern',
		version: '^5.8.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/ts-pattern'
	},
	{
		name: 'uxn.wasm',
		version: '^0.9.0',
		license: 'MIT',
		url: 'https://npmjs.com/package/uxn.wasm'
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

export const portedCode: PortedCode[] = [
	{
		name: 'Orca',
		description:
			'The Orca node in Patchies is based on the Orca livecoding environment by Hundred Rabbits.',
		authors: 'Hundred Rabbits (Devine Lu Linvega and Rekka Bellum)',
		repository: 'https://github.com/hundredrabbits/Orca',
		license: 'MIT',
		copyright: '© Hundred Rabbits',
		notes:
			'Core modules (Orca.ts, Operator.ts, library.ts, Clock.ts, transpose.ts) were ported from the original desktop implementation. MIDI/IO system and renderer were rewritten for Patchies.'
	},
	{
		name: 'Uxn',
		description:
			'The Uxn node contains a port of the uxn5 emulator from Hundred Rabbits for running Uxn virtual machine programs.',
		authors: 'Devine Lu Linvega',
		repository: 'https://git.sr.ht/~rabbits/uxn5',
		license: 'MIT',
		copyright: '© 2020 Devine Lu Linvega',
		notes:
			'Ported to work within the Patchies patcher environment with integration for video chaining and message passing.'
	},
	{
		name: 'Superdough (patched)',
		description:
			'Superdough is used by the Strudel node for audio synthesis. Patchies includes a patched version with minor modifications.',
		authors: 'Felix Roos and Strudel contributors',
		repository: 'https://codeberg.org/uzu/strudel',
		license: 'AGPL-3.0',
		notes:
			'Package patch (superdough@1.2.3.patch) adds window globals for audio node integration: exposes destination gain node and audio node chains for connectivity with other Patchies audio objects.'
	},
	{
		name: 'Tailwind CSS Browser Runtime (adapted)',
		description:
			'The dom and vue nodes use an adapted version of the @tailwindcss/browser runtime for JIT CSS compilation in Shadow DOM.',
		authors: 'Tailwind Labs',
		repository: 'https://github.com/tailwindlabs/tailwindcss',
		license: 'MIT',
		copyright: '© Tailwind Labs',
		notes:
			'Adapted from @tailwindcss/browser to work within Shadow DOM for style isolation. The implementation creates a shared Tailwind compiler and per-shadow-root style injection with MutationObserver for class detection.'
	}
];

export interface SupportLink {
	name: string;
	description: string;
	category: 'library' | 'educator' | 'tool';
	url: string;
	type: 'patreon' | 'opencollective' | 'github' | 'donate' | 'book' | 'website' | 'repo';
	projects?: string[];
}

export const supportLinks: SupportLink[] = [
	{
		name: 'Sam Aaron',
		description: 'Creator of Sonic Pi and SuperSonic',
		category: 'library',
		url: 'https://www.patreon.com/samaaron',
		type: 'patreon',
		projects: ['Sonic Pi', 'SuperSonic', 'Tau5']
	},
	{
		name: 'Strudel & TidalCycles',
		description: 'Live coding music community and tools',
		category: 'library',
		url: 'https://opencollective.com/tidalcycles',
		type: 'opencollective',
		projects: ['Strudel', 'TidalCycles', 'Superdough']
	},
	{
		name: 'Hundred Rabbits',
		description: 'Creators of Orca and Uxn virtual machine',
		category: 'library',
		url: 'https://www.patreon.com/hundredrabbits',
		type: 'patreon',
		projects: ['Orca', 'Uxn', 'Thousand Rooms', 'Oquonie']
	},
	{
		name: 'Processing Foundation',
		description: 'Non-profit behind Processing and p5.js',
		category: 'library',
		url: 'https://processingfoundation.org/donate',
		type: 'donate',
		projects: ['p5.js', 'Processing']
	},
	{
		name: 'Marijn Haverbeke',
		description: 'Creator and maintainer of CodeMirror',
		category: 'library',
		url: 'https://github.com/sponsors/marijnh',
		type: 'github',
		projects: ['CodeMirror', 'ProseMirror']
	},
	{
		name: 'Nick Thompson',
		description: 'Creator of Elementary Audio',
		category: 'library',
		url: 'https://github.com/sponsors/nick-thompson',
		type: 'github',
		projects: ['Elementary Audio']
	},
	{
		name: 'Yotam Mann',
		description: 'Creator of Tone.js',
		category: 'library',
		url: 'https://github.com/sponsors/tambien',
		type: 'github',
		projects: ['Tone.js']
	},
	{
		name: '@humanbydefinition',
		description: 'Creator of Textmode.js',
		category: 'library',
		url: 'https://code.textmode.art/docs/support.html',
		type: 'donate',
		projects: ['Textmode.js']
	},
	{
		name: 'Olivia Jack',
		description: 'Creator of Hydra video synthesizer',
		category: 'library',
		url: 'https://ojack.xyz/',
		type: 'website',
		projects: ['Hydra']
	},
	{
		name: '@mrdoob',
		description: 'Creator of Three.js 3D graphics library',
		category: 'library',
		url: 'https://github.com/sponsors/mrdoob',
		type: 'github',
		projects: ['Three.js']
	},
	{
		name: 'Patt Vira',
		description: 'Creative coding educator and P5.js tutorial creator',
		category: 'educator',
		url: 'https://www.pattvira.com',
		type: 'website',
		projects: ['P5.js tutorials', 'SPARK program']
	},
	{
		name: 'Compudanzas',
		description: 'Educational resources for Uxn programming',
		category: 'educator',
		url: 'https://compudanzas.itch.io/introduction-to-uxn-programming',
		type: 'book',
		projects: ['Uxn tutorials']
	},
	{
		name: 'Daniel Shiffman',
		description: 'Creator of The Coding Train and Nature of Code',
		category: 'educator',
		url: 'https://natureofcode.com/',
		type: 'book',
		projects: ['Nature of Code', 'The Coding Train']
	},
	{
		name: 'Sindre Sorhus',
		description: 'Prolific open source contributor and maintainer',
		category: 'tool',
		url: 'https://github.com/sponsors/sindresorhus',
		type: 'github',
		projects: ['globals', 'escape-string-regexp', 'find-up', 'p-limit', 'many utilities']
	},
	{
		name: 'Feross Aboukhadijeh',
		description: 'Creator of WebTorrent and many popular web libraries',
		category: 'tool',
		url: 'https://github.com/sponsors/feross',
		type: 'github',
		projects: ['simple-peer', 'buffer', 'base64-js', 'unmute-ios-audio']
	},
	{
		name: 'Andrey Sitnik',
		description: 'Creator of PostCSS, Autoprefixer, and Nano Stores',
		category: 'tool',
		url: 'https://github.com/sponsors/ai',
		type: 'github',
		projects: ['PostCSS', 'nanostores', '@nanostores/persistent']
	},
	{
		name: 'Anthony Fu',
		description: 'Core team member of Vite, Vue, and Nuxt',
		category: 'tool',
		url: 'https://github.com/sponsors/antfu',
		type: 'github',
		projects: ['Vitest', 'strip-literal', 'error-stack-parser-es']
	},
	{
		name: 'Karolis Narkevicius',
		description: 'Creator of thi.ng umbrella libraries for creative coding',
		category: 'tool',
		url: 'https://github.com/sponsors/postspectacular',
		type: 'github',
		projects: ['@thi.ng/malloc', '@thi.ng/api', 'thi.ng ecosystem']
	},
	{
		name: 'ESLint',
		description: 'Pluggable JavaScript linter',
		category: 'tool',
		url: 'https://eslint.org/donate',
		type: 'donate',
		projects: ['ESLint', 'eslint-config-prettier']
	},
	{
		name: 'Vitest',
		description: 'Fast unit test framework powered by Vite',
		category: 'tool',
		url: 'https://opencollective.com/vitest',
		type: 'opencollective',
		projects: ['Vitest', 'vitest-browser-svelte']
	},
	{
		name: 'PostCSS',
		description: 'Tool for transforming CSS with JavaScript',
		category: 'tool',
		url: 'https://opencollective.com/postcss/',
		type: 'opencollective',
		projects: ['PostCSS', 'postcss-safe-parser']
	},
	{
		name: 'core-js',
		description: 'Modular standard library for JavaScript',
		category: 'tool',
		url: 'https://opencollective.com/core-js',
		type: 'opencollective',
		projects: ['core-js']
	},
	{
		name: 'Csound',
		description: 'Powerful audio programming language with decades of development',
		category: 'library',
		url: 'https://csound.com/contribute.html',
		type: 'website',
		projects: ['Csound']
	},
	{
		name: 'XYFlow',
		description: 'Libraries for building node-based UIs with Svelte and React',
		category: 'library',
		url: 'https://github.com/sponsors/xyflow',
		type: 'github',
		projects: ['Svelte Flow', 'React Flow']
	},
	{
		name: 'Trystero',
		description: 'Serverless WebRTC matchmaking for P2P, powering netsend/netrecv',
		category: 'library',
		url: 'https://github.com/dmotz/trystero',
		type: 'repo',
		projects: ['Trystero']
	},
	{
		name: 'Svelte',
		description: 'JavaScript framework for building user interfaces',
		category: 'library',
		url: 'https://github.com/sponsors/sveltejs',
		type: 'github',
		projects: ['Svelte', 'SvelteKit']
	}
];
