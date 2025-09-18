const SNAPSHOT_JS_DSP = `const N = 0
let capture = false

setPortCount(1, 1)

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

export const JS_DSP_PRESETS = {
	'snapshot~': {
		type: 'dsp~',
		data: {
			code: SNAPSHOT_JS_DSP,
			messageInletCount: 1,
			messageOutletCount: 1
		}
	}
};
