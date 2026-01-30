export const VIRTUAL_MIDI_KEYBOARD_JS = `// from @kijjaz

noDrag();
noOutput();
setTitle('Piano Keyboard');
setPortCount(0, 1);

const START_NOTE = 48; // Base C3
const OCTAVES = 2;
const activeNotes = new Set();
const keyToNoteMap = new Map(); // Maps keyboard event codes to MIDI notes

let octaveOffset = 0;
let transposeOffset = 0;
let showHelp = false;

// Keyboard mapping (standard row: a,w,s,e...)
const keyMap = {
  'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4, 'f': 5, 't': 6, 'g': 7, 'y': 8, 'h': 9, 'u': 10, 'j': 11,
  'k': 12, 'o': 13, 'l': 14, 'p': 15, ';': 16, "'": 17
};

function getBaseNote() {
  return START_NOTE + (octaveOffset * 12) + transposeOffset;
}

function sendNote(note, on) {
  if (on && !activeNotes.has(note)) {
    activeNotes.add(note);
    send({ type: 'noteOn', note: note, velocity: 100 });
  } else if (!on && activeNotes.has(note)) {
    activeNotes.delete(note);
    send({ type: 'noteOff', note: note, velocity: 0 });
  }
}

onKeyDown(e => {
  const key = e.key.toLowerCase();
  
  // Control keys
  if (key === 'z') octaveOffset--;
  if (key === 'x') octaveOffset++;
  if (key === 'c') transposeOffset--;
  if (key === 'v') transposeOffset++;
  if (key === '?' || key === '/') showHelp = !showHelp;

  // Note keys
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
  // Clear background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, width, height);

  const whiteKeyCount = OCTAVES * 7;
  const kw = width / whiteKeyCount;
  const kh = height;
  const bw = kw * 0.7;
  const bh = kh * 0.62;

  const whiteKeys = [];
  const blackKeys = [];
  
  const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];
  const base = getBaseNote();
  
  // 1. Calculate positions
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

  // 2. Interaction logic (Mouse)
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

  // 3. Render White Keys
  whiteKeys.forEach(k => {
    const active = activeNotes.has(k.note);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#eee');
    grad.addColorStop(0.9, active ? '#4ade80' : '#fff');
    grad.addColorStop(1, active ? '#22c55e' : '#ddd');
    
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(k.x + 1, 0, k.w - 2, kh - 2, [0, 0, 4, 4]);
    ctx.fill();
    ctx.stroke();
  });

  // 4. Render Black Keys
  blackKeys.forEach(k => {
    const active = activeNotes.has(k.note);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    const grad = ctx.createLinearGradient(k.x, 0, k.x + k.w, 0);
    grad.addColorStop(0, '#333');
    grad.addColorStop(0.5, active ? '#15803d' : '#444');
    grad.addColorStop(1, '#000');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(k.x, 0, k.w, bh, [0, 0, 3, 3]);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();
  });

  // UI Overlays
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, 4);

  // Stats
  ctx.fillStyle = 'white';
  ctx.font = '10px monospace';
  ctx.fillText(\`Oct: \${octaveOffset} | Trans: \${transposeOffset} | [?] Help\`, 10, height - 10);

  // Help Page
  if (showHelp) {
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('PIANO KEYBOARD CONTROLS', 30, 50);
    
    ctx.fillStyle = '#eee';
    ctx.font = '16px monospace';
    const lines = [
      'A S D F G H J K L : Play White Keys',
      'W E T Y U O P     : Play Black Keys',
      '------------------------------------',
      'Z / X : Octave Down / Up',
      'C / V : Transpose -1 / +1 Semitone',
      '?     : Toggle this Help screen',
      'Mouse : Click and slide to play',
      '',
      \`Current Base MIDI Note: \${getBaseNote()}\`
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, 30, 90 + (i * 26));
    });
  }

  requestAnimationFrame(draw);
}

draw();`;

export const virtualMidiKeyboardPreset = {
  type: 'canvas.dom' as const,
  data: {
    code: VIRTUAL_MIDI_KEYBOARD_JS,
    inletCount: 0,
    outletCount: 1
  }
};
