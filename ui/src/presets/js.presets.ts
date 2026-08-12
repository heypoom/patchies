const MESSAGE_CONSOLE_JS = `setTitle('logger')
setPortCount(1, 0)
recv(m => console.log(m))`;

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

const MIDI_ADSR_GAIN_JS = `// JS-based ADSR
// Inlet 0: Gate (number or noteOn/noteOff)

setTitle("adsr");
setPortCount(1, 1);
setRunOnMount(true);

await settings.define([
  {
    key: "attack",
    label: "Attack (s)",
    type: "slider",
    min: 0,
    max: 10,
    default: 0.1,
    step: 0.01,
  },
  {
    key: "decay",
    label: "Decay (s)",
    type: "slider",
    min: 0,
    max: 10,
    default: 0.2,
    step: 0.01,
  },
  {
    key: "sustain",
    label: "Sustain (0-1)",
    type: "slider",
    min: 0,
    max: 1,
    default: 0.5,
    step: 0.01,
  },
  {
    key: "release",
    label: "Release (s)",
    type: "slider",
    min: 0,
    max: 10,
    default: 0.3,
    step: 0.01,
  },
]);

recv((m) => {
  const isOn = (typeof m === "number" && m > 0) || (m && m.type === "noteOn");

  const isOff =
    (typeof m === "number" && m === 0) || (m && m.type === "noteOff");

  if (isOn) {
    send({
      type: "trigger",
      values: {
        peak: 1,
        sustain: settings.get("sustain"),
      },
      attack: settings.get("attack"),
      decay: settings.get("decay"),
    });
  } else if (isOff) {
    send({
      type: "release",
      release: settings.get("release"),
      endValue: 0,
    });
  }
});`;

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

export const JS_PRESETS: Record<
  string,
  {
    type: string;
    description?: string;
    data: { code: string; showConsole?: boolean; runOnMount?: boolean };
  }
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
  'midi-adsr.js': {
    type: 'js',
    data: { code: MIDI_ADSR_GAIN_JS, showConsole: false, runOnMount: true }
  },
  'sawtooth-harmonics.js': {
    type: 'js',
    data: { code: SAWTOOTH_HARMONICS_JS, showConsole: false, runOnMount: true }
  },
  'waveshaper-distortion.js': {
    type: 'js',
    data: { code: WAVESHAPER_DISTORTION_JS, showConsole: false, runOnMount: false }
  },
  'js>': {
    type: 'js',
    description: 'Pipe messages through JavaScript',
    data: { code: PIPE_MESSAGE_JS, showConsole: false, runOnMount: true }
  }
};
