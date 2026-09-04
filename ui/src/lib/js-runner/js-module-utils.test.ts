import { describe, expect, it } from 'vitest';

import {
  getImportedModuleNames,
  getModuleDependentNodeIds,
  isSnippetModule
} from './js-module-utils';
import { JSModuleResolver } from './JSModuleResolver';

describe('js module utils', () => {
  const ism = isSnippetModule;

  it('should detect es module', () => {
    expect(ism('import { a } from "b"')).toBe(true);
    expect(ism('export const a = 1')).toBe(true);
    expect(ism('const a = 1')).toBe(false);
    expect(ism('const obj = { a: 1, b: 2 }; export default obj;')).toBe(true);
    expect(ism('// imma import this\ncool()')).toBe(false);
    expect(ism('// imma import this\nimport { a } from "foo"')).toBe(true);
  });

  it('extracts static imports, re-exports, and literal dynamic imports', () => {
    expect(
      getImportedModuleNames(
        "import { add } from 'math'\nimport helpers from \"helpers\"\nimport 'setup'\nexport * from 're-export'\nexport { value } from 'named-re-export'\nimport('dynamic')\n// import 'ignored'\nconst label = \"from 'ignored-string'\""
      )
    ).toEqual(new Set(['math', 'helpers', 'setup', 're-export', 'named-re-export', 'dynamic']));
  });

  it('finds alias, relative, explicit, and transitive VFS dependents in order', () => {
    const modules = new Map([
      ['patch://math.js', 'export const add = () => 1'],
      [
        'patch://lib/render.js',
        "import { add } from '../math.js'\nexport const render = () => add()"
      ]
    ]);
    const resolver = new JSModuleResolver(modules);

    expect(
      getModuleDependentNodeIds(
        [
          {
            id: 'explicit',
            data: { code: "import { add } from 'patch://math.js'\nsend(add())" }
          },
          {
            id: 'transitive',
            data: { code: "import { render } from './lib/render.js'\nsend(render())" }
          },
          { id: 'alias', data: { code: "import { add } from 'math'\nsend(add())" } }
        ],
        'patch://math.js',
        modules,
        resolver
      )
    ).toEqual(['explicit', 'alias', 'transitive']);
  });

  it('finds dependents through re-exports and literal dynamic imports', () => {
    const modules = new Map([
      ['patch://math.js', 'export const add = () => 1'],
      ['patch://re-export.js', "export { add } from './math.js'"],
      ['patch://dynamic.js', "export const load = () => import('./math.js')"]
    ]);
    const resolver = new JSModuleResolver(modules);

    expect(
      getModuleDependentNodeIds(
        [
          { id: 're-export-consumer', data: { code: "import { add } from 're-export'" } },
          { id: 'dynamic-consumer', data: { code: "import { load } from 'dynamic'" } }
        ],
        'patch://math.js',
        modules,
        resolver
      )
    ).toEqual(['re-export-consumer', 'dynamic-consumer']);
  });
});
