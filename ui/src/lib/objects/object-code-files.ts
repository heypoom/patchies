import type { SupportedLanguage } from '$lib/codemirror/types';

/** Transport-independent source projection, shared by VFS and future sync hosts. */
export interface CodeObject {
  id: string;
  type?: string;
  data: Record<string, unknown>;
}

export interface ObjectCodeFile {
  objectId: string;
  filename: string;
  dataKey: string;
  language: SupportedLanguage;
  content: string;
}

type SourceDefinition = readonly [string, string, SupportedLanguage];

const definitions: Record<string, SourceDefinition> = {
  glsl: ['code', 'shader.glsl', 'glsl'],
  'wgpu.compute': ['code', 'shader.wgsl', 'wgsl'],
  python: ['code', 'code.py', 'python'],
  ruby: ['code', 'code.rb', 'ruby'],
  peppermint: ['code', 'code.pep', 'peppermint'],
  patchbay: ['code', 'code.patchbay', 'patchbay'],
  asm: ['code', 'code.asm', 'assembly'],
  uxn: ['code', 'code.tal', 'assembly'],
  uiua: ['expr', 'code.ua', 'uiua'],
  'chuck~': ['expr', 'code.ck', 'javascript'],
  'csound~': ['expr', 'code.csd', 'plain']
};

for (const type of [
  'js',
  'p5',
  'hydra',
  'strudel',
  'swgl',
  'canvas',
  'canvas.dom',
  'textmode',
  'textmode.dom',
  'three',
  'three.dom',
  'dom',
  'vue',
  'pixi',
  'pixi.dom',
  'regl',
  'shaderpark',
  'worker',
  'surface',
  'dsp~',
  'tone~',
  'sonic~',
  'elem~'
]) {
  definitions[type] = ['code', 'code.js', 'javascript'];
}

for (const type of [
  'expr',
  'filter',
  'map',
  'tap',
  'scan',
  'uniq',
  'expr~',
  'fexpr~',
  'peek',
  'bytebeat~'
]) {
  definitions[type] = ['expr', 'code.js', 'javascript'];
}

export function getObjectCodeFiles(object: CodeObject): ObjectCodeFile[] {
  const definition = object.type ? definitions[object.type] : undefined;
  if (!definition) return [];

  const [dataKey, filename, language] = definition;
  const content = object.data[dataKey];
  if (typeof content !== 'string') return [];

  return [{ objectId: object.id, filename, dataKey, language, content }];
}

/** Validates an existing source and returns a host-applicable data update. */
export function editObjectCodeFile(object: CodeObject, filename: string, content: string) {
  const file = getObjectCodeFiles(object).find((file) => file.filename === filename);
  if (!file) throw new Error(`Object source not found: ${object.id}/${filename}`);

  return { ...file, content, updates: { [file.dataKey]: content } };
}

export const getObjectCodeLanguage = (filename: string): SupportedLanguage =>
  Object.values(definitions).find((definition) => definition[1] === filename)?.[2] ?? 'plain';
