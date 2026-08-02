import type { REGLPreset } from './types';

const code = `
setTitle('Cache');
setVideoCount(1, 1);
setPrimaryButton('settings');

await settings.define([
  { key: 'delay', type: 'slider', label: 'Delay', min: 0, max: 119, step: 1, default: 12 },
  { key: 'length', type: 'slider', label: 'Length', min: 2, max: 120, step: 1, default: 60 },
  { key: 'record', type: 'boolean', label: 'Record', default: true }
]);

const quad = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]];

let targets = [];
let targetWidth = 0;
let targetHeight = 0;
let targetLength = 0;
let writeIndex = 0;
let framesWritten = 0;

function createTarget(w, h) {
  return regl.framebuffer({
    color: regl.texture({
      width: w,
      height: h,
      min: 'linear',
      mag: 'linear',
      wrap: 'clamp'
    }),
    depthStencil: false
  });
}

function destroyTargets() {
  for (const target of targets) {
    target.destroy();
  }

  targets = [];
}

function ensureTargets(w, h, length) {
  if (targets.length > 0 && targetWidth === w && targetHeight === h && targetLength === length) {
    return;
  }

  destroyTargets();

  for (let i = 0; i < length; i++) {
    targets.push(createTarget(w, h));
  }

  targetWidth = w;
  targetHeight = h;
  targetLength = length;
  writeIndex = 0;
  framesWritten = 0;
}

const copyTexture = regl({
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
  framebuffer: regl.prop('framebuffer'),
  count: 6,
  depth: { enable: false }
});

const drawTexture = regl({
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
  count: 6,
  depth: { enable: false }
});

function render(time) {
  const source = getTexture(0);
  const sourceWidth = source.width || width;
  const sourceHeight = source.height || height;
  const length = Math.max(2, Math.min(120, Math.floor(Number(settings.get('length')) || 60)));

  ensureTargets(sourceWidth, sourceHeight, length);

  if (settings.get('record')) {
    copyTexture({
      source,
      framebuffer: targets[writeIndex]
    });

    writeIndex = (writeIndex + 1) % length;
    framesWritten = Math.min(framesWritten + 1, length);
  }

  const maxDelay = Math.max(0, framesWritten - 1);
  const delay = Math.min(Math.max(0, Math.floor(Number(settings.get('delay')) || 0)), maxDelay);
  const selectedIndex = (writeIndex - 1 - delay + length) % length;
  const selected = framesWritten > 0 ? targets[selectedIndex] : source;

  regl.clear({ color: [0, 0, 0, 0] });
  drawTexture({ source: selected });
}
`;

export const preset: REGLPreset = {
  type: 'regl',
  description: 'Store recent frames in a ring buffer and output a delayed frame.',
  data: { code: code.trim() }
};
