const MESSAGE_CONSOLE_JS = `onMessage(m => console.log(m))`;

const DELAY_JS = `onMessage(async (m) => {
  await delay(1000) // how long to wait for
  send(m)
})`;

const SEND_EVERY_FRAME_JS = `setInterval(() => {
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

const FRAME_COUNTER_JS = `let i = 0

setInterval(() => {
  send(i++)
  if (i > 100) i=0
}, 1000 / 60)`;

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
	'send-every-frame.js': {
		type: 'js',
		data: { code: SEND_EVERY_FRAME_JS, showConsole: false, runOnMount: true }
	},
	'frame-counter.js': {
		type: 'js',
		data: { code: FRAME_COUNTER_JS, showConsole: false, runOnMount: true }
	},
	'midi-adsr-gain.js': {
		type: 'js',
		data: { code: MIDI_ADSR_GAIN_JS, showConsole: false, runOnMount: false }
	}
};
