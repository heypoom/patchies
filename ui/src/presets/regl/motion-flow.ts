import type { REGLPreset } from './types';

const code = `
setTitle('Motion Flow');
setVideoCount(1, 2);
setPrimaryButton('settings');

await settings.define([
  { key: 'scale', type: 'slider', label: 'Scale', min: 0, max: 64, step: 0.001, default: 16 },
  { key: 'threshold', type: 'slider', label: 'Threshold', min: 0, max: 0.25, step: 0.001, default: 0.015 },
  { key: 'gain', type: 'slider', label: 'Gain', min: 0, max: 8, step: 0.001, default: 1.5 }
]);

const quad = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]];

let previousFrame = null;
let previousWidth = 0;
let previousHeight = 0;
let firstFrame = true;

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

function ensurePreviousFrame(w, h) {
  if (previousFrame && previousWidth === w && previousHeight === h) return;

  if (previousFrame) previousFrame.destroy();

  previousFrame = createTarget(w, h);
  previousWidth = w;
  previousHeight = h;
  firstFrame = true;
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

const drawFlow = regl({
  vert: \`
    #version 300 es
    precision mediump float;
    in vec2 position;
    out vec2 uv;

    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  \`,
  frag: \`
    #version 300 es
    precision mediump float;

    in vec2 uv;
    layout(location = 0) out vec4 visualization;
    layout(location = 1) out vec4 dataFlow;

    uniform sampler2D currentFrame;
    uniform sampler2D previousFrame;
    uniform vec2 texel;
    uniform float scale;
    uniform float threshold;
    uniform float gain;

    float luma(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    vec3 hsv2rgb(vec3 c) {
      vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
      return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
    }

    void main() {
      vec3 current = texture(currentFrame, uv).rgb;
      float center = luma(current);
      float previous = luma(texture(previousFrame, uv).rgb);

      float left = luma(texture(currentFrame, uv - vec2(texel.x, 0.0)).rgb);
      float right = luma(texture(currentFrame, uv + vec2(texel.x, 0.0)).rgb);
      float down = luma(texture(currentFrame, uv - vec2(0.0, texel.y)).rgb);
      float up = luma(texture(currentFrame, uv + vec2(0.0, texel.y)).rgb);

      vec2 gradient = vec2(right - left, up - down) * 0.5;
      float temporal = center - previous;
      float denominator = dot(gradient, gradient) + 0.0001;
      vec2 flow = -temporal * gradient / denominator;
      vec2 scaledFlow = flow * scale * gain;
      float magnitude = length(scaledFlow);

      if (magnitude < threshold) {
        scaledFlow = vec2(0.0);
        magnitude = 0.0;
      }

      float angle = atan(scaledFlow.y, scaledFlow.x) / 6.2831853 + 0.5;
      float value = clamp(magnitude, 0.0, 1.0);
      vec3 flowColor = hsv2rgb(vec3(angle, value > 0.0 ? 1.0 : 0.0, value));

      visualization = vec4(flowColor, 1.0);
      dataFlow = vec4(clamp(scaledFlow * 0.5 + 0.5, 0.0, 1.0), value, 1.0);
    }
  \`,
  attributes: { position: quad },
  uniforms: {
    currentFrame: regl.prop('currentFrame'),
    previousFrame: regl.prop('previousFrame'),
    texel: regl.prop('texel'),
    scale: regl.prop('scale'),
    threshold: regl.prop('threshold'),
    gain: regl.prop('gain')
  },
  count: 6,
  depth: { enable: false }
});

function render(time) {
  const source = getTexture(0);
  const sourceWidth = source.width || width;
  const sourceHeight = source.height || height;

  ensurePreviousFrame(sourceWidth, sourceHeight);

  if (firstFrame) {
    copyTexture({
      source,
      framebuffer: previousFrame
    });
    firstFrame = false;
  }

  drawFlow({
    currentFrame: source,
    previousFrame,
    texel: [1 / sourceWidth, 1 / sourceHeight],
    scale: Number(settings.get('scale')) || 0,
    threshold: Number(settings.get('threshold')) || 0,
    gain: Number(settings.get('gain')) || 0
  });

  copyTexture({
    source,
    framebuffer: previousFrame
  });
}
`;

export const preset: REGLPreset = {
  type: 'regl',
  description: 'Estimate frame-to-frame motion with visualization and vector outputs.',
  data: { code: code.trim() }
};
