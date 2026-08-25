import { describe, expect, it } from 'vitest';

import {
  loadPixiDomExtensions,
  loadPixiWorkerExtensions,
  getPixiExtensionVersion
} from './extensions';

describe('loadPixiWorkerExtensions', () => {
  it('loads every worker-safe Pixi extension with the all shorthand', async () => {
    await expect(loadPixiWorkerExtensions('all')).resolves.toBeUndefined();

    expect(getPixiExtensionVersion()).toBe(18);
  });

  it('loads browser-only extensions for pixi.dom', async () => {
    await expect(loadPixiDomExtensions('all')).resolves.toBeUndefined();

    expect(getPixiExtensionVersion()).toBe(22);
  });

  it('rejects browser-only Pixi extensions before loading them', async () => {
    await expect(loadPixiWorkerExtensions('dom')).rejects.toThrow('pixi.dom');
    await expect(loadPixiWorkerExtensions('text-html')).rejects.toThrow('pixi.dom');
  });

  it('rejects inherited object property names as unknown extensions', async () => {
    await expect(loadPixiDomExtensions('constructor')).rejects.toThrow(
      'Unknown extension "constructor"'
    );
  });
});
