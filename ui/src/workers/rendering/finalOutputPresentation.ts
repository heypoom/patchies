import type regl from 'regl';

type FinalOutputPresentationProps = {
  texture: regl.Texture2D;
  sourceUvRect: [number, number, number, number];
};

const RECT_VERTEX = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1]
];

const VERTEX_SHADER = `#version 300 es
  precision highp float;

  in vec2 position;
  out vec2 uv;

  void main() {
    uv = 0.5 * (position + 1.0);

    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  uniform sampler2D sourceTexture;
  uniform vec4 sourceUvRect;

  in vec2 uv;
  out vec4 fragColor;

  void main() {
    vec2 sourceUv = mix(sourceUvRect.xy, sourceUvRect.zw, uv);
    vec4 color = texture(sourceTexture, sourceUv);

    fragColor = vec4(color.rgb * color.a, color.a);
  }
`;

export const createFinalOutputPresentationCommand = (regl: regl.Regl): regl.DrawCommand =>
  regl({
    frag: FRAGMENT_SHADER,
    vert: VERTEX_SHADER,

    attributes: {
      position: regl.buffer(RECT_VERTEX)
    },

    uniforms: {
      sourceTexture: regl.prop<FinalOutputPresentationProps, 'texture'>('texture'),
      sourceUvRect: regl.prop<FinalOutputPresentationProps, 'sourceUvRect'>('sourceUvRect')
    },

    primitive: 'triangle strip',
    count: 4,
    depth: { enable: false },
    blend: { enable: false },
    framebuffer: null
  });
