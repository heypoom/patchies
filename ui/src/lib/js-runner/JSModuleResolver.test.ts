import { describe, expect, it } from 'vitest';

import { JSModuleResolver } from './JSModuleResolver';

describe('JSModuleResolver', () => {
  it('resolves top-level Patch modules without canvas-library precedence', async () => {
    const resolver = new JSModuleResolver(
      new Map([['patch://utils.js', 'export const source = "patch"']])
    );

    await expect(resolver.resolve('utils', 'node-consumer.js')).resolves.toMatchObject({
      id: 'patch://utils.js',
      category: 'patch-root'
    });
  });

  it('resolves bare, nested, relative, and explicit Patch modules canonically', async () => {
    const resolver = new JSModuleResolver(
      new Map([
        ['patch://utils.js', 'export {}'],
        ['patch://lib/exact.js', 'export {}'],
        ['patch://nested/utils.js', 'export {}'],
        ['patch://lib/module.mjs', 'export {}']
      ])
    );

    await expect(resolver.resolve('utils', 'node-consumer.js')).resolves.toMatchObject({
      id: 'patch://utils.js'
    });
    await expect(resolver.resolve('./exact', 'patch://lib/consumer.js')).resolves.toMatchObject({
      id: 'patch://lib/exact.js'
    });
    await expect(resolver.resolve('nested/utils', 'node-consumer.js')).resolves.toMatchObject({
      id: 'patch://nested/utils.js'
    });
    await expect(
      resolver.resolve('patch://lib/module.mjs', 'node-consumer.js')
    ).resolves.toMatchObject({ id: 'patch://lib/module.mjs' });
  });

  it('resolves and rereads explicit User modules through the configured loader', async () => {
    const modules = new Map<string, string>();
    const resolver = new JSModuleResolver(modules);
    let source = 'export const value = 1';

    resolver.setVfsModuleLoader(async (path) => {
      if (path !== 'user://lib/utils.js') throw new Error('missing');

      return source;
    });

    const resolved = await resolver.resolve('user://lib/utils', 'node-consumer.js');
    expect(resolved.id).toBe('user://lib/utils.js');
    expect(await resolver.load(resolved.id, 'node-consumer.js')).toBe(source);

    source = 'export const value = 2';
    expect(await resolver.load(resolved.id, 'node-consumer.js')).toBe(source);
  });

  it('resolves relative User imports beside their importer', async () => {
    const resolver = new JSModuleResolver(new Map());

    resolver.setVfsModuleLoader(async (path) => {
      if (path !== 'user://lib/utils.js') throw new Error('missing');

      return 'export const value = 1';
    });

    await expect(resolver.resolve('./utils', 'user://lib/consumer.js')).resolves.toMatchObject({
      id: 'user://lib/utils.js'
    });
  });

  it('only resolves mjs files when the extension is explicit', async () => {
    const resolver = new JSModuleResolver(
      new Map([['patch://module.mjs', 'export const value = 1']])
    );

    await expect(resolver.resolve('module.mjs', 'node-consumer.js')).resolves.toMatchObject({
      id: 'patch://module.mjs'
    });
    await expect(resolver.resolve('module', 'node-consumer.js')).rejects.toMatchObject({
      details: { attemptedPaths: ['patch://module.js'] }
    });
  });

  it('rejects namespace escapes and missing imports with structured diagnostics', async () => {
    const resolver = new JSModuleResolver(new Map());

    await expect(
      resolver.resolve('../../outside', 'patch://lib/consumer.js')
    ).rejects.toMatchObject({
      code: 'JS_MODULE_NOT_FOUND',
      details: {
        specifier: '../../outside',
        importer: 'patch://lib/consumer.js',
        attemptedCategories: ['relative-patch']
      }
    });

    await expect(resolver.resolve('missing', 'node-consumer.js')).rejects.toMatchObject({
      code: 'JS_MODULE_NOT_FOUND',
      details: {
        attemptedPaths: ['patch://missing.js'],
        attemptedCategories: ['patch-root']
      }
    });
  });

  it('preserves npm and URL imports as external modules', async () => {
    const resolver = new JSModuleResolver(new Map());

    await expect(resolver.resolve('npm:lodash-es', 'node-consumer.js')).resolves.toEqual({
      id: 'npm:lodash-es',
      category: 'npm',
      external: true
    });
    await expect(
      resolver.resolve('https://example.com/module.js', 'node-consumer.js')
    ).resolves.toEqual({
      id: 'https://example.com/module.js',
      category: 'url',
      external: true
    });
  });
});
