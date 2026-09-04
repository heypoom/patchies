import { afterEach, describe, expect, it, vi } from 'vitest';

import { JSRunner, lowerExternalImports } from './JSRunner';
import { VirtualFilesystem } from '$lib/vfs/VirtualFilesystem';
import type { EmbeddedVFSEntry } from '$lib/vfs/types';

describe('JSRunner', () => {
  const runner = new JSRunner();
  const nodeId = 'js-runner-tags-test';

  afterEach(() => {
    runner.destroy(nodeId);
  });

  it('exposes setTags to user code', async () => {
    const setTags = vi.fn();

    await runner.executeJavaScript(nodeId, "setTags(['shader/foo/function'])", {
      skipMessageContext: true,
      setTags
    });

    expect(setTags).toHaveBeenCalledWith(['shader/foo/function']);
  });

  it('fails missing imports before starting the bundler', async () => {
    await expect(
      runner.preprocessCode("import { value } from 'missing'; send(value)", { nodeId })
    ).rejects.toMatchObject({
      code: 'JS_MODULE_NOT_FOUND',
      details: {
        specifier: 'missing',
        importer: `node-${nodeId}.js`,
        attemptedPaths: ['patch://missing.js']
      }
    });
  });

  it('lowers aliased, namespace, and side-effect external imports', async () => {
    const output = lowerExternalImports(
      [
        "import defaultValue, { remoteValue as localValue } from 'https://example.test/module.js';",
        "import * as namespace from 'https://example.test/module.js';",
        "import 'https://example.test/setup.js';",
        'console.log(defaultValue, localValue, namespace);'
      ].join('\n'),
      [
        {
          source: 'https://example.test/module.js',
          specifiers: [
            { type: 'default', localName: 'defaultValue' },
            { type: 'named', importedName: 'remoteValue', localName: 'localValue' },
            { type: 'namespace', localName: 'namespace' }
          ]
        },
        { source: 'https://example.test/setup.js', specifiers: [] }
      ]
    );

    expect(output).toContain('const { remoteValue: localValue } = __patchies_import_0;');
    expect(output).toContain('const namespace = __patchies_import_0;');
    expect(output).toContain("await import('https://example.test/setup.js');");
    expect(output).not.toContain("from 'https://example.test/module.js'");
    expect(output).not.toContain("import 'https://example.test/setup.js'");
  });

  it('registers hydrated Patch modules and replays them to later environments', async () => {
    VirtualFilesystem.resetInstance();
    const vfs = VirtualFilesystem.getInstance();
    const hydratedRunner = new JSRunner();

    await vfs.hydrate({
      patch: {
        'utils.js': {
          provider: 'embedded',
          filename: 'utils.js',
          content: 'export const value = 1'
        } satisfies EmbeddedVFSEntry,
        'shader.glsl': {
          provider: 'embedded',
          filename: 'shader.glsl',
          content: 'float value = 1.0;'
        } satisfies EmbeddedVFSEntry
      }
    });

    await hydratedRunner.syncPatchModules(vfs);

    const updates: Array<[string, string | null]> = [];
    hydratedRunner.subscribeModules((moduleName, code) => updates.push([moduleName, code]));

    expect(hydratedRunner.modules).toEqual(
      new Map([['patch://utils.js', 'export const value = 1']])
    );
    expect(updates).toEqual([['patch://utils.js', 'export const value = 1']]);
  });
});
