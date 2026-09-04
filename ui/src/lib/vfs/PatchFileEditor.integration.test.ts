import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$workers/rendering/renderWorkerEntry?worker', () => ({
  default: class RenderWorkerMock {
    addEventListener = vi.fn();
    postMessage = vi.fn();
  }
}));

vi.mock('$lib/audio/AudioAnalysisSystem', () => ({
  AudioAnalysisSystem: {
    getInstance: () => ({ onFFTDataReady: null, disableFFT: vi.fn() })
  }
}));

vi.mock('$lib/canvas/IpcSystem', () => ({
  IpcSystem: {
    getInstance: () => ({ outputWindow: null })
  }
}));

import { GLSystem } from '$lib/canvas/GLSystem';
import { HistoryManager } from '$lib/history';
import { PatchFileEditorSession } from './PatchFileEditorSession';
import { VirtualFilesystem } from './VirtualFilesystem';

describe('Patch file editor GLSL integration', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
    HistoryManager.getInstance().clear();
  });

  it('isolates a draft, refreshes each shader consumer once on Save, and stays in sync on undo', () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();

    vfs.createEmbeddedFile('patch://shaders/math.glsl', 'float tone = 1.0;');
    vfs.createEmbeddedFile(
      'patch://shaders/material.glsl',
      '#include "./math.glsl"\nfloat material() { return tone; }'
    );

    history.clear();

    const glSystem = new GLSystem();
    const worker = glSystem.renderWorker as unknown as { postMessage: ReturnType<typeof vi.fn> };

    glSystem.upsertNode('glsl-direct', 'glsl', {
      code: '#include "patch://shaders/math.glsl"',
      glUniformDefs: []
    });

    glSystem.upsertNode('glsl-transitive', 'glsl', {
      code: '#include "./shaders/material.glsl"',
      glUniformDefs: []
    });

    glSystem.upsertNode('glsl-unrelated', 'glsl', {
      code: 'void mainImage() {}',
      glUniformDefs: []
    });

    const session = new PatchFileEditorSession(vfs);
    session.open('patch://shaders/math.glsl');
    session.updateDraft('float tone = 2.0;');

    worker.postMessage.mockClear();
    expect(vfs.readEmbeddedFile('patch://shaders/math.glsl')).toBe('float tone = 1.0;');
    expect(worker.postMessage).not.toHaveBeenCalled();

    expect(session.save()).toBe(true);
    expect(getIncludeRefreshes(worker)).toEqual([
      { id: 'glsl-direct', revision: 1 },
      { id: 'glsl-transitive', revision: 1 }
    ]);

    worker.postMessage.mockClear();
    history.undo();

    expect(session.syncSavedContent()).toBe('updated');
    expect(session.path).toBe('patch://shaders/math.glsl');
    expect(session.draft).toBe('float tone = 1.0;');

    expect(getIncludeRefreshes(worker)).toEqual([
      { id: 'glsl-direct', revision: 2 },
      { id: 'glsl-transitive', revision: 2 }
    ]);
  });
});

function getIncludeRefreshes(worker: { postMessage: ReturnType<typeof vi.fn> }) {
  const builds = worker.postMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => message.type === 'buildRenderGraph');

  expect(builds).toHaveLength(1);

  return builds[0].graph.nodes
    .filter((node: { data: { _includeRevision?: number } }) => node.data._includeRevision)
    .map((node: { id: string; data: { _includeRevision: number } }) => ({
      id: node.id,
      revision: node.data._includeRevision
    }))
    .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
}
