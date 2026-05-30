import { synthdefTemplate } from '$lib/canvas/sonic-templates';

export const SONIC_PRESETS = {
  'sonic-prophet': {
    type: 'sonic~',
    data: {
      code: synthdefTemplate('sonic-pi-prophet')
    }
  },
  'sonic-tb303': {
    type: 'sonic~',
    data: {
      code: synthdefTemplate('sonic-pi-tb303')
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
      code: `setPortCount(1);
setTitle('sonic-multi-synth');

const synths = ['sonic-pi-beep', 'sonic-pi-prophet', 'sonic-pi-saw'];
await sonic.loadSynthDefs(synths);

const activeNotes = new Map();
let idx = 0;

recv(msg => {
  if (!msg || typeof msg !== 'object') return;

  const { type, note, velocity } = msg;

  if (type === 'noteOn') {
    if (activeNotes.has(note)) {
      sonic.send('/n_set', activeNotes.get(note), 'gate', 0);
    }

    const id = sonic.nextNodeId();
    const name = synths[idx++ % synths.length];
    activeNotes.set(note, id);

    sonic.send('/s_new', name, id, 0, 0,
      'note', note,
      'amp', (velocity || 127) / 127,
      'gate', 1,
      'out_bus', outBus
    );
  } else if (type === 'noteOff') {
    const id = activeNotes.get(note);

    if (id !== undefined) {
      sonic.send('/n_set', id, 'gate', 0);
      activeNotes.delete(note);
    }
  }
});

onCleanup(() => {
  activeNotes.forEach(id => sonic.send('/n_free', id));
  activeNotes.clear();
});`
    }
  }
};
