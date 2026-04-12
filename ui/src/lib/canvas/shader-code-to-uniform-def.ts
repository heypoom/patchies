import { match } from 'ts-pattern';
import type { GLUniformDef } from '../../types/uniform-config';
import type { SettingsField } from '$lib/settings/types';
import type { FBOFormat, FBOResolution } from '$lib/rendering/types';

export interface ParamDirective {
  name: string;

  /** Raw default string — coerced to number/boolean at merge time based on uniform type */
  default?: string;

  min?: number;
  max?: number;
  description?: string;

  /** Widget override — e.g. 'color' renders a vec3 as a color picker */
  widget?: 'color';
}

export interface ShaderDirectives {
  name?: string;
  params: Map<string, ParamDirective>;
}

const DIRECTIVE_RE = /^[ \t]*\/\/\s*@(title|param)\s+(.+)$/gm;

// @param name [default] [min] [max] ["description"]
const PARAM_RE = /^(\w+)(?:\s+(-?[\w.]+))?(?:\s+(-?[\d.]+))?(?:\s+(-?[\d.]+))?(?:\s+"([^"]*)")?$/;

function parseParamDirective(value: string): ParamDirective | null {
  const match = PARAM_RE.exec(value);
  if (!match) return null;

  const [, name, defaultValue, minValue, maxValue, description] = match;
  const param: ParamDirective = { name };

  if (defaultValue === 'color') {
    param.widget = 'color';
  } else if (defaultValue != null) {
    param.default = defaultValue;
  }

  if (minValue != null) {
    param.min = parseFloat(minValue);
  }

  if (maxValue != null) {
    param.max = parseFloat(maxValue);
  }

  if (description != null) {
    param.description = description;
  }

  return param;
}

export function parseShaderDirectives(code: string): ShaderDirectives {
  const result: ShaderDirectives = { params: new Map() };

  let match;

  DIRECTIVE_RE.lastIndex = 0;

  while ((match = DIRECTIVE_RE.exec(code)) !== null) {
    const [, directive, rest] = match;
    const value = rest.trim();

    if (directive === 'title' && !result.name) {
      result.name = value;
    } else if (directive === 'param') {
      const param = parseParamDirective(value);
      if (!param) continue;

      result.params.set(param.name, param);
    }
  }

  return result;
}

export function parseShaderName(code: string): string | undefined {
  const match = /^[ \t]*\/\/\s*@title\s+(.+)$/m.exec(code);

  return match ? match[1].trim() : undefined;
}

/** Parse `// @format rgba32f` directive. Returns 'rgba8' if absent. */
export function detectFboFormat(code: string): FBOFormat {
  const withoutBlocks = code.replace(/\/\*[\s\S]*?\*\//g, '');
  const match = withoutBlocks.match(/^\s*\/\/\s*@format\s+(rgba8|rgba16f|rgba32f)\s*$/m);

  return (match?.[1] as FBOFormat) ?? 'rgba8';
}

/** Parse `// @resolution 256` (or `256x128`, `1/n`) directive. */
export function detectResolution(code: string): FBOResolution | undefined {
  const withoutBlocks = code.replace(/\/\*[\s\S]*?\*\//g, '');
  const match = withoutBlocks.match(/^\s*\/\/\s*@resolution\s+(.+)$/m);
  if (!match) return undefined;

  const resolution = match[1].trim();

  // Match 1/n fractional format (e.g. 1/2, 1/4, 1/8, 1/16)
  const fracMatch = resolution.match(/^1\/(\d+)$/);
  if (fracMatch) {
    const divisor = Number(fracMatch[1]);
    if (divisor >= 2) return resolution;
  }

  if (resolution.includes('x')) {
    const parts = resolution.split('x').map(Number);

    if (parts.length === 2 && parts.every(Number.isFinite)) {
      return parts as [number, number];
    }
  }

  const number = Number(resolution);

  return Number.isFinite(number) ? number : undefined;
}

export function shaderCodeToUniformDefs(code: string): GLUniformDef[] {
  const directives = parseShaderDirectives(code);
  const uniformRegex = /uniform\s+(\w+)\s+(\w+)(?:\[(\d+)\])?;/g;
  const uniformDefs: GLUniformDef[] = [];

  let result;

  while ((result = uniformRegex.exec(code)) !== null) {
    const type = result[1] as GLUniformDef['type'];
    const name = result[2];
    const arraySize = result[3] ? parseInt(result[3], 10) : undefined;

    const param = directives.params.get(name);

    uniformDefs.push({
      name,
      type,
      ...(arraySize !== undefined && { arraySize }),
      ...(param?.default != null && {
        default:
          type === 'bool'
            ? param.default === 'true' || param.default === '1'
            : parseFloat(param.default)
      }),
      ...(param?.min != null && { min: param.min }),
      ...(param?.max != null && { max: param.max }),
      ...(param?.description != null && { description: param.description }),
      ...(param?.widget != null && { widget: param.widget })
    });
  }

  return uniformDefs;
}

function deriveFloatStep(...values: (number | undefined)[]): number {
  let maxDecimals = 0;

  for (const value of values) {
    if (value == null) continue;

    const valueString = value.toString();
    const dotIndex = valueString.indexOf('.');

    if (dotIndex !== -1) {
      maxDecimals = Math.max(maxDecimals, valueString.length - dotIndex - 1);
    }
  }

  return maxDecimals === 0 ? 0.01 : Math.pow(10, -maxDecimals);
}

export const uniformDefsToSettingsSchema = (defs: GLUniformDef[]): SettingsField[] =>
  defs.flatMap((def) =>
    match<string, SettingsField[]>(def.type)
      .with('float', () => {
        const step = deriveFloatStep(def.default as number, def.min, def.max);

        return [
          def.min != null && def.max != null
            ? {
                key: def.name,
                label: def.description ?? def.name,
                type: 'slider' as const,
                default: (def.default as number) ?? 0,
                min: def.min,
                max: def.max,
                step,
                persistence: 'node' as const
              }
            : {
                key: def.name,
                label: def.description ?? def.name,
                type: 'number' as const,
                default: (def.default as number) ?? 0,
                step,
                persistence: 'node' as const
              }
        ];
      })
      .with('int', () => [
        def.min != null && def.max != null
          ? {
              key: def.name,
              label: def.description ?? def.name,
              type: 'slider' as const,
              default: (def.default as number) ?? 0,
              min: def.min,
              max: def.max,
              step: 1,
              persistence: 'node' as const
            }
          : {
              key: def.name,
              label: def.description ?? def.name,
              type: 'number' as const,
              default: (def.default as number) ?? 0,
              step: 1,
              persistence: 'node' as const
            }
      ])
      .with('bool', () => [
        {
          key: def.name,
          label: def.description ?? def.name,
          type: 'boolean' as const,
          default: (def.default as boolean) ?? false,
          persistence: 'node' as const
        }
      ])
      .with('vec3', () =>
        def.widget === 'color'
          ? [
              {
                key: def.name,
                label: def.description ?? def.name,
                type: 'color' as const,
                default: '#ffffff',
                persistence: 'node' as const
              }
            ]
          : []
      )
      .otherwise(() => [])
  );
