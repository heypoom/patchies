export const SONIC_PRESETS = {
	'sonic-prophet': {
		type: 'sonic~',
		data: {
			code: `setPortCount(1)

await sonic.loadSynthDef('sonic-pi-prophet')

recv(msg => {
  const note = typeof msg === 'number' ? msg : 60

  sonic.send('/s_new', 'sonic-pi-prophet', -1, 0, 0, 'note', msg, 'release', 2)
})`
		}
	},
	'sonic-tb303': {
		type: 'sonic~',
		data: {
			code: `setPortCount(1)

await sonic.loadSynthDef('sonic-pi-tb303')

recv(msg => {
  const note = typeof msg === 'number' ? msg : 60

  sonic.send('/s_new', 'sonic-pi-tb303', -1, 0, 0, 'note', msg, 'cutoff', 80, 'res', 0.9)
})`
		}
	},
	'sonic-sample-loop': {
		type: 'sonic~',
		data: {
			code: `setPortCount(1)

// Track loading state
on('loading:start', ({type, name}) => console.log(\`Loading \${type}: \${name}\`))
on('loading:complete', ({type, name}) => console.log(\`Loaded \${type}: \${name}\`))

await sonic.loadSynthDef('sonic-pi-basic_stereo_player')
await sonic.loadSample(0, 'loop_amen.flac')
await sonic.sync()

// Trigger sample playback when receiving messages
recv(msg => {
  // Send bang to trigger, or number for rate control
  if (msg?.type === 'bang') {
    sonic.send('/s_new', 'sonic-pi-basic_stereo_player', -1, 0, 0, 'buf', 0, 'rate', 1)
  } else if (typeof msg === 'number') {
    sonic.send('/s_new', 'sonic-pi-basic_stereo_player', -1, 0, 0, 'buf', 0, 'rate', msg)
  }
})`
		}
	},
	'sonic-multi-synth': {
		type: 'sonic~',
		data: {
			code: `setPortCount(1)

// Load multiple synthdefs efficiently
await sonic.loadSynthDefs(['sonic-pi-beep', 'sonic-pi-prophet', 'sonic-pi-saw'])

const synths = ['sonic-pi-beep', 'sonic-pi-prophet', 'sonic-pi-saw']
let idx = 0

recv(msg => {
  const note = typeof msg === 'number' ? msg : 60

  sonic.send('/s_new', synths[idx++ % synths.length], -1, 0, 0, 'note', msg)
})`
		}
	}
};
