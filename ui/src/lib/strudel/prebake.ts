export async function prebake() {
  // Load superdough first to initialize AudioWorklets
  // @ts-expect-error -- no typedef
  const superdough = await import('superdough');

  // Initialize audio worklets BEFORE registering synth sounds
  // This loads the AudioWorkletProcessors (supersaw-oscillator, etc.) into the AudioContext
  await superdough.initAudio();

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
  ] = await Promise.all([
    import('@strudel/core'),
    import('@strudel/draw'),
    import('@strudel/mini'),
    import('@strudel/tonal'),
    import('@strudel/webaudio'),
    import('@strudel/codemirror'),
    import('@strudel/hydra'),
    import('@strudel/soundfonts'),
    import('@strudel/midi')
  ]);

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
