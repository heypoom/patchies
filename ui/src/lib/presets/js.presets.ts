const MESSAGE_CONSOLE_JS = `recv(m => console.log(m))`;

const DELAY_JS = `recv(async (m) => {
  await delay(1000) // how long to wait for
  send(m)
})`;

const BANG_EVERY_FRAME_JS = `setRunOnMount(true)

const h = () => {
  send({ type: 'bang' })
  requestAnimationFrame(h)
}

requestAnimationFrame(h)`;

const MIDI_ADSR_GAIN_JS = `recv(m => {
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

const FRAME_COUNTER_JS = `setRunOnMount(true)

let i = 0

const h = () => {
  i %= 255
  i += 1
  send(i)
  requestAnimationFrame(h)
}

requestAnimationFrame(h)`;

const INTERVAL_JS = `setRunOnMount(true)

let i = 0

setInterval(() => {
  send(i++)
  if (i > 100) i=0
}, 1000)`;

const MIDI_CONTROL_ROUTER_JS = `setPortCount(1, 3)
recv(m => send(m.value, {to: m.control}))`;

const PIPE_MESSAGE_JS = `setRunOnMount(true)

recv(m => send(m))`;

const SAWTOOTH_HARMONICS_JS = `recv(hs => {
  const im = new Float32Array(hs)

  for (let i = 1; i < hs; i++) {
    im[i] = (i % 2 == 0 ? -1 : 1) / i
  }

  send([new Float32Array(hs), im])
})`;

const WAVESHAPER_DISTORTION_JS = `const k = 50
const s = 44100;
const curve = new Float32Array(s);
const deg = Math.PI / 180;

for (let i = 0; i < s; i++) {
  const x = (i * 2) / s - 1;
  curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
}

send(curve)`;

const ADD_JS = `let a = 1
let b = 2

setPortCount(2)
setRunOnMount(true)

recv((m, {inlet}) => {
  if (inlet == 0) a = m  
  if (inlet == 1) b = m

  send(a + b)
})`;

const ADD_COLD_JS = `let a = 1
let b = 2

setPortCount(2)
setRunOnMount(true)

recv((m, {inlet}) => {
  if (inlet == 0) {
    a = m
    send(a + b)
  }

  if (inlet == 1) b = m
})`;

export const JS_PRESETS: Record<
	string,
	{ type: string; data: { code: string; showConsole?: boolean; runOnMount?: boolean } }
> = {
	'logger.js': {
		type: 'js',
		data: { code: MESSAGE_CONSOLE_JS.trim(), showConsole: true, runOnMount: true }
	},
	'delay.js': {
		type: 'js',
		data: { code: DELAY_JS.trim(), showConsole: false, runOnMount: true }
	},
	'bang-every-frame.js': {
		type: 'js',
		data: { code: BANG_EVERY_FRAME_JS, showConsole: false, runOnMount: true }
	},
	'frame-counter.js': {
		type: 'js',
		data: { code: FRAME_COUNTER_JS, showConsole: false, runOnMount: true }
	},
	'interval.js': {
		type: 'js',
		data: { code: INTERVAL_JS, showConsole: false, runOnMount: true }
	},
	'midi-adsr-gain.js': {
		type: 'js',
		data: { code: MIDI_ADSR_GAIN_JS, showConsole: false, runOnMount: false }
	},
	'midi-control-router.js': {
		type: 'js',
		data: { code: MIDI_CONTROL_ROUTER_JS, showConsole: false, runOnMount: true }
	},
	'sawtooth-harmonics.js': {
		type: 'js',
		data: { code: SAWTOOTH_HARMONICS_JS, showConsole: false, runOnMount: true }
	},
	'waveshaper-distortion.js': {
		type: 'js',
		data: { code: WAVESHAPER_DISTORTION_JS, showConsole: false, runOnMount: false }
	},
	'pipe-msg.js': {
		type: 'js',
		data: { code: PIPE_MESSAGE_JS, showConsole: false, runOnMount: true }
	},
	'add.js': {
		type: 'js',
		data: { code: ADD_JS, showConsole: false, runOnMount: true }
	},
	'add-cold.js': {
		type: 'js',
		data: { code: ADD_COLD_JS, showConsole: false, runOnMount: true }
	}
};
