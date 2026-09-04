import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryManager } from '$lib/history';
import { JSRunner } from '$lib/js-runner/JSRunner';
import {
  createTestPatchRuntime,
  resetPatchRuntimeTestObject,
  TEST_OBJECT_TYPE
} from '$lib/runtime/utils/runtime-test-utils';
import { PatchFileEditorSession } from './PatchFileEditorSession';
import { VirtualFilesystem } from './VirtualFilesystem';

const moduleConsumer = (id: string, code: string) => ({
  id,
  type: TEST_OBJECT_TYPE,
  data: {
    name: TEST_OBJECT_TYPE,
    expr: TEST_OBJECT_TYPE,
    params: [],
    code
  }
});

describe('Patch JavaScript module editing', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
    HistoryManager.getInstance().clear();
    resetPatchRuntimeTestObject();
  });

  it('keeps drafts isolated, then reruns direct and transitive importers once on Save and undo', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();
    const runner = JSRunner.getInstance();

    vfs.createEmbeddedFile('patch://math.js', 'export const value = 1');
    vfs.createEmbeddedFile(
      'patch://lib/render.js',
      "import { value } from '../math.js'; export const render = () => value"
    );
    await runner.syncPatchModules(vfs);
    history.clear();

    const runtime = createTestPatchRuntime();

    await runtime.setGraph({
      objects: [
        moduleConsumer('direct', "import { value } from 'math'; send(value)"),
        moduleConsumer(
          'transitive',
          "import { render } from 'patch://lib/render.js'; send(render())"
        ),
        moduleConsumer('unrelated', "import { other } from 'other'; send(other)")
      ],
      connections: []
    });

    const session = new PatchFileEditorSession(vfs);
    session.open('patch://math.js');
    session.updateDraft('export const value = 2');

    expect(runtime.getModuleDependentNodeIds('patch://math.js')).toEqual(['direct', 'transitive']);
    expect(runner.modules.get('patch://math.js')).toBe('export const value = 1');
    expect(runtime.getGraph().objects.map(({ data }) => data.executeCode)).toEqual([
      undefined,
      undefined,
      undefined
    ]);

    expect(session.save()).toBe(true);

    await vi.waitFor(() => {
      expect(runtime.getGraph().objects.map(({ data }) => data.executeCode)).toEqual([
        1,
        1,
        undefined
      ]);
    });
    expect(runner.modules.get('patch://math.js')).toBe('export const value = 2');

    history.undo();

    await vi.waitFor(() => {
      expect(runtime.getGraph().objects.map(({ data }) => data.executeCode)).toEqual([
        2,
        2,
        undefined
      ]);
    });
    expect(runner.modules.get('patch://math.js')).toBe('export const value = 1');

    runtime.destroy();
  });

  it('reruns an importer when a newly created module satisfies its missing import', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const runner = JSRunner.getInstance();
    await runner.syncPatchModules(vfs);

    const runtime = createTestPatchRuntime();
    await runtime.setGraph({
      objects: [moduleConsumer('waiting', "import { value } from 'created-later'; send(value)")],
      connections: []
    });

    vfs.createEmbeddedFile('patch://created-later.js', 'export const value = 1');

    await vi.waitFor(() => {
      expect(runtime.getGraph().objects[0].data.executeCode).toBe(1);
    });

    runtime.destroy();
  });
});
