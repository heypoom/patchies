import type { REGLPreset } from './types';

const code = `
setTitle('Time Machine');
setVideoCount(1, 1);
setPrimaryButton('settings');

await settings.define([
  { key: 'speed', type: 'slider', label: 'Speed', min: -4, max: 4, step: 0.001, default: 0.25 },
  { key: 'length', type: 'slider', label: 'Length', min: 2, max: 240, step: 1, default: 120 },
  { key: 'mix', type: 'slider', label: 'Mix', min: 0, max: 1, step: 0.001, default: 1 },
  { key: 'record', type: 'boolean', label: 'Record', default: true }
]);

const quad = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]];

let targets = [];
let targetWidth = 0;
let targetHeight = 0;
let targetLength = 0;
let writeIndex = 0;
let framesWritten = 0;
let playhead = 0;

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
  playhead = 0;
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

const drawPlayback = regl({
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
    uniform sampler2D live;
    uniform sampler2D frameA;
    uniform sampler2D frameB;
    uniform float frameMix;
    uniform float outputMix;

    void main() {
      vec4 liveColor = texture2D(live, uv);
      vec4 a = texture2D(frameA, uv);
      vec4 b = texture2D(frameB, uv);
      vec4 history = mix(a, b, frameMix);
      gl_FragColor = mix(liveColor, history, outputMix);
    }
  \`,
  attributes: { position: quad },
  uniforms: {
    live: regl.prop('live'),
    frameA: regl.prop('frameA'),
    frameB: regl.prop('frameB'),
    frameMix: regl.prop('frameMix'),
    outputMix: regl.prop('outputMix')
  },
  count: 6,
  depth: { enable: false }
});

function wrap(value, size) {
  return ((value % size) + size) % size;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function frameForAge(age, length) {
  return targets[(writeIndex - 1 - age + length) % length];
}

function render(time) {
  const source = getTexture(0);
  const sourceWidth = source.width || width;
  const sourceHeight = source.height || height;
  const length = Math.max(2, Math.min(240, Math.floor(Number(settings.get('length')) || 120)));

  ensureTargets(sourceWidth, sourceHeight, length);

  if (settings.get('record')) {
    copyTexture({
      source,
      framebuffer: targets[writeIndex]
    });

    writeIndex = (writeIndex + 1) % length;
    framesWritten = Math.min(framesWritten + 1, length);
  }

  const maxAge = Math.max(0, framesWritten - 1);
  const speed = Number(settings.get('speed')) || 0;

  if (maxAge > 0) {
    playhead = wrap(playhead + speed, maxAge + 1);
  }

  if (maxAge <= 0) {
    playhead = 0;
  }

  const ageA = Math.floor(playhead);
  const ageB = maxAge > 0 ? (ageA + 1) % (maxAge + 1) : 0;
  const frameMix = playhead - ageA;
  const frameA = framesWritten > 0 ? frameForAge(ageA, length) : source;
  const frameB = framesWritten > 0 ? frameForAge(ageB, length) : source;

  regl.clear({ color: [0, 0, 0, 0] });

  drawPlayback({
    live: source,
    frameA,
    frameB,
    frameMix,
    outputMix: clamp01(Number(settings.get('mix')) || 0)
  });
}
`;

export const preset: REGLPreset = {
  type: 'regl',
  description: 'Record frame history and play it back with a moving temporal playhead.',
  data: { code: code.trim() }
};
