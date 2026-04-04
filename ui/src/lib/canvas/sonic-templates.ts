/**
 * Code templates for sonic~ nodes created via drag-and-drop.
 */

/**
 * Generate boilerplate code for a synthdef-based sonic~ node.
 * Handles MIDI noteOn/noteOff with polyphonic voice management.
 */
export function synthdefTemplate(safeSynthdef: string): string {
  return `setPortCount(1);

const name = "${safeSynthdef}";
setTitle(name);

await sonic.loadSynthDef(name);

const activeNotes = new Map();
let nextNodeId = sonic.nextNodeId();

recv(msg => {
  if (!msg || typeof msg !== 'object') return;

  const { type, note, velocity } = msg;

  if (type === 'noteOn') {
    if (activeNotes.has(note)) {
      sonic.send('/n_set', activeNotes.get(note), 'gate', 0);
    }

    const id = nextNodeId++;
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

sonic.on('error', e => console.error('error:', e));

sonic.on('in', msg => {
  if (msg[0] === '/fail') console.error('fail:', msg);
});

onCleanup(() => {
  activeNotes.forEach(id => sonic.send('/n_free', id));
  activeNotes.clear();
});`;
}

/**
 * Generate boilerplate code for a sample-player sonic~ node.
 * Loads a sample and plays it on any incoming message.
 */
export function scSampleTemplate(safeName: string): string {
  return `setPortCount(1);
setTitle("${safeName}");

await sonic.loadSynthDef('sonic-pi-basic_stereo_player');
await sonic.loadSample(0, '${safeName}.flac');
await sonic.sync();

recv(() => {
  sonic.send('/s_new', 'sonic-pi-basic_stereo_player', -1, 0, 0,
    'buf', 0, 'rate', 1, 'out_bus', outBus);
});`;
}
