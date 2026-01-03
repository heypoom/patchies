const POLY_SYNTH_TRIGGER_JS = `setPortCount(1)

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

const POLY_SYNTH_MIDI_JS = `setPortCount(1)

const reverb = new Tone.Reverb({
  decay: 2,
  wet: 0.3
}).connect(outputNode);

const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: {
    type: "fatsine",
    count: 1,
    spread: 3
  },
  envelope: {
    attack: 0.01,
    release: 0.9
  }
}).connect(reverb);

reverb.generate();

recv(m => {
  const now = Tone.now();

  if (m.type === 'noteOn') {
    const freq = Tone.Frequency(m.note, "midi").toNote();
    const velocity = m.velocity / 127;
    
    synth.triggerAttack(freq, now, velocity);
  } else if (m.type === 'noteOff') {
    const freq = Tone.Frequency(m.note, "midi").toNote();
    
    synth.triggerRelease(freq, now);
  } else if (m.type === 'pitchBend') {
    synth.set({ detune: m.value * 200 });
  }
})

return { 
  cleanup: () => {
    synth.dispose();
    reverb.dispose();
  } 
}`;

const PIPE_JS = `inputNode.connect(outputNode)

return { cleanup: () => inputNode.disconnect(outputNode) }`;

const REVERB_JS = `setPortCount(0)

const reverb = new Tone.Reverb({
  decay: 2,
  wet: 0.3
})

inputNode.connect(reverb.input.input)
reverb.connect(outputNode)
reverb.generate()

return { 
  cleanup: () => reverb.dispose()
}`;

const LOWPASS_JS = `setPortCount(1)

const filter = new Tone.Filter(5000, "lowpass")
inputNode.connect(filter.input.input)
filter.connect(outputNode)

recv(m => {
  filter.frequency.value = m;
})

return { cleanup: () => filter.dispose() }`;

export const TONE_JS_PRESETS = {
	'poly-synth-trigger.tone': {
		type: 'tone~',
		data: { code: POLY_SYNTH_TRIGGER_JS, messageInletCount: 1 }
	},
	'poly-synth-midi.tone': {
		type: 'tone~',
		data: { code: POLY_SYNTH_MIDI_JS, messageInletCount: 1 }
	},
	'pipe.tone': {
		type: 'tone~',
		data: { code: PIPE_JS, messageInletCount: 0 }
	},
	'reverb.tone': {
		type: 'tone~',
		data: { code: REVERB_JS, messageInletCount: 0 }
	},
	'lowpass.tone': {
		type: 'tone~',
		data: { code: LOWPASS_JS, messageInletCount: 1 }
	}
};
