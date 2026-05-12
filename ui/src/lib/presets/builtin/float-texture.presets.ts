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

const RGBA_SCAN_JS = `setRunOnMount(true)
setTitle('rgba scan')

const W = 64
const H = 16
const buffer = new SharedArrayBuffer(W * H * 4 * Float32Array.BYTES_PER_ELEMENT)
const rgba = new Float32Array(buffer)

let version = 0

function frame() {
  version++

  const shift = version % W

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const u = ((x + shift) % W) / (W - 1)
      const v = y / (H - 1)
      const band = ((x + y * 4 + shift) % 16) / 15

      rgba[i + 0] = u
      rgba[i + 1] = band
      rgba[i + 2] = 1 - v
      rgba[i + 3] = 1
    }
  }

  send({
    type: 'rgba',
    buffer,
    width: W,
    height: H,
    textureFormat: 'rgba8',
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
  'rgba-scan.float.js': {
    type: 'js',
    description: 'Animate lightweight SharedArrayBuffer RGBA data for float.tex.',
    data: { code: RGBA_SCAN_JS, showConsole: false, runOnMount: true }
  },
  'wrapped-wave.float.js': {
    type: 'js',
    description: 'Generate wrapped RGBA channel rows for float.tex.',
    data: { code: WRAPPED_WAVE_JS, showConsole: false, runOnMount: true }
  }
};
