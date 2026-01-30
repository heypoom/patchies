import type { GLUniformDef } from '../../types/uniform-config';

export function shaderCodeToUniformDefs(code: string): GLUniformDef[] {
  const uniformRegex = /uniform\s+(\w+)\s+(\w+);/g;
  const uniformDefs: GLUniformDef[] = [];
  let match;

  while ((match = uniformRegex.exec(code)) !== null) {
    const type = match[1] as GLUniformDef['type'];
    const name = match[2];
    uniformDefs.push({ name, type });
  }

  return uniformDefs;
}
