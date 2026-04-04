import { patcherLibraryInstructions } from './shared-jsrunner';

export const sonicPrompt = `## sonic~ Object Instructions

SuperCollider synthesis via SuperSonic AudioWorklet.

**Available globals:**
- \`sonic\` — SuperSonic instance (already initialized)
- \`SuperSonic\` — Static utilities (e.g., \`SuperSonic.osc.encodeMessage()\`)
- \`on(event, callback)\` — Subscribe to SuperSonic events

**Sonic-specific gotchas:**
- fft() is NOT available (audio output node, not video)
- By default, the Prophet synth is loaded

${patcherLibraryInstructions}

## SuperSonic API

**Core methods:**
- \`sonic.send(address, ...args)\` — Send OSC message (auto-typed: number→int/float, string→s, boolean→T/F)
- \`sonic.sync(syncId?)\` — Wait for scsynth to finish pending async commands
- \`sonic.nextNodeId()\` — Get a unique node ID (thread-safe)

**Asset loading:**
- \`sonic.loadSynthDef(source)\` — Load synthdef by name, URL, bytes, or File
- \`sonic.loadSynthDefs(names[])\` — Load multiple synthdefs in parallel
- \`sonic.loadSample(bufnum, source, startFrame?, numFrames?)\` — Decode audio file into buffer
- \`sonic.sampleInfo(source)\` — Get sample metadata (frames, channels, sampleRate) without allocating

**Lifecycle:**
- \`sonic.suspend()\` / \`sonic.resume()\` — Pause/resume AudioContext
- \`sonic.reset()\` — Shutdown and re-init
- \`sonic.recover()\` — Smart recovery (resume or full reload)

**Monitoring:**
- \`sonic.getTree()\` — Hierarchical node tree
- \`sonic.getLoadedBuffers()\` — Info on all allocated buffers

**Events** (via \`on(event, cb)\`):
- \`'ready'\` — Engine fully booted
- \`'setup'\` — After init, before ready (async-friendly for group setup)
- \`'in'\` / \`'out'\` — Decoded OSC messages from/to scsynth
- \`'error'\` — Error messages from scsynth

**Static OSC utilities:**
- \`SuperSonic.osc.encodeMessage(address, args)\` — Encode OSC message to bytes
- \`SuperSonic.osc.encodeBundle(time, packets)\` — Encode timed bundle
- \`SuperSonic.osc.decode(bytes)\` — Decode OSC bytes
- \`SuperSonic.osc.ntpNow()\` — Current NTP timestamp (for bundles)

## OSC Command Reference

**Synth operations:**
- \`/s_new name nodeID addAction target [control value ...]\` — Create synth (addAction: 0=head, 1=tail, 2=before, 3=after)
- \`/n_set nodeID control value [...]\` — Set synth control values
- \`/n_setn nodeID control startIndex count values[]\` — Set consecutive controls
- \`/n_free nodeID [...]\` — Delete nodes
- \`/n_run nodeID flag\` — Enable (1) or disable (0) a node
- \`/n_map nodeID control busIndex [...]\` — Map control to control bus
- \`/n_mapa nodeID control busIndex [...]\` — Map control to audio bus

**Group management:**
- \`/g_new nodeID addAction target\` — Create group
- \`/g_head groupID nodeID\` — Move node to group head
- \`/g_tail groupID nodeID\` — Move node to group tail
- \`/g_freeAll groupID\` — Free all nodes in group
- \`/g_deepFree groupID\` — Recursively free all synths in group

**Buffer operations:**
- \`/b_alloc bufnum frames channels\` — Allocate empty buffer
- \`/b_allocRead bufnum path startFrame numFrames\` — Load audio file into buffer
- \`/b_free bufnum\` — Free buffer
- \`/b_set bufnum index value [...]\` — Set buffer samples
- \`/b_gen bufnum command args\` — Generate waveform (e.g., sine1, cheby)

**Control buses:**
- \`/c_set busIndex value [...]\` — Set control bus value
- \`/c_get busIndex\` — Read control bus value

**SynthDef management:**
- \`/d_recv data\` — Load synthdef from bytes
- \`/d_free name [...]\` — Unload synthdef

**Server:**
- \`/status\` — Get server metrics
- \`/sync id\` — Wait for async operations to complete

Example — simple synth controlled by frequency messages:
\`\`\`js
const id = sonic.nextNodeId();
sonic.send('/s_new', 'default', id, 1, 0, 'freq', 440, 'amp', 0.3);

recv(m => {
  if (typeof m === 'number') {
    sonic.send('/n_set', id, 'freq', m);
  }
});
\`\`\`

Example — MIDI-controlled polyphonic synth with note management:
\`\`\`js
setPortCount(1);
await sonic.loadSynthDef('sonic-pi-piano');

const activeNotes = new Map();
let nextId = sonic.nextNodeId();

recv(msg => {
  if (!msg || typeof msg !== 'object') return;

  const { type, note, velocity } = msg;

  if (type === 'noteOn') {
    if (activeNotes.has(note)) sonic.send('/n_set', activeNotes.get(note), 'gate', 0);

    const id = nextId++;
    activeNotes.set(note, id);

    sonic.send('/s_new', 'sonic-pi-piano', id, 0, 0,
      'note', note, 'amp', (velocity || 127) / 127, 'gate', 1);
  } else if (type === 'noteOff') {
    const id = activeNotes.get(note);

    if (id !== undefined) {
      sonic.send('/n_set', id, 'gate', 0); activeNotes.delete(note);
    }
  }
});

onCleanup(() => {
  activeNotes.forEach(id => sonic.send('/n_free', id));
  activeNotes.clear();
});
\`\`\``;
