import type { REGLPreset } from './types';

const code = `
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

export const preset: REGLPreset = {
  type: 'regl',
  data: { code: code.trim() }
};
