export const VIRTUAL_MIDI_KEYBOARD_JS = `noDrag();
noOutput();
setTitle('MIDI Keyboard');
setPortCount(0, 1)

const START_NOTE = 60; // Middle C
const NUM_WHITE_KEYS = 14; // 2 Octaves
const activeNotes = new Set();

// Computer keyboard to MIDI mapping
const keyMap = {
  'a': 60, 'w': 61, 's': 62, 'e': 63, 'd': 64, 'f': 65, 't': 66, 'g': 67, 'y': 68, 'h': 69, 'u': 70, 'j': 71,
  'k': 72, 'o': 73, 'l': 74, 'p': 75, ';': 76
};

function sendNote(note, on) {
  if (on && !activeNotes.has(note)) {
    activeNotes.add(note);
    send({ type: 'noteOn', note: note, velocity: 255 });
  } else if (!on && activeNotes.has(note)) {
    activeNotes.delete(note);
    send({ type: 'noteOff', note: note, velocity: 0 });
  }
}

onKeyDown(e => {
  const note = keyMap[e.key.toLowerCase()];
  if (note) sendNote(note, true);
});

onKeyUp(e => {
  const note = keyMap[e.key.toLowerCase()];
  if (note) sendNote(note, false);
});

let lastMouseNote = null;

function draw() {
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, width, height);

  const wWidth = width / NUM_WHITE_KEYS;
  const bWidth = wWidth * 0.7;
  const bHeight = height * 0.6;

  const whiteKeys = [];
  const blackKeys = [];
  const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];

  // Calculate White Keys
  for (let i = 0; i < NUM_WHITE_KEYS; i++) {
    const note = START_NOTE + Math.floor(i / 7) * 12 + whiteOffsets[i % 7];
    whiteKeys.push({ note, x: i * wWidth, w: wWidth });
  }

  // Calculate Black Keys
  for (let i = 0; i < NUM_WHITE_KEYS - 1; i++) {
    const currentOffset = whiteOffsets[i % 7];
    const nextOffset = whiteOffsets[(i + 1) % 7];
    // If there is a whole step gap, place a black key
    if (nextOffset - currentOffset === 2 || (nextOffset === 0 && currentOffset === 11)) {
      const note = START_NOTE + Math.floor(i / 7) * 12 + currentOffset + 1;
      blackKeys.push({ note, x: (i + 1) * wWidth - bWidth / 2, w: bWidth });
    }
  }

  // Mouse Interaction Logic
  let hoveredNote = null;
  if (mouse.down) {
    // Check black keys first (they are on top)
    for (const k of blackKeys) {
      if (mouse.x > k.x && mouse.x < k.x + k.w && mouse.y < bHeight) {
        hoveredNote = k.note;
        break;
      }
    }
    // If no black key, check white keys
    if (hoveredNote === null) {
      for (const k of whiteKeys) {
        if (mouse.x > k.x && mouse.x < k.x + k.w) {
          hoveredNote = k.note;
          break;
        }
      }
    }
  }

  // Handle mouse state changes
  if (hoveredNote !== lastMouseNote) {
    if (lastMouseNote !== null) sendNote(lastMouseNote, false);
    if (hoveredNote !== null) sendNote(hoveredNote, true);
    lastMouseNote = hoveredNote;
  }

  // Render White Keys
  whiteKeys.forEach(k => {
    ctx.fillStyle = activeNotes.has(k.note) ? '#4ade80' : '#ffffff';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(k.x, 0, k.w, height, [0, 0, 4, 4]);
    ctx.fill();
    ctx.stroke();
  });

  // Render Black Keys
  blackKeys.forEach(k => {
    ctx.fillStyle = activeNotes.has(k.note) ? '#22c55e' : '#27272a';
    ctx.beginPath();
    ctx.roundRect(k.x, 0, k.w, bHeight, [0, 0, 4, 4]);
    ctx.fill();
  });

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
