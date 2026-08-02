export const VIRTUAL_MIDI_KEYBOARD_JS = `// Piano Keyboard with Note-Specific Colors & MIDI Passthru

// Z/X: Octave
// C/V: Transpose

noDrag();
noOutput();
hideBorder()

setTitle('MIDI Keyboard');
setPortCount(1, 1);
setPrimaryButton('settings')

const width = 2000;
const height = 800;
setCanvasSize(width, height);

// Define Settings Panel
await settings.define([
  { key: 'octave', label: 'Octave Offset', type: 'slider', min: -4, max: 4, default: 0 },
  { key: 'transpose', label: 'Transpose', type: 'slider', min: -12, max: 12, default: 0 },
  { key: 'octaveCount', label: 'Visible Octaves', type: 'slider', min: 1, max: 5, default: 2 }
]);

const START_NOTE = 48;
const activeNotes = new Set();
const keyToNoteMap = new Map();

// Minimal Palette
const colors = {
  bg: '#09090b',
  whiteKey: '#fafafa',
  blackKey: '#18181b',
  border: '#27272a',
  text: '#f4f4f5'
};

// Function to generate a unique color per semitone using HSL
function getNoteColor(note, active, isBlackKey) {
  const hue = (note % 12) * 30; // 12 notes * 30 degrees = 360

  if (active) {
    return \`hsl(\${hue}, 85%, \${isBlackKey ? '50%' : '60%'})\`;
  }

  return isBlackKey ? colors.blackKey : colors.whiteKey;
}

const keyMap = {
  'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4, 'f': 5, 't': 6, 'g': 7, 'y': 8, 'h': 9, 'u': 10, 'j': 11,
  'k': 12, 'o': 13, 'l': 14, 'p': 15, ';': 16, "'": 17
};

function getBaseNote() {
  return START_NOTE + (settings.get('octave') * 12) + settings.get('transpose');
}

// Handle internal UI triggers (Keyboard/Mouse)
function sendNote(note, on) {
  if (on && !activeNotes.has(note)) {
    activeNotes.add(note);
    send({ type: 'noteOn', note: note, velocity: 100 });
  } else if (!on && activeNotes.has(note)) {
    activeNotes.delete(note);
    send({ type: 'noteOff', note: note, velocity: 0 });
  }
}

// Handle external MIDI input via Inlet
recv((msg) => {
  if (msg.type === 'noteOn') {
    activeNotes.add(msg.note);
    send(msg); // Passthru to outlet
  } else if (msg.type === 'noteOff') {
    activeNotes.delete(msg.note);
    send(msg); // Passthru to outlet
  }
});

// Clear all notes if octave/transpose changes to avoid stuck notes
settings.onChange(() => {
  activeNotes.forEach(note => {
    send({ type: 'noteOff', note: note, velocity: 0 });
  });

  activeNotes.clear();
  keyToNoteMap.clear();
});

onKeyDown(e => {
  const key = e.key.toLowerCase();

  // Key bindings update the settings panel values
  if (key === 'z') settings.set('octave', settings.get('octave') - 1);
  if (key === 'x') settings.set('octave', settings.get('octave') + 1);
  if (key === 'c') settings.set('transpose', settings.get('transpose') - 1);
  if (key === 'v') settings.set('transpose', settings.get('transpose') + 1);

  const offset = keyMap[key];
  if (offset !== undefined && !keyToNoteMap.has(e.code)) {
    const midiNote = getBaseNote() + offset;
    keyToNoteMap.set(e.code, midiNote);
    sendNote(midiNote, true);
  }
});

onKeyUp(e => {
  const midiNote = keyToNoteMap.get(e.code);

  if (midiNote !== undefined) {
    sendNote(midiNote, false);
    keyToNoteMap.delete(e.code);
  }
});

let lastMouseNote = null;

function draw() {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  const octaves = settings.get('octaveCount');
  const whiteKeyCount = octaves * 7;
  const kw = width / whiteKeyCount;
  const bw = kw * 0.6;
  const bh = height * 0.6;

  const whiteKeys = [];
  const blackKeys = [];
  const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];
  const base = getBaseNote();

  for (let i = 0; i < whiteKeyCount; i++) {
    const octave = Math.floor(i / 7);
    const note = base + (octave * 12) + whiteOffsets[i % 7];
    whiteKeys.push({ note, x: i * kw, w: kw });

    const posInOctave = i % 7;

    if (posInOctave !== 2 && posInOctave !== 6 && i < whiteKeyCount - 1) {
      blackKeys.push({
        note: note + 1,
        x: (i + 1) * kw - bw / 2,
        w: bw
      });
    }
  }

  // Mouse Interaction
  let hoveredNote = null;

  if (mouse.down) {
    for (const k of blackKeys) {
      if (mouse.x >= k.x && mouse.x <= k.x + k.w && mouse.y <= bh) {
        hoveredNote = k.note;
        break;
      }
    }

    if (hoveredNote === null) {
      for (const k of whiteKeys) {
        if (mouse.x >= k.x && mouse.x <= k.x + k.w) {
          hoveredNote = k.note;
          break;
        }
      }
    }
  }

  if (hoveredNote !== lastMouseNote) {
    if (lastMouseNote !== null) sendNote(lastMouseNote, false);
    if (hoveredNote !== null) sendNote(hoveredNote, true);

    lastMouseNote = hoveredNote;
  }

  // Render White Keys
  whiteKeys.forEach(k => {
    const active = activeNotes.has(k.note);
    ctx.fillStyle = getNoteColor(k.note, active, false);
    ctx.fillRect(k.x + 2, 0, k.w - 4, height);

    ctx.fillStyle = \`hsl(\${(k.note % 12) * 30}, 70%, 50%)\`;
    ctx.fillRect(k.x + 2, height - 20, k.w - 4, 20);
  });

  // Render Black Keys
  blackKeys.forEach(k => {
    const active = activeNotes.has(k.note);
    ctx.fillStyle = getNoteColor(k.note, active, true);
    ctx.fillRect(k.x, 0, k.w, bh);

    ctx.fillStyle = \`hsl(\${(k.note % 12) * 30}, 70%, 50%)\`;
    ctx.fillRect(k.x, bh - 16, k.w, 16);
  });

  requestAnimationFrame(draw);
}

draw();`;

export const virtualMidiKeyboardPreset = {
  type: 'canvas.dom' as const,
  data: {
    code: VIRTUAL_MIDI_KEYBOARD_JS,
    inletCount: 1,
    outletCount: 1
  }
};
