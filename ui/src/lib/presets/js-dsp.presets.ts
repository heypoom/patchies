const SNAPSHOT_JS_DSP = `const N = 0
let capture = false

setPortCount(1, 1)
setAudioPortCount(1, 0)
setTitle('snapshot~')

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

function process() {
  send({type: 'bang'})
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
	}
};
