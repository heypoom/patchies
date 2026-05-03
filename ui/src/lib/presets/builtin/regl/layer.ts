import type { REGLPreset } from './types';

const code = `
setTitle('Layer');
setVideoCount(4, 1);
setPrimaryButton('settings');

await settings.define([
  { key: 'opacity0', type: 'slider', label: 'Layer 1', min: 0, max: 1, step: 0.001, default: 1 },
  { key: 'opacity1', type: 'slider', label: 'Layer 2', min: 0, max: 1, step: 0.001, default: 1 },
  { key: 'opacity2', type: 'slider', label: 'Layer 3', min: 0, max: 1, step: 0.001, default: 1 },
  { key: 'opacity3', type: 'slider', label: 'Layer 4', min: 0, max: 1, step: 0.001, default: 1 },
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

const drawLayer = regl({
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
    uniform float opacity;

    void main() {
      vec4 color = texture2D(source, uv);
      gl_FragColor = vec4(color.rgb, color.a * opacity);
    }
  \`,
  attributes: { position: quad },
  uniforms: {
    source: regl.prop('source'),
    opacity: regl.prop('opacity')
  },
  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 'one',
      dstRGB: 'one minus src alpha',
      dstAlpha: 'one minus src alpha'
    }
  },
  count: 6,
  depth: { enable: false }
});

function render(time) {
  regl.clear({ color: getClearColor() });

  for (let i = 0; i < 4; i++) {
    drawLayer({
      source: getTexture(i),
      opacity: Number(settings.get('opacity' + i)) || 0
    });
  }
}
`;

export const preset: REGLPreset = {
  type: 'regl',
  description: 'Stack up to four video inputs with per-layer opacity.',
  data: { code: code.trim() }
};
