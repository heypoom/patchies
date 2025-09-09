const POLY_SYNTH_JS = `setPortCount(1)

const synth = new Tone.PolySynth(Tone.Synth)
synth.connect(outputNode)

recv(message => {
  const now = Tone.now();
  
  synth.triggerAttack("D4", now);
  synth.triggerAttack("F4", now + 0.5);
  synth.triggerAttack("A4", now + 1);
  synth.triggerAttack("C5", now + 1.5);
  synth.triggerAttack("E5", now + 2);
  synth.triggerRelease(["D4", "F4", "A4", "C5", "E5"], now + 4);
})

return { cleanup: () => synth.dispose() }`;

export const TONE_JS_PRESETS = {
	'poly-synth.js': {
		type: 'tone~',
		data: { code: POLY_SYNTH_JS, messageInletCount: 1 }
	}
};
