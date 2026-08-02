import type { REGLPreset } from './types';

const code = `
setTitle('Layout');
setVideoCount(4, 1);
setPrimaryButton('settings');

await settings.define([
  {
    key: 'mode',
    type: 'select',
    label: 'Mode',
    default: 'grid',
    options: [
      { label: 'Grid', value: 'grid' },
      { label: 'Row', value: 'row' },
      { label: 'Column', value: 'column' }
    ]
  },
  { key: 'gap', type: 'slider', label: 'Gap', min: 0, max: 64, step: 1, default: 8 },
  { key: 'count', type: 'slider', label: 'Count', min: 1, max: 4, step: 1, default: 4 },
  { key: 'background', type: 'color', label: 'Background', default: '#000000' }
]);

const quad = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]];

function hexToRgb(hex) {
  const normalized = String(hex || '#000000').replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized.padEnd(6, '0').slice(0, 6), 16);

  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  ];
}

let backgroundHex = null;
const clearColor = [0, 0, 0, 1];

function getClearColor() {
  const nextHex = settings.get('background') || '#000000';
  if (nextHex !== backgroundHex) {
    backgroundHex = nextHex;
    const bg = hexToRgb(nextHex);
    clearColor[0] = bg[0];
    clearColor[1] = bg[1];
    clearColor[2] = bg[2];
  }

  return clearColor;
}

const drawTile = regl({
  vert: \`
    precision mediump float;
    attribute vec2 position;
    varying vec2 uv;

    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  \`,
  frag: \`
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D source;

    void main() {
      gl_FragColor = texture2D(source, uv);
    }
  \`,
  attributes: { position: quad },
  uniforms: {
    source: regl.prop('source')
  },
  viewport: regl.prop('viewport'),
  count: 6,
  depth: { enable: false }
});

function getViewport(index, mode, gap, count, outputWidth, outputHeight) {
  if (mode === 'row') {
    const tileWidth = (outputWidth - gap * (count - 1)) / count;
    return {
      x: Math.round(index * (tileWidth + gap)),
      y: 0,
      width: Math.max(1, Math.round(tileWidth)),
      height: outputHeight
    };
  }

  if (mode === 'column') {
    const tileHeight = (outputHeight - gap * (count - 1)) / count;
    const row = count - 1 - index;
    return {
      x: 0,
      y: Math.round(row * (tileHeight + gap)),
      width: outputWidth,
      height: Math.max(1, Math.round(tileHeight))
    };
  }

  const cols = count <= 1 ? 1 : 2;
  const rows = Math.ceil(count / cols);
  const col = index % cols;
  const row = rows - 1 - Math.floor(index / cols);
  const tileWidth = (outputWidth - gap * (cols - 1)) / cols;
  const tileHeight = (outputHeight - gap * (rows - 1)) / rows;

  return {
    x: Math.round(col * (tileWidth + gap)),
    y: Math.round(row * (tileHeight + gap)),
    width: Math.max(1, Math.round(tileWidth)),
    height: Math.max(1, Math.round(tileHeight))
  };
}

function render(time) {
  const gap = Math.max(0, Number(settings.get('gap')) || 0);
  const count = Math.max(1, Math.min(4, Math.floor(Number(settings.get('count')) || 4)));
  const mode = settings.get('mode') || 'grid';

  regl.clear({ color: getClearColor() });

  for (let i = 0; i < count; i++) {
    drawTile({
      source: getTexture(i),
      viewport: getViewport(i, mode, gap, count, width, height)
    });
  }
}
`;

export const preset: REGLPreset = {
  type: 'regl',
  description: 'Arrange up to four video inputs into a grid, row, or column.',
  data: { code: code.trim() }
};
