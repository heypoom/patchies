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

export const REGL_PRESETS: Record<string, { type: string; data: { code: string } }> = {
  'regl>': {
    type: 'regl',
    data: { code: PASSTHRU_REGL.trim() }
  },
  'point-cloud-from-texture.regl': {
    type: 'regl',
    data: { code: POINT_CLOUD_FROM_TEXTURE_REGL.trim() }
  }
};
