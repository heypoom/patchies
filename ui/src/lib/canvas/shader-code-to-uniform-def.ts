import { match } from 'ts-pattern';
import type { GLUniformDef } from '../../types/uniform-config';
import type { SettingsField } from '$lib/settings/types';

export interface ParamDirective {
  type: string;
  name: string;
  default?: number | boolean;

  min?: number;
  max?: number;
  description?: string;
}

export interface ShaderDirectives {
  name?: string;
  params: Map<string, ParamDirective>;
}

const DIRECTIVE_RE = /^[ \t]*\/\/\s*@(title|param)\s+(.+)$/gm;
const PARAM_RE =
  /^(\w+)\s+(\w+)(?:\s+(-?[\w.]+))?(?:\s+(-?[\d.]+))?(?:\s+(-?[\d.]+))?(?:\s+"([^"]*)")?$/;

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
      const paramMatch = PARAM_RE.exec(value);
      if (!paramMatch) continue;

      const [, type, name, defaultVal, minVal, maxVal, description] = paramMatch;
      const param: ParamDirective = { type, name };

      if (type === 'bool') {
        if (defaultVal != null) {
          param.default = defaultVal === 'true' || defaultVal === '1';
        }
      } else {
        if (defaultVal != null) {
          param.default = parseFloat(defaultVal);
        }

        if (minVal != null) {
          param.min = parseFloat(minVal);
        }

        if (maxVal != null) {
          param.max = parseFloat(maxVal);
        }
      }

      if (description != null) param.description = description;

      result.params.set(name, param);
    }
  }

  return result;
}

export function parseShaderName(code: string): string | undefined {
  const m = /^[ \t]*\/\/\s*@title\s+(.+)$/m.exec(code);

  return m ? m[1].trim() : undefined;
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
      ...(param?.default != null && { default: param.default }),
      ...(param?.min != null && { min: param.min }),
      ...(param?.max != null && { max: param.max }),
      ...(param?.description != null && { description: param.description })
    });
  }

  return uniformDefs;
}

export const uniformDefsToSettingsSchema = (defs: GLUniformDef[]): SettingsField[] =>
  defs.flatMap((def) =>
    match<string, SettingsField[]>(def.type)
      .with('float', () => [
        def.min != null && def.max != null
          ? {
              key: def.name,
              label: def.description ?? def.name,
              type: 'slider' as const,
              default: (def.default as number) ?? 0,
              min: def.min,
              max: def.max,
              step: 0.01,
              persistence: 'node' as const
            }
          : {
              key: def.name,
              label: def.description ?? def.name,
              type: 'number' as const,
              default: (def.default as number) ?? 0,
              step: 0.01,
              persistence: 'node' as const
            }
      ])
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
      .otherwise(() => [])
  );
