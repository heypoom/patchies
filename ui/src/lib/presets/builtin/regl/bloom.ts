import type { REGLPreset } from './types';

const code = `
setTitle('Bloom');
setVideoCount(1, 1);
setPrimaryButton('settings');

await settings.define([
  { key: 'threshold', type: 'slider', label: 'Threshold', min: 0, max: 2, step: 0.001, default: 0.75 },
  { key: 'softness', type: 'slider', label: 'Softness', min: 0, max: 1, step: 0.001, default: 0.25 },
  { key: 'intensity', type: 'slider', label: 'Intensity', min: 0, max: 5, step: 0.001, default: 1.2 },
  { key: 'radius', type: 'slider', label: 'Radius', min: 0.25, max: 12, step: 0.001, default: 4 },
  { key: 'passes', type: 'slider', label: 'Passes', min: 1, max: 8, step: 1, default: 3 },
  { key: 'resolutionScale', type: 'slider', label: 'Resolution', min: 0.125, max: 1, step: 0.125, default: 0.5 },
  { key: 'tint', type: 'color', label: 'Tint', default: '#ffffff' }
]);

const quad = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]];

let bloomA = null;
let bloomB = null;
let bloomWidth = 0;
let bloomHeight = 0;

function hexToRgb(hex) {
  const normalized = String(hex || '#ffffff').replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized.padEnd(6, 'f').slice(0, 6), 16);

  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  ];
}

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

function ensureTargets(w, h) {
  if (bloomA && bloomB && bloomWidth === w && bloomHeight === h) return;

  if (bloomA) bloomA.destroy();
  if (bloomB) bloomB.destroy();

  bloomA = createTarget(w, h);
  bloomB = createTarget(w, h);
  bloomWidth = w;
  bloomHeight = h;
}

const drawThreshold = regl({
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
    uniform float threshold;
    uniform float softness;

    float luma(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec4 color = texture2D(source, uv);
      float brightness = luma(color.rgb);
      float mask = softness <= 0.0
        ? step(threshold, brightness)
        : smoothstep(threshold - softness, threshold + softness, brightness);

      gl_FragColor = vec4(color.rgb * mask, color.a * mask);
    }
  \`,
  attributes: { position: quad },
  uniforms: {
    source: regl.prop('source'),
    threshold: regl.prop('threshold'),
    softness: regl.prop('softness')
  },
  framebuffer: regl.prop('framebuffer'),
  count: 6,
  depth: { enable: false }
});

const drawBlur = regl({
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
    uniform vec2 direction;

    void main() {
      vec4 color = texture2D(source, uv) * 0.227027;
      color += texture2D(source, uv + direction * 1.384615) * 0.316216;
      color += texture2D(source, uv - direction * 1.384615) * 0.316216;
      color += texture2D(source, uv + direction * 3.230769) * 0.070270;
      color += texture2D(source, uv - direction * 3.230769) * 0.070270;
      gl_FragColor = color;
    }
  \`,
  attributes: { position: quad },
  uniforms: {
    source: regl.prop('source'),
    direction: regl.prop('direction')
  },
  framebuffer: regl.prop('framebuffer'),
  count: 6,
  depth: { enable: false }
});

const drawComposite = regl({
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
    uniform sampler2D bloom;
    uniform float intensity;
    uniform vec3 tint;

    void main() {
      vec4 base = texture2D(source, uv);
      vec4 glow = texture2D(bloom, uv);
      gl_FragColor = vec4(base.rgb + glow.rgb * tint * intensity, base.a);
    }
  \`,
  attributes: { position: quad },
  uniforms: {
    source: regl.prop('source'),
    bloom: regl.prop('bloom'),
    intensity: regl.prop('intensity'),
    tint: regl.prop('tint')
  },
  count: 6,
  depth: { enable: false }
});

function render(time) {
  const source = getTexture(0);
  const scale = Number(settings.get('resolutionScale')) || 0.5;
  const targetWidth = Math.max(1, Math.floor((source.width || width) * scale));
  const targetHeight = Math.max(1, Math.floor((source.height || height) * scale));
  const threshold = Number(settings.get('threshold')) || 0;
  const softness = Number(settings.get('softness')) || 0;
  const radius = Math.max(0.001, Number(settings.get('radius')) || 1);
  const passes = Math.max(1, Math.floor(Number(settings.get('passes')) || 1));

  ensureTargets(targetWidth, targetHeight);

  drawThreshold({
    source,
    threshold,
    softness,
    framebuffer: bloomA
  });

  for (let i = 0; i < passes; i++) {
    const passRadius = radius * (1.0 + i * 0.35);

    drawBlur({
      source: bloomA,
      direction: [passRadius / targetWidth, 0],
      framebuffer: bloomB
    });

    drawBlur({
      source: bloomB,
      direction: [0, passRadius / targetHeight],
      framebuffer: bloomA
    });
  }

  regl.clear({ color: [0, 0, 0, 0] });

  drawComposite({
    source,
    bloom: bloomA,
    intensity: Number(settings.get('intensity')) || 0,
    tint: hexToRgb(settings.get('tint'))
  });
}
`;

export const preset: REGLPreset = {
  type: 'regl',
  description: 'Apply multipass bloom with threshold, blur, tint, and intensity controls.',
  data: { code: code.trim() }
};
