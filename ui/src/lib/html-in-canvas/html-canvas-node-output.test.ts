import { describe, expect, it, vi } from 'vitest';
import { getHtmlCanvasRootClass, HtmlCanvasNodeOutput } from './html-canvas-node-output';
import type { HtmlCanvasNodeOutputState } from './html-canvas-node-output';
import { HtmlGlslLayerNodeOutput } from './html-glsl-layer-node-output';
import { HtmlLayerNodeOutput } from './html-layer-node-output';

describe('HtmlCanvasNodeOutput', () => {
  it('chooses root sizing classes for output and free modes', () => {
    expect(getHtmlCanvasRootClass('output', {})).toBe('h-full w-full');
    expect(getHtmlCanvasRootClass('free', {})).toBe('inline-block');
    expect(getHtmlCanvasRootClass('free', { width: 320, height: 180 })).toBe('h-full w-full');
  });

  it('normalizes htmlCanvas calls, registers video, and notifies the host', () => {
    const states: HtmlCanvasNodeOutputState[] = [];

    const videoGraph = {
      upsertNode: vi.fn(),
      removeNode: vi.fn(),
      hasOutgoingVideoConnections: vi.fn(() => false),
      setElementImage: vi.fn()
    };

    const output = new HtmlCanvasNodeOutput({
      nodeId: 'node-1',
      objectName: 'dom',
      getRootElement: () => undefined,
      getCanvasElement: () => undefined,
      getExplicitSize: () => ({}),
      getOutputSize: () => ({ width: 1280, height: 720 }),
      warn: vi.fn(),
      updateNodeInternals: vi.fn(),
      scheduleRun: vi.fn(),
      onStateChange: (state) => states.push(state),
      videoGraph,
      detectSupport: () => ({ supported: true, missing: [] })
    });

    expect(output.enable()).toBe(true);
    expect(states.at(-1)).toMatchObject({ enabled: true, sizeMode: 'output' });
    expect(videoGraph.upsertNode).toHaveBeenCalledWith('node-1', 'img', {});

    expect(output.enable({ size: 'free' })).toBe(true);
    expect(states.at(-1)).toMatchObject({ enabled: true, sizeMode: 'free' });

    expect(output.enable(false)).toBe(true);
    expect(states.at(-1)).toMatchObject({ enabled: false, sizeMode: 'output' });
    expect(videoGraph.removeNode).toHaveBeenCalledWith('node-1');
  });

  it('updates canvas size without writing host state on every paint', () => {
    const onStateChange = vi.fn();

    const videoGraph = {
      upsertNode: vi.fn(),
      removeNode: vi.fn(),
      hasOutgoingVideoConnections: vi.fn(() => false),
      setElementImage: vi.fn()
    };

    const output = new HtmlCanvasNodeOutput({
      nodeId: 'node-1',
      objectName: 'dom',
      getRootElement: () =>
        ({
          scrollWidth: 120,
          offsetWidth: 120,
          scrollHeight: 70,
          offsetHeight: 70
        }) as HTMLElement,
      getCanvasElement: () => undefined,
      getExplicitSize: () => ({}),
      getOutputSize: () => ({ width: 1280, height: 720 }),
      warn: vi.fn(),
      updateNodeInternals: vi.fn(),
      scheduleRun: vi.fn(),
      onStateChange,
      videoGraph,
      detectSupport: () => ({ supported: true, missing: [] })
    });

    output.updateSize();

    expect(output.state).toMatchObject({ width: 1280, height: 720 });
    expect(onStateChange).not.toHaveBeenCalled();
  });
});

