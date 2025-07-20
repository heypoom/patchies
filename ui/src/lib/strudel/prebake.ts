import { noteToMidi, valueToMidi, Pattern, evalScope } from '@strudel/core';
import { aliasBank, registerSynthSounds, registerZZFXSounds, samples } from '@strudel/webaudio';
import * as core from '@strudel/core';

export async function prebake() {
	const modulesLoading = evalScope(
		// import('@strudel/core'),
		core,
		import('@strudel/draw'),
		import('@strudel/mini'),
		import('@strudel/tonal'),
		import('@strudel/webaudio'),
		import('@strudel/codemirror'),
		import('@strudel/hydra'),
		import('@strudel/soundfonts'),
		import('@strudel/midi')
		// import('@strudel/xen'),
		// import('@strudel/serial'),
		// import('@strudel/csound'),
		// import('@strudel/osc'),
	);

	// load samples
	const doughSamples = 'https://raw.githubusercontent.com/felixroos/dough-samples/main/';

	// TODO: move this onto the strudel repo
	const tidalSamples = 'https://raw.githubusercontent.com/todepond/samples/main/';

	await Promise.all([
		modulesLoading,
		registerSynthSounds(),
		registerZZFXSounds(),
		//registerSoundfonts(),
		// need dynamic import here, because importing @strudel/soundfonts fails on server:
		// => getting "window is not defined", as soon as "@strudel/soundfonts" is imported statically
		// seems to be a problem with soundfont2
		import('@strudel/soundfonts').then(({ registerSoundfonts }) => registerSoundfonts()),
		samples(`${doughSamples}/tidal-drum-machines.json`),
		samples(`${doughSamples}/piano.json`),
		samples(`${doughSamples}/Dirt-Samples.json`),
		samples(`${doughSamples}/EmuSP12.json`),
		samples(`${doughSamples}/vcsl.json`),
		samples(`${doughSamples}/mridangam.json`)
	]);

	aliasBank(`${tidalSamples}/tidal-drum-machines-alias.json`);
}

const maxPan = noteToMidi('C8');
const panwidth = (pan: number, width: number) => pan * width + (1 - width) / 2;

Pattern.prototype.piano = function () {
	return this.fmap((v: unknown) => ({ ...v, clip: (v as Record<string, unknown>).clip ?? 1 })) // set clip if not already set..
		.s('piano')
		.release(0.1)
		.fmap((value: unknown) => {
			const midi = valueToMidi(value);
			// pan by pitch
			const pan = panwidth(Math.min(Math.round(midi) / maxPan, 1), 0.5);
			return { ...value, pan: ((value as Record<string, unknown>).pan || 1) * pan };
		});
};
