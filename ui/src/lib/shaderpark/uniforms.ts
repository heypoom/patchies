import type { GLUniformDef, GLUniformType, GLUniformVec2 } from '../../types/uniform-config';
import type { PrimaryButton } from '$lib/eventbus/events';

export type ShaderParkGeneratedUniform = {
  name: string;
  type: string;
  value?: unknown;
  min?: unknown;
  max?: unknown;
};

type ShaderParkGeneratedSource = {
  uniforms: ShaderParkGeneratedUniform[];
};

type ShaderParkCore = typeof import('shader-park-core');

const BUILT_IN_UNIFORMS = new Set(['time', 'opacity', '_scale', 'mouse', 'stepSize', 'resolution']);

const SUPPORTED_INPUT_TYPES = new Set(['float', 'vec2', 'vec3', 'vec4']);
const PRIMARY_BUTTONS = new Set<PrimaryButton>(['code', 'settings', 'run']);

let shaderParkCorePromise: Promise<ShaderParkCore> | null = null;

function loadShaderParkCore(): Promise<ShaderParkCore> {
  shaderParkCorePromise ??= import('shader-park-core');

  return shaderParkCorePromise;
}

function removeShaderParkComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function isShaderParkBuiltInUniform(name: string) {
  return BUILT_IN_UNIFORMS.has(name);
}

export function normalizeShaderParkUniformValue(value: unknown, type: string): unknown {
  if (type === 'float') {
    return typeof value === 'number' ? value : 0;
  }

  const dimensions = type === 'vec2' ? 2 : type === 'vec3' ? 3 : type === 'vec4' ? 4 : 0;
  if (dimensions === 0) return undefined;

  if (Array.isArray(value)) {
    return Array.from({ length: dimensions }, (_, index) =>
      typeof value[index] === 'number' ? value[index] : 0
    );
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = ['x', 'y', 'z', 'w'];

    if (keys.slice(0, dimensions).some((key) => typeof record[key] === 'number')) {
      return keys
        .slice(0, dimensions)
        .map((key) => (typeof record[key] === 'number' ? record[key] : 0));
    }
  }

  return new Array(dimensions).fill(0);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function uniformLimitOrUndefined(value: unknown, type: string): number | GLUniformVec2 | undefined {
  if (type === 'float') {
    return numberOrUndefined(value);
  }

  if (type !== 'vec2') {
    return undefined;
  }

  const normalized = normalizeShaderParkUniformValue(value, type);

  return Array.isArray(normalized) && normalized.length === 2
    ? (normalized as GLUniformVec2)
    : undefined;
}

export function shaderParkUniformsToDefs(uniforms: ShaderParkGeneratedUniform[]): GLUniformDef[] {
  return uniforms
    .filter((uniform) => !isShaderParkBuiltInUniform(uniform.name))
    .filter((uniform) => SUPPORTED_INPUT_TYPES.has(uniform.type))
    .map((uniform) => {
      const normalizedDefault = normalizeShaderParkUniformValue(uniform.value, uniform.type);

      return {
        name: uniform.name,
        type: uniform.type as GLUniformType,
        default: normalizedDefault as GLUniformDef['default'],
        min: uniformLimitOrUndefined(uniform.min, uniform.type),
        max: uniformLimitOrUndefined(uniform.max, uniform.type),
        description: uniform.name
      };
    });
}

export function extractShaderParkVideoUniformIndices(source: string): number[] {
  const uncommented = removeShaderParkComments(source);
  const indices = new Set<number>();
  const channelRegex = /\biChannel([0-3])\b/g;

  let match: RegExpExecArray | null;
  while ((match = channelRegex.exec(uncommented)) !== null) {
    indices.add(Number(match[1]));
  }

  return [...indices].sort((a, b) => a - b);
}

export function usesShaderParkMouse(source: string): boolean {
  const uncommented = removeShaderParkComments(source);

  return /\bmouse\b|\bmouseIntersection\b/.test(uncommented);
}

export function parseShaderParkTitle(source: string): string | undefined {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const match = withoutBlocks.match(/^\s*\/\/\s*@title\s+(.+)$/m);

  return match?.[1]?.trim() || undefined;
}

export function detectShaderParkPrimaryButton(source: string): PrimaryButton {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const match = withoutBlocks.match(/^\s*\/\/\s*@primaryButton\s+(\S+)\s*$/m);
  const primaryButton = match?.[1] as PrimaryButton | undefined;

  return primaryButton && PRIMARY_BUTTONS.has(primaryButton) ? primaryButton : 'code';
}

function isShaderParkGeneratedSource(value: unknown): value is ShaderParkGeneratedSource {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray((value as Partial<ShaderParkGeneratedSource>).uniforms)
  );
}

export async function extractShaderParkUniformDefs(source: string): Promise<GLUniformDef[]> {
  const { sculptToGLSL } = await loadShaderParkCore();
  let generated: unknown;

  try {
    generated = sculptToGLSL(source);
  } catch (error) {
    throw new Error(
      `Shader Park uniform extraction failed for source (${source.length} chars): ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }

  if (!isShaderParkGeneratedSource(generated)) {
    return [];
  }

  return shaderParkUniformsToDefs(generated.uniforms);
}
