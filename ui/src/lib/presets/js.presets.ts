const MESSAGE_CONSOLE_JS = `onMessage(m => console.log(m))`;

const DELAY_JS = `onMessage(async (m) => {
  await delay(1000) // how long to wait for
  send(m)
})`;

const FRAME_TIMER_JS = `setInterval(() => {
  send({type: 'bang'})
}, 1000 / 60)`;

const MIDI_ADSR_GAIN_JS = `onMessage(m => {
  if (m.type === 'noteOn') {
    send({
      type: 'trigger',
      values: { start: 0, peak: 1, sustain: 0.7 },
      attack: { time: 0.02 },
      decay: { time: 0.1 }
    })
  } else if (m.type === 'noteOff') {
    send({ type: 'release', release: {time: 0.3}, endValue: 0 })
  }
})`;

export const JS_PRESETS: Record<
	string,
	{ type: string; data: { code: string; showConsole?: boolean; runOnMount?: boolean } }
> = {
	'message-console.js': {
		type: 'js',
		data: { code: MESSAGE_CONSOLE_JS.trim(), showConsole: true, runOnMount: true }
	},
	'delay.js': {
		type: 'js',
		data: { code: DELAY_JS.trim(), showConsole: false, runOnMount: true }
	},
	'frame-timer.js': {
		type: 'js',
		data: { code: FRAME_TIMER_JS, showConsole: false, runOnMount: false }
	},
	'midi-adsr-gain.js': {
		type: 'js',
		data: { code: MIDI_ADSR_GAIN_JS, showConsole: false, runOnMount: false }
	}
};
