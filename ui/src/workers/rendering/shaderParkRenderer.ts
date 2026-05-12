import type regl from 'regl';
import { match } from 'ts-pattern';
import {
  fragFooter,
  minimalHeader,
  minimalVertexSource,
  sculptToGLSL,
  sculptureStarterCode,
  uniformsToGLSL,
  useHemisphereLight,
  usePBRHeader
} from 'shader-park-core';
import { validateShader, type LineErrors } from '$lib/canvas/shader-validator';
import type { RenderParams } from '$lib/rendering/types';
import {
  isShaderParkBuiltInUniform,
  normalizeShaderParkUniformValue
} from '$lib/shaderpark/uniforms';

type ShaderParkUniform = {
  name: string;
  type: string;
  value?: unknown;
};

type ShaderParkGLSL = {
  uniforms: ShaderParkUniform[];
  stepSizeConstant: number;
  maxIterations: number;
  maxReflections: number;
  geoGLSL: string;
  colorGLSL: string;
};

type Props = RenderParams;

const VIDEO_UNIFORM_COUNT = 4;
const UNIFORM_OVERRIDES_INDEX = VIDEO_UNIFORM_COUNT;
const VIDEO_UNIFORMS = Array.from(
  { length: VIDEO_UNIFORM_COUNT },
  (_, index) => `uniform sampler2D iChannel${index};`
).join('\n');

const scalarDefault = (value: unknown, fallback: number) =>
  typeof value === 'number' ? value : fallback;

const vectorDefault = (value: unknown, fallback: number[]) => {
  if (Array.isArray(value)) return value;

  if (value && typeof value === 'object') {
    const maybeVector = value as Record<string, unknown>;
    const keys = ['x', 'y', 'z', 'w'];

    const vector = keys
      .slice(0, fallback.length)
      .map((key, index) =>
        typeof maybeVector[key] === 'number' ? (maybeVector[key] as number) : fallback[index]
      );

    return vector;
  }

  return fallback;
};

const uniformDefault = (uniform: ShaderParkUniform, width: number, height: number) => {
  return match(uniform)
    .with({ name: 'time' }, () => (_: regl.DefaultContext, props: Props) => props.transportTime)
    .with({ name: 'opacity' }, () => 1)
    .with({ name: '_scale' }, () => 1)
    .with({ name: 'stepSize' }, ({ value }) => scalarDefault(value, 0.85))
    .with({ name: 'resolution' }, () => (_: regl.DefaultContext, props: Props) => [
      props.userParams[VIDEO_UNIFORM_COUNT],
      props.userParams[VIDEO_UNIFORM_COUNT + 1]
    ])
    .with({ name: 'mouse' }, () => (_: regl.DefaultContext, props: Props) => [
      width > 0 ? (2 * props.mouseX) / width - 1 : 0,
      height > 0 ? 2 * (1 - props.mouseY / height) - 1 : 0,
      props.mouseZ || -0.5
    ])
    .with({ type: 'float' }, ({ value }) => scalarDefault(value, 0))
    .with({ type: 'vec2' }, ({ value }) => vectorDefault(value, [0, 0]))
    .with({ type: 'vec3' }, ({ value }) => vectorDefault(value, [0, 0, 0]))
    .with({ type: 'vec4' }, ({ value }) => vectorDefault(value, [0, 0, 0, 0]))
    .otherwise(({ value }) => value ?? 0);
};

const userUniformValue = (uniform: ShaderParkUniform) => (_: regl.DefaultContext, props: Props) => {
  const overrides = props.userParams[UNIFORM_OVERRIDES_INDEX] as
    | Record<string, unknown>
    | undefined;
  const override = overrides?.[uniform.name];

  return normalizeShaderParkUniformValue(override ?? uniform.value, uniform.type);
};

export function buildShaderParkFragment(source: string) {
  const generated = sculptToGLSL(source) as ShaderParkGLSL;

  return {
    uniforms: generated.uniforms,
    fragment:
      minimalHeader +
      usePBRHeader +
      useHemisphereLight +
      uniformsToGLSL(generated.uniforms) +
      VIDEO_UNIFORMS +
      '\nconst float STEP_SIZE_CONSTANT = ' +
      generated.stepSizeConstant +
      ';\n' +
      'const int MAX_ITERATIONS = ' +
      generated.maxIterations +
      ';\n' +
      '#define MAX_REFLECTIONS ' +
      generated.maxReflections +
      '\n' +
      sculptureStarterCode +
      generated.geoGLSL +
      '\n' +
      generated.colorGLSL +
      '\n' +
      fragFooter
  };
}

export function createShaderParkDrawCommand({
  code,
  regl,
  gl,
  width,
  height,
  framebuffer,
  fallbackTexture,
  onError
}: {
  code: string;
  regl: regl.Regl;
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  framebuffer: regl.Framebuffer2D | null;
  fallbackTexture: regl.Texture2D;
  onError?: (error: Error & { lineErrors?: LineErrors }) => void;
}): regl.DrawCommand | null {
  let shaderParkSource: ReturnType<typeof buildShaderParkFragment>;

  try {
    shaderParkSource = buildShaderParkFragment(code);
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
    return null;
  }

  const vertexValidation = validateShader(gl, minimalVertexSource, gl.VERTEX_SHADER);

  if (!vertexValidation.valid) {
    onError?.(new Error(vertexValidation.error || 'Vertex shader compilation failed'));

    return null;
  }

  const fragmentValidation = validateShader(gl, shaderParkSource.fragment, gl.FRAGMENT_SHADER);

  if (!fragmentValidation.valid) {
    const error = new Error(
      fragmentValidation.error || 'Fragment shader compilation failed'
    ) as Error & { lineErrors?: LineErrors };

    error.lineErrors = fragmentValidation.lineErrors;
    onError?.(error);

    return null;
  }

  const uniforms: Record<string, unknown> = {};

  for (const uniform of shaderParkSource.uniforms) {
    uniforms[uniform.name] = isShaderParkBuiltInUniform(uniform.name)
      ? uniformDefault(uniform, width, height)
      : userUniformValue(uniform);
  }

  for (let index = 0; index < VIDEO_UNIFORM_COUNT; index++) {
    uniforms[`iChannel${index}`] = (_: regl.DefaultContext, props: Props) =>
      props.userParams[index] ?? fallbackTexture;
  }

  try {
    return regl({
      frag: shaderParkSource.fragment,
      vert: minimalVertexSource,
      framebuffer,
      attributes: {
        coordinates: regl.buffer([
          [-1, -1, 0],
          [3, -1, 0],
          [-1, 3, 0]
        ])
      },
      primitive: 'triangles',
      count: 3,
      depth: { enable: false },
      uniforms: {
        ...uniforms,
        resolution: () => [width, height]
      }
    });
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}