describe('HtmlGlslLayerNodeOutput', () => {
  it('uploads the live root with texElementImage2D before drawing a shader frame', () => {
    const transform = { toString: () => 'matrix(1, 0, 0, 1, 0, 0)' };
    const calls: string[] = [];

    const gl = {
      TEXTURE_2D: 3553,
      RGBA: 6408,
      UNSIGNED_BYTE: 5121,
      TRIANGLES: 4,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      TEXTURE0: 33984,
      COLOR_BUFFER_BIT: 16384,
      CLAMP_TO_EDGE: 33071,
      LINEAR: 9729,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: true,
      LINK_STATUS: true,
      UNPACK_FLIP_Y_WEBGL: 37440,
      createTexture: vi.fn(() => ({})),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      pixelStorei: vi.fn(),
      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      getShaderInfoLog: vi.fn(() => ''),
      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      getProgramInfoLog: vi.fn(() => ''),
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      getAttribLocation: vi.fn(() => 0),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      getUniformLocation: vi.fn((_: unknown, name: string) => ({ name })),
      viewport: vi.fn(),
      clear: vi.fn(),
      useProgram: vi.fn(),
      activeTexture: vi.fn(),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      uniform1ui: vi.fn(),
      uniform3f: vi.fn(),
      drawArrays: vi.fn(() => calls.push('drawArrays')),
      texElementImage2D: vi.fn(() => calls.push('texElementImage2D')),
      getExtension: vi.fn()
    };

    const attributes = new Map<string, string>();
    const requestPaint = vi.fn();

    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      setAttribute: vi.fn((name: string, value: string) => attributes.set(name, value)),
      getAttribute: (name: string) => attributes.get(name) ?? null,
      requestPaint,
      getContext: vi.fn(() => gl)
    } as unknown as HTMLCanvasElement;

    const root = {
      scrollWidth: 160,
      offsetWidth: 160,
      scrollHeight: 90,
      offsetHeight: 90,
      style: { transform: '' }
    } as unknown as HTMLElement;

    const layer = new HtmlGlslLayerNodeOutput({
      getCanvasElement: () => canvas,
      getRootElement: () => root,
      getExplicitSize: () => ({ width: 640, height: 480 }),
      warn: vi.fn(),
      scheduleRun: vi.fn(),
      detectSupport: () => ({ supported: true, missing: [] }),
      requestFrame: vi.fn(() => 1),
      cancelFrame: vi.fn(),
      now: () => 100,
      getPixelRatio: () => 2,
      getElementTransform: () => transform as DOMMatrix
    });

    layer.enable(`
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        fragColor = texture(source, fragCoord / iResolution.xy);
      }
    `);
    layer.setup();
    layer.paint(116);

    expect(canvas.getAttribute('layoutsubtree')).toBe('');
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(960);

    expect(gl.texElementImage2D).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1280,
      960,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      root
    );

    expect(calls).toEqual(['texElementImage2D', 'drawArrays']);
    expect(root.style.transform).toBe('matrix(1, 0, 0, 1, 0, 0)');

    expect(gl.shaderSource).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(
        'mainImage(fragColor, vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y));'
      )
    );

    expect(gl.shaderSource).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('#version 300 es')
    );

    expect(gl.shaderSource).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('out vec4 fragColor;')
    );

    requestPaint.mockClear();

    gl.texElementImage2D = vi.fn(() => {
      throw new DOMException('No cached paint record for element.', 'InvalidStateError');
    });

    expect(() => layer.paint(132)).not.toThrow();
    expect(requestPaint).toHaveBeenCalled();
  });

  it('resolves #include directives before compiling the GLSL layer shader', async () => {
    const gl = {
      TEXTURE_2D: 3553,
      RGBA: 6408,
      UNSIGNED_BYTE: 5121,
      TRIANGLES: 4,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      TEXTURE0: 33984,
      COLOR_BUFFER_BIT: 16384,
      CLAMP_TO_EDGE: 33071,
      LINEAR: 9729,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: true,
      LINK_STATUS: true,
      UNPACK_FLIP_Y_WEBGL: 37440,
      createTexture: vi.fn(() => ({})),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      pixelStorei: vi.fn(),
      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      getShaderInfoLog: vi.fn(() => ''),
      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      getProgramInfoLog: vi.fn(() => ''),
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      getAttribLocation: vi.fn(() => 0),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      getUniformLocation: vi.fn((_: unknown, name: string) => ({ name })),
      viewport: vi.fn(),
      clear: vi.fn(),
      useProgram: vi.fn(),
      activeTexture: vi.fn(),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      uniform3f: vi.fn(),
      drawArrays: vi.fn(),
      texElementImage2D: vi.fn()
    };

    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      setAttribute: vi.fn(),
      getAttribute: vi.fn(() => ''),
      requestPaint: vi.fn(),
      getContext: vi.fn(() => gl)
    } as unknown as HTMLCanvasElement;

    const root = {
      scrollWidth: 160,
      offsetWidth: 160,
      scrollHeight: 90,
      offsetHeight: 90,
      style: { transform: '' }
    } as unknown as HTMLElement;

    const scheduleRun = vi.fn();

    const layer = new HtmlGlslLayerNodeOutput({
      getCanvasElement: () => canvas,
      getRootElement: () => root,
      getExplicitSize: () => ({ width: 640, height: 480 }),
      warn: vi.fn(),
      scheduleRun,
      detectSupport: () => ({ supported: true, missing: [] }),
      requestFrame: vi.fn(() => 1),
      cancelFrame: vi.fn(),
      now: () => 100,
      getElementTransform: () => ({ toString: () => 'matrix(1, 0, 0, 1, 0, 0)' }) as DOMMatrix,
      includeResolver: {
        resolveNpm: vi.fn(async () => 'float includedValue = 0.75;'),
        resolveVfs: vi.fn(),
        resolveUrl: vi.fn()
      }
    });

    layer.enable(`
      #include <test/value>
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        fragColor = vec4(includedValue);
      }
    `);

    layer.setup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    layer.paint(116);

    expect(scheduleRun).toHaveBeenCalled();
    expect(gl.shaderSource).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('float includedValue = 0.75;')
    );
  });
});

