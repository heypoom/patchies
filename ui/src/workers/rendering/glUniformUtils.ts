import { match } from 'ts-pattern';
import type { GLUniformDef } from '../../types/uniform-config';

/** Convert a hex color string (e.g. '#ff8800') to a normalized vec3 ([0-1, 0-1, 0-1]). */
export function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');

  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  ];
}

/** Convert a settings value to its GL representation, applying widget transforms (e.g. hex → vec3). */
export function toGLValue(
  def: GLUniformDef | undefined,
  value: unknown
): number | boolean | number[] | number[][] {
  if (def?.widget === 'color' && typeof value === 'string') {
    return hexToVec3(value);
  }

  return value as number | boolean | number[] | number[][];
}

export const vecComponents = (type: string): number | null =>
  match(type)
    .with('vec2', () => 2)
    .with('vec3', () => 3)
    .with('vec4', () => 4)
    .otherwise(() => null);

// Number of elements in a flat matrix array (column-major)
const matElements = (type: string): number | null =>
  match(type)
    .with('mat2', () => 4)
    .with('mat3', () => 9)
    .with('mat4', () => 16)
    .otherwise(() => null);

// Identity matrix as a flat column-major array
const matIdentity = (type: string): number[] | null =>
  match(type)
    .with('mat2', () => [1, 0, 0, 1])
    .with('mat3', () => [1, 0, 0, 0, 1, 0, 0, 0, 1])
    .with('mat4', () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    .otherwise(() => null);

export function defaultUniformValue(def: { type: string; arraySize?: number }): unknown {
  const n = vecComponents(def.type);
  const identity = matIdentity(def.type);

  return match(def.type)
    .with('bool', () => true)
    .with('float', () => 0.0)
    .with('int', () => 0)
    .with('vec2', 'vec3', 'vec4', () =>
      def.arraySize !== undefined
        ? Array.from({ length: def.arraySize }, () => new Array(n).fill(0))
        : new Array(n).fill(0)
    )
    .with('mat2', 'mat3', 'mat4', () =>
      def.arraySize !== undefined
        ? Array.from({ length: def.arraySize }, () => [...identity!])
        : [...identity!]
    )
    .with('sampler2D', () => null)
    .otherwise(() => null);
}

export function isValidUniformData(
  def: { type: string; arraySize?: number },
  data: unknown
): boolean {
  const n = vecComponents(def.type);
  const m = matElements(def.type);

  return match(def.type)
    .with('bool', () => typeof data === 'boolean')
    .with('float', 'int', () => typeof data === 'number')
    .with('vec2', 'vec3', 'vec4', () => {
      if (!Array.isArray(data)) return false;

      if (def.arraySize !== undefined) {
        return (
          data.length === def.arraySize && data.every((v) => Array.isArray(v) && v.length === n)
        );
      }

      return data.length === n;
    })
    .with('mat2', 'mat3', 'mat4', () => {
      if (!Array.isArray(data)) return false;

      if (def.arraySize !== undefined) {
        return (
          data.length === def.arraySize && data.every((v) => Array.isArray(v) && v.length === m)
        );
      }

      return data.length === m;
    })
    .with('sampler2D', () => data === null)
    .otherwise(() => false);
}
