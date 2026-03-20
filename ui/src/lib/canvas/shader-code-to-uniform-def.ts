import { match } from 'ts-pattern';
import type { GLUniformDef } from '../../types/uniform-config';
import type { SettingsField } from '$lib/settings/types';

export function shaderCodeToUniformDefs(code: string): GLUniformDef[] {
  const uniformRegex = /uniform\s+(\w+)\s+(\w+)(?:\[(\d+)\])?;/g;
  const uniformDefs: GLUniformDef[] = [];

  let result;

  while ((result = uniformRegex.exec(code)) !== null) {
    const type = result[1] as GLUniformDef['type'];
    const name = result[2];
    const arraySize = result[3] ? parseInt(result[3], 10) : undefined;

    uniformDefs.push({ name, type, ...(arraySize !== undefined && { arraySize }) });
  }

  return uniformDefs;
}

export const uniformDefsToSettingsSchema = (defs: GLUniformDef[]): SettingsField[] =>
  defs.flatMap((def) =>
    match<string, SettingsField[]>(def.type)
      .with('float', () => [
        {
          key: def.name,
          label: def.name,
          type: 'number' as const,
          step: 0.01,
          persistence: 'none' as const
        }
      ])
      .with('int', () => [
        {
          key: def.name,
          label: def.name,
          type: 'number' as const,
          step: 1,
          persistence: 'none' as const
        }
      ])
      .with('bool', () => [
        { key: def.name, label: def.name, type: 'boolean' as const, persistence: 'none' as const }
      ])
      .otherwise(() => [])
  );