describe('HtmlLayerNodeOutput', () => {
  it('draws the live root into a layoutsubtree canvas before running the postprocess callback', () => {
    const callback = vi.fn();
    const transform = { toString: () => 'matrix(1, 0, 0, 1, 0, 0)' };

    const context = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      drawElementImage: vi.fn(() => transform)
    };

    const attributes = new Map<string, string>();

    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      setAttribute: vi.fn((name: string, value: string) => attributes.set(name, value)),
      getAttribute: (name: string) => attributes.get(name) ?? null,
      requestPaint: vi.fn(),
      getContext: vi.fn(() => context)
    } as unknown as HTMLCanvasElement;

    const root = {
      scrollWidth: 160,
      offsetWidth: 160,
      scrollHeight: 90,
      offsetHeight: 90,
      style: { transform: '' }
    } as unknown as HTMLElement;

    const layer = new HtmlLayerNodeOutput({
      getCanvasElement: () => canvas,
      getRootElement: () => root,
      getExplicitSize: () => ({ width: 640, height: 480 }),
      warn: vi.fn(),
      scheduleRun: vi.fn(),
      detectSupport: () => ({ supported: true, missing: [] }),
      requestFrame: vi.fn(() => 1),
      cancelFrame: vi.fn(),
      now: () => 100,
      getPixelRatio: () => 2
    });

    layer.enable(callback);
    layer.setup();

    expect(canvas.getAttribute('layoutsubtree')).toBe('');
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(960);
    expect(canvas.style.width).toBe('640px');
    expect(canvas.style.height).toBe('480px');
    layer.paint(116);

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1280, 960);
    expect(context.drawElementImage).toHaveBeenCalledWith(root, 0, 0, 1280, 960);
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(root.style.transform).toBe('matrix(1, 0, 0, 1, 0, 0)');

    expect(callback).toHaveBeenCalledWith(context, {
      width: 1280,
      height: 960,
      displayWidth: 640,
      displayHeight: 480,
      pixelRatio: 2,
      time: 16,
      delta: 16
    });
  });
});
