import { reactive } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { JSRunner, lowerExternalImports } from './JSRunner';
import { VirtualFilesystem } from '$lib/vfs/VirtualFilesystem';
import type { EmbeddedVFSEntry } from '$lib/vfs/types';

const llmMock = vi.hoisted(() => Object.assign(vi.fn(), { turn: vi.fn() }));
vi.mock('$lib/ai/google', () => ({ createLLMFunction: () => llmMock }));

describe('JSRunner', () => {
  const runner = new JSRunner();
  const nodeId = 'js-runner-tags-test';

  afterEach(() => {
    runner.destroy(nodeId);
  });

  it.each(['llm', 'llm.turn'])('snapshots reactive history for %s', async (method) => {
    const history = reactive([
      { role: 'user', content: 'First' },
      {
        role: 'assistant',
        content: 'Answer',
        state: {
          provider: 'gemini',
          model: 'test-model',
          content: 'Answer',
          raw: { parts: [{ text: 'Answer', thoughtSignature: 'signature' }] }
        }
      },
      { role: 'user', content: 'Next' }
    ]);
    const mock = method === 'llm' ? llmMock : llmMock.turn;
    mock.mockImplementationOnce(async (input) => {
      history[0].content = 'Changed';
      return input;
    });
    const result = vi.fn();

    await runner.executeJavaScript(nodeId, `result(await ${method}(history))`, {
      skipMessageContext: true,
      extraContext: { history, result }
    });

    expect(result).toHaveBeenCalledWith([
      { role: 'user', content: 'First' },
      {
        role: 'assistant',
        content: 'Answer',
        state: {
          provider: 'gemini',
          model: 'test-model',
          content: 'Answer',
          raw: { parts: [{ text: 'Answer', thoughtSignature: 'signature' }] }
        }
      },
      { role: 'user', content: 'Next' }
    ]);
    expect(() => structuredClone(result.mock.calls[0][0])).not.toThrow();
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

  it('reports every clock callback registration', async () => {
    const onSchedulerCallbackRegistered = vi.fn();

    const code = `
      clock.onBeat('*', () => {});
      clock.schedule(60, () => {});
      clock.every('1:0:0', () => {});
      clock.onPlayStateChange(() => {});
    `;

    await runner.executeJavaScript(nodeId, code, {
      skipMessageContext: true,
      onSchedulerCallbackRegistered
    });

    expect(onSchedulerCallbackRegistered).toHaveBeenCalledTimes(4);
  });

  describe.each(['llm', 'llm.turn'])('%s cancellation', (method) => {
    it.each(['cleanup', 'rerun', 'destroy', 'explicit'])(
      'aborts pending requests on %s',
      async (action) => {
        const mock = method === 'llm' ? llmMock : llmMock.turn;

        const started = Promise.withResolvers<AbortSignal>();
        const controller = new AbortController();

        const failed = vi.fn();
        const completed = vi.fn();

        mock.mockImplementationOnce((_input, options) => {
          started.resolve(options.abortSignal);

          return new Promise((_resolve, reject) => {
            options.abortSignal.addEventListener('abort', () => reject(new Error('cancelled')));
          });
        });

        const execution = runner.executeJavaScript(
          nodeId,
          `try { completed(await ${method}('Hello', { abortSignal: signal })); }
           catch (error) { failed(error.message); }`,
          {
            extraContext: {
              signal: action === 'explicit' ? controller.signal : undefined,
              failed,
              completed
            }
          }
        );

        const signal = await started.promise;
        expect(signal.aborted).toBe(false);

        if (action === 'cleanup') {
          runner.getMessageContext(nodeId).runCleanupCallbacks();
        } else if (action === 'rerun') {
          await runner.executeJavaScript(nodeId, '');
        } else if (action === 'destroy') {
          runner.destroy(nodeId);
        } else {
          controller.abort();
        }

        await execution;

        expect(signal.aborted).toBe(true);
        expect(failed).toHaveBeenCalledWith('cancelled');
        expect(completed).not.toHaveBeenCalled();
      }
    );

    it('uses a fresh signal on rerun without a message context', async () => {
      const mock = method === 'llm' ? llmMock : llmMock.turn;
      const signals: AbortSignal[] = [];

      mock.mockImplementation(async (_input, options) => {
        signals.push(options.abortSignal);
        return 'Answer';
      });

      await runner.executeJavaScript(nodeId, `await ${method}('First')`, {
        skipMessageContext: true
      });

      await runner.executeJavaScript(nodeId, `await ${method}('Second')`, {
        skipMessageContext: true
      });

      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);

      runner.destroy(nodeId);
      expect(signals[1].aborted).toBe(true);

      mock.mockReset();
    });
  });
});
