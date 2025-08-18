import { LibraryLoader } from '$lib/lazyload/LibraryLoader';

export async function prebake() {
	const libraryLoader = LibraryLoader.getInstance();

	// Load all required modules
	const [
		strudelCore,
		strudelDraw,
		strudelMini,
		strudelTonal,
		strudelWebaudio,
		strudelCodemirror,
		strudelHydra,
		strudelSoundfonts,
		strudelMidi
	] = await libraryLoader.ensureModules(
		'@strudel/core',
		'@strudel/draw',
		'@strudel/mini',
		'@strudel/tonal',
		'@strudel/webaudio',
		'@strudel/codemirror',
		'@strudel/hydra',
		'@strudel/soundfonts',
		'@strudel/midi'
	);

	const { evalScope } = strudelCore;
	const { aliasBank, registerSynthSounds, registerZZFXSounds, samples } = strudelWebaudio;
	const { registerSoundfonts } = strudelSoundfonts;

	const modulesLoading = evalScope(
		strudelCore,
		strudelDraw,
		strudelMini,
		strudelTonal,
		strudelWebaudio,
		strudelCodemirror,
		strudelHydra,
		strudelSoundfonts,
		strudelMidi
	);

	// load samples
	const doughSamples = 'https://raw.githubusercontent.com/felixroos/dough-samples/main/';

	// TODO: move this onto the strudel repo
	const tidalSamples = 'https://raw.githubusercontent.com/todepond/samples/main/';

	await Promise.all([
		modulesLoading,
		registerSynthSounds(),
		registerZZFXSounds(),
		registerSoundfonts(),
		samples(`${doughSamples}/tidal-drum-machines.json`),
		samples(`${doughSamples}/piano.json`),
		samples(`${doughSamples}/Dirt-Samples.json`),
		samples(`${doughSamples}/EmuSP12.json`),
		samples(`${doughSamples}/vcsl.json`),
		samples(`${doughSamples}/mridangam.json`)
	]);

	aliasBank(`${tidalSamples}/tidal-drum-machines-alias.json`);

	// Add Pattern extensions
	const { noteToMidi, valueToMidi, Pattern } = strudelCore;
	const maxPan = noteToMidi('C8');
	const panwidth = (pan: number, width: number) => pan * width + (1 - width) / 2;

	Pattern.prototype.piano = function (this: any) {
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
}
