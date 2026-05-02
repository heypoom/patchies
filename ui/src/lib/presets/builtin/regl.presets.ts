const PASSTHRU_REGL = `
setVideoCount(1, 1)

const draw = await regl({
  vert: \`
    precision mediump float;
    attribute vec2 position;
    varying vec2 uv;

    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0, 1);
    }
  \`,
  frag: \`
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D tex;

    void main() {
      // Sample the input texture passed via props
      gl_FragColor = texture2D(tex, uv);
    }
  \`,
  attributes: {
    position: [[-1,-1], [1,-1], [-1,1], [-1,1], [1,-1], [1,1]]
  },
  uniforms: {
    tex: regl.prop('tex'),
  },
  count: 6,
  depth: { enable: false },
})

function render(time) {
  const inputTexture = getTexture(0)

  if (inputTexture) {
    draw({ tex: inputTexture })
  }
}
`;

const POINT_CLOUD_FROM_TEXTURE_REGL = `
setTitle('Regl Point Cloud');
setVideoCount(1, 1);
setPrimaryButton('settings')

// Matrix utility for perspective projection
const mat4 = {
  perspective: (out, fovy, aspect, near, far) => {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);

    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = (2 * far * near) * nf; out[15] = 0;

    return out;
  }
};

await settings.define([
  { key: 'maxPoints', type: 'slider', label: 'Max Points', min: 1, max: 65535, step: 1, default: 32768 },
  { key: 'pointSize', type: 'slider', label: 'Base Size', min: 0.01, max: 1, step: 0.01, default: 0.05 },
  { key: 'depthScale', type: 'slider', label: 'Depth Scale', min: 0.1, max: 4.0, step: 0.1, default: 1.5 },
  { key: 'offsetX', type: 'slider', label: 'Center X', min: -2.0, max: 2.0, step: 0.01, default: 1.0 },
  { key: 'offsetY', type: 'slider', label: 'Center Y', min: -2.0, max: 2.0, step: 0.01, default: 1.0 }
]);

let currentW = 0;
let currentH = 0;
let currentMax = 0;
let refBuffer = regl.buffer([]);
let pointCount = 0;

// Build the UV reference buffer to sample the input texture
function rebuildBuffers(w, h, max) {
  const total = w * h;
  const stride = Math.max(1, Math.ceil(Math.sqrt(total / max)));

  const sw = Math.floor(w / stride);
  const sh = Math.floor(h / stride);

  const count = sw * sh;
  const refs = new Float32Array(count * 2);

  let idx = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      refs[idx++] = (x * stride + 0.5) / w;
      refs[idx++] = (y * stride + 0.5) / h;
    }
  }

  refBuffer({ data: refs, usage: 'static' });
  pointCount = count;
  currentW = w;
  currentH = h;
  currentMax = max;
}

const drawPoints = regl({
  vert: \`
    precision mediump float;
    attribute vec2 ref;
    uniform sampler2D posMap;
    uniform mat4 projection, view;
    uniform float pointSize, depthScale;
    uniform vec2 offset;
    varying vec3 vPos;

    void main() {
      vec4 data = texture2D(posMap, ref);

      // Remap 0-1 texture data to world space
      vec3 p = (data.xyz - 0.5) * 2.0;

      // Apply offsets to center the object
      p.x += offset.x;
      p.y += offset.y;

      p.z *= depthScale;

      vPos = p;

      vec4 mvp = projection * view * vec4(p, 1.0);
      gl_Position = mvp;

      // Simple distance-based size attenuation
      float dist = length((view * vec4(p, 1.0)).xyz);
      gl_PointSize = pointSize * (40.0 / max(1.0, dist));
    }
  \`,
  frag: \`
    precision mediump float;
    varying vec3 vPos;
    void main() {
      vec2 r = gl_PointCoord - 0.5;
      if (dot(r, r) > 0.25) discard;

      // Color based on position
      vec3 color = 0.5 + 0.5 * normalize(vPos + 0.5);
      gl_FragColor = vec4(color, 1.0);
    }
  \`,
  attributes: {
    ref: () => refBuffer
  },
  uniforms: {
    posMap: () => getTexture(0) || regl.texture([[0,0,0]]),
    projection: ({viewportWidth, viewportHeight}) =>
      mat4.perspective([], Math.PI / 3, viewportWidth / viewportHeight, 0.01, 1000),
    view: [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, -4, 1
    ],
    pointSize: () => settings.get('pointSize'),
    depthScale: () => settings.get('depthScale'),
    offset: () => [settings.get('offsetX'), settings.get('offsetY')]
  },
  blend: {
    enable: true,
    func: { src: 'one', dst: 'one' }
  },
  depth: { enable: false },
  count: () => pointCount,
  primitive: 'points'
});

function render(time) {
  const tex = getTexture(0);
  const maxPoints = settings.get('maxPoints');

  if (tex) {
    if (tex.width !== currentW || tex.height !== currentH || maxPoints !== currentMax) {
      rebuildBuffers(tex.width, tex.height, maxPoints);
    }
  }

  regl.clear({ color: [0, 0, 0, 1] });

  if (pointCount > 0) {
    drawPoints({ time });
  }
}
`;

const BLOOM_REGL = `
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

const CACHE_REGL = `
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

export const REGL_PRESETS: Record<
  string,
  { type: string; description?: string; data: { code: string } }
> = {
  'regl>': {
    type: 'regl',
    data: { code: PASSTHRU_REGL.trim() }
  },
  'point-cloud-from-texture.regl': {
    type: 'regl',
    data: { code: POINT_CLOUD_FROM_TEXTURE_REGL.trim() }
  },
  Bloom: {
    type: 'regl',
    description: 'Apply multipass bloom with threshold, blur, tint, and intensity controls.',
    data: { code: BLOOM_REGL.trim() }
  },
  Cache: {
    type: 'regl',
    description: 'Store recent frames in a ring buffer and output a delayed frame.',
    data: { code: CACHE_REGL.trim() }
  }
};
