const SNAPSHOT_JS_DSP = `const N = 0
let capture = false

setPortCount(1, 1)
setAudioPortCount(1, 0)
setTitle('snapshot~')
setKeepAlive(true)

recv(m => {
  if (m.type === 'bang') {
    capture = true
  }
})

function process(inputs, outputs) {
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      if (capture) {
        send(inputs[0][i][N])
        capture = false
      }
      
      channel[i] = inputs[0][i]
    }
  })
}`;

const BANG_JS_DSP = `setPortCount(0, 1)
setAudioPortCount(0, 0)
setTitle('bang~')
setKeepAlive(true)

function process() {
  send({type: 'bang'})
}`;

const NOISE_JS_DSP = `setPortCount(0, 0)
setAudioPortCount(0, 1)
setTitle('noise~')

function process(inputs, outputs) {
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.random() * 2 - 1
    }
  })
}`;

const TABOSC_JS_DSP = `setPortCount(1, 0)
setAudioPortCount(0, 1)
setTitle('tabosc~')

let table = new Float32Array(512)
let phase = 0
let freq = 440

recv((msg) => {
  if (typeof msg === 'number') {
    freq = msg
  } else if (msg instanceof Float32Array) {
    table = msg
  }
})

function process(inputs, outputs) {
  const output = outputs[0][0]

  for (let i = 0; i < output.length; i++) {
    const idx = phase * (table.length - 1)
    output[i] = table[Math.floor(idx)]

    phase += freq / sampleRate
    if (phase >= 1) phase -= 1
  }
}`;

export const JS_DSP_PRESETS = {
  'snapshot~': {
    type: 'dsp~',
    data: {
      title: 'snapshot~',
      code: SNAPSHOT_JS_DSP,
      messageInletCount: 1,
      messageOutletCount: 1,
      audioInletCount: 1,
      audioOutletCount: 0
    }
  },
  'bang~': {
    type: 'dsp~',
    data: {
      title: 'bang~',
      code: BANG_JS_DSP,
      messageInletCount: 0,
      messageOutletCount: 1,
      audioInletCount: 0,
      audioOutletCount: 0
    }
  },
  'noise~': {
    type: 'dsp~',
    data: {
      title: 'noise~',
      code: NOISE_JS_DSP,
      messageInletCount: 0,
      messageOutletCount: 0,
      audioInletCount: 0,
      audioOutletCount: 1
    }
  },
  'tabosc~': {
    type: 'dsp~',
    data: {
      title: 'tabosc~',
      code: TABOSC_JS_DSP,
      messageInletCount: 1,
      messageOutletCount: 0,
      audioInletCount: 0,
      audioOutletCount: 1
    }
  }
};
