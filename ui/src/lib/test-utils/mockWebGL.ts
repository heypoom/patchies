import { vi } from 'vitest';
import type regl from 'regl';

type MockFn = ReturnType<typeof vi.fn>;

export type MockWebGL2RenderingContext = WebGL2RenderingContext & {
  activeTexture: MockFn;
  attachShader: MockFn;
  bindBuffer: MockFn;
  bindFramebuffer: MockFn;
  bindTexture: MockFn;
  blitFramebuffer: MockFn;
  bufferData: MockFn;
  clear: MockFn;
  clientWaitSync: MockFn;
  compileShader: MockFn;
  createBuffer: MockFn;
  createProgram: MockFn;
  createShader: MockFn;
  createTexture: MockFn;
  deleteBuffer: MockFn;
  deleteSync: MockFn;
  drawArrays: MockFn;
  enableVertexAttribArray: MockFn;
  fenceSync: MockFn;
  getAttribLocation: MockFn;
  getBufferSubData: MockFn;
  getExtension: MockFn;
  getParameter: MockFn;
  getProgramInfoLog: MockFn;
  getProgramParameter: MockFn;
  getShaderInfoLog: MockFn;
  getShaderParameter: MockFn;
  getUniformLocation: MockFn;
  linkProgram: MockFn;
  pixelStorei: MockFn;
  readPixels: MockFn;
  shaderSource: MockFn;
  texElementImage2D: MockFn;
  texImage2D: MockFn;
  texParameteri: MockFn;
  texSubImage2D: MockFn;
  uniform1f: MockFn;
  uniform1i: MockFn;
  uniform1ui: MockFn;
  uniform3f: MockFn;
  useProgram: MockFn;
  vertexAttribPointer: MockFn;
  viewport: MockFn;
};

export function createMockWebGL2Context(
  overrides: Partial<MockWebGL2RenderingContext> = {}
): MockWebGL2RenderingContext {
  return {
    ACTIVE_TEXTURE: 0x84e0,
    ARRAY_BUFFER: 0x8892,
    CLAMP_TO_EDGE: 0x812f,
    COLOR_BUFFER_BIT: 0x4000,
    COMPILE_STATUS: 0x8b81,
    DRAW_FRAMEBUFFER: 0x8ca9,
    FLOAT: 0x1406,
    FRAGMENT_SHADER: 0x8b30,
    FRAMEBUFFER: 0x8d40,
    FRAMEBUFFER_BINDING: 0x8ca6,
    LINEAR: 0x2601,
    LINK_STATUS: 0x8b82,
    NEAREST: 0x2600,
    PIXEL_PACK_BUFFER: 0x88eb,
    READ_FRAMEBUFFER: 0x8ca8,
    RGBA: 0x1908,
    RGBA8: 0x8058,
    RGBA16F: 0x881a,
    RGBA32F: 0x8814,
    STATIC_DRAW: 0x88e4,
    STREAM_READ: 0x88e1,
    SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
    TEXTURE0: 0x84c0,
    TEXTURE_2D: 0x0de1,
    TEXTURE_BINDING_2D: 0x8069,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    TRIANGLES: 0x0004,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    UNSIGNED_BYTE: 0x1401,
    VERTEX_SHADER: 0x8b31,
    activeTexture: vi.fn(),
    attachShader: vi.fn(),
    bindBuffer: vi.fn(),
    bindFramebuffer: vi.fn(),
    bindTexture: vi.fn(),
    blitFramebuffer: vi.fn(),
    bufferData: vi.fn(),
    clear: vi.fn(),
    clientWaitSync: vi.fn(),
    compileShader: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    createProgram: vi.fn(() => ({})),
    createShader: vi.fn(() => ({})),
    createTexture: vi.fn(() => ({})),
    deleteBuffer: vi.fn(),
    deleteSync: vi.fn(),
    drawArrays: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    fenceSync: vi.fn(() => ({})),
    getAttribLocation: vi.fn(() => 0),
    getBufferSubData: vi.fn(),
    getExtension: vi.fn(() => ({})),
    getParameter: vi.fn(() => null),
    getProgramInfoLog: vi.fn(() => ''),
    getProgramParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    getShaderParameter: vi.fn(() => true),
    getUniformLocation: vi.fn((_: unknown, name: string) => ({ name })),
    linkProgram: vi.fn(),
    pixelStorei: vi.fn(),
    readPixels: vi.fn(),
    shaderSource: vi.fn(),
    texElementImage2D: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    texSubImage2D: vi.fn(),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform1ui: vi.fn(),
    uniform3f: vi.fn(),
    useProgram: vi.fn(),
    vertexAttribPointer: vi.fn(),
    viewport: vi.fn(),
    ...overrides
  } as unknown as MockWebGL2RenderingContext;
}

export function createMockFramebuffer(): regl.Framebuffer2D {
  return {
    destroy: vi.fn(),
    _framebuffer: { framebuffer: {} }
  } as unknown as regl.Framebuffer2D;
}

export function createMockTexture(width: number, height: number): regl.Texture2D {
  return {
    width,
    height,
    destroy: vi.fn(),
    _texture: { texture: {} }
  } as unknown as regl.Texture2D;
}

export function createMockRegl() {
  const textures: regl.Texture2D[] = [];
  const framebuffers: regl.Framebuffer2D[] = [];

  const texture = vi.fn((options: { width: number; height: number }) => {
    const result = createMockTexture(options.width, options.height);

    textures.push(result);

    return result;
  });

  const framebuffer = vi.fn(() => {
    const result = createMockFramebuffer();

    framebuffers.push(result);

    return result;
  });

  return {
    regl: { texture, framebuffer },
    textures,
    framebuffers
  };
}
