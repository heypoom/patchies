const RGBA_GRID_JS = `setRunOnMount(true)
setTitle('rgba grid')

const W = 50
const H = 50
const data = new Float32Array(W * H * 4)

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const u = x / (W - 1)
    const v = y / (H - 1)

    data[i + 0] = u
    data[i + 1] = v
    data[i + 2] = 1 - u
    data[i + 3] = 1
  }
}

send({
  type: 'rgba',
  data,
  width: W,
  height: H
})`;

const SQUARE_FIELD_JS = `setRunOnMount(true)
setTitle('square field')

const SIZE = 32
const S = SIZE * SIZE
const BYTES = S * Float32Array.BYTES_PER_ELEMENT

const xBuffer = new SharedArrayBuffer(BYTES)
const yBuffer = new SharedArrayBuffer(BYTES)
const zBuffer = new SharedArrayBuffer(BYTES)
const wBuffer = new SharedArrayBuffer(BYTES)

const x = new Float32Array(xBuffer)
const y = new Float32Array(yBuffer)
const z = new Float32Array(zBuffer)
const w = new Float32Array(wBuffer)

let version = 0

function frame() {
  version++

  const t = performance.now() * 0.001

  for (let i = 0; i < S; i++) {
    const u = (i % SIZE) / (SIZE - 1)
    const v = Math.floor(i / SIZE) / (SIZE - 1)
    const dx = u * 2 - 1
    const dy = v * 2 - 1
    const d = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)
    const twist = Math.sin(t * 0.9 + d * 8) * 0.18

    x[i] = dx + Math.cos(angle + t) * twist
    y[i] = dy + Math.sin(angle + t) * twist
    z[i] = Math.sin(d * 18 - t * 4)
    w[i] = 1
  }

  send({
    type: 'square',
    channels: [xBuffer, yBuffer, zBuffer, wBuffer],
    format: 'rgba',
    textureFormat: 'rgba16f',
    version
  })
}

frame()
setInterval(frame, 1000 / 24)`;

const WRAPPED_WAVE_JS = `setRunOnMount(true)
setTitle('wrapped wave')

const S = 240
const r = new Float32Array(S)
const g = new Float32Array(S)
const b = new Float32Array(S)
const a = new Float32Array(S)

for (let i = 0; i < S; i++) {
  const t = i / (S - 1)
  const wave = Math.sin(t * Math.PI * 8) * 0.5 + 0.5

  r[i] = t
  g[i] = wave
  b[i] = 1 - t
  a[i] = 1
}

send({
  type: 'wrapped',
  channels: [r, g, b, a],
  width: 40,
  format: 'rgba'
})`;

export const FLOAT_TEXTURE_PRESETS: Record<
  string,
  {
    type: string;
    description?: string;
    data: { code: string; showConsole?: boolean; runOnMount?: boolean };
  }
> = {
  'rgba-grid.float.js': {
    type: 'js',
    description: 'Generate a 50x50 interleaved RGBA Float32Array texture for float.tex.',
    data: { code: RGBA_GRID_JS, showConsole: false, runOnMount: true }
  },
  'square-field.float.js': {
    type: 'js',
    description: 'Animate square-packed XYZW point-field data for float.tex.',
    data: { code: SQUARE_FIELD_JS, showConsole: false, runOnMount: true }
  },
  'wrapped-wave.float.js': {
    type: 'js',
    description: 'Generate wrapped RGBA channel rows for float.tex.',
    data: { code: WRAPPED_WAVE_JS, showConsole: false, runOnMount: true }
  }
};
