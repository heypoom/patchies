import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pd } from 'libpd-wasm';
import { EmbeddedProvider, VirtualFilesystem } from '$lib/vfs';

const { loadLibPd } = vi.hoisted(() => ({ loadLibPd: vi.fn() }));
vi.mock('./libpd-loader', () => ({ loadLibPd }));

import { PdAudioNode } from './PdAudioNode';

function audioContextMock() {
  return {
    createGain: () => ({ connect: vi.fn(), disconnect: vi.fn() })
  } as unknown as AudioContext;
}

function pdMock() {
  return {
    node: { connect: vi.fn() },
    sendBang: vi.fn(),
    sendFloat: vi.fn(),
    sendSymbol: vi.fn(),
    sendList: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(() => vi.fn())
  } as unknown as Pd;
}

describe('PdAudioNode', () => {
  beforeEach(() => {
    loadLibPd.mockReset();
    vi.unstubAllGlobals();
    VirtualFilesystem.resetInstance();
  });

  it('does not import libpd when no patch path is configured', async () => {
    const node = new PdAudioNode('pd-1', audioContextMock());
    node.bindRuntimeData({ initialData: {}, update: vi.fn() });

    await node.create();

    expect(loadLibPd).not.toHaveBeenCalled();
  });

  it('routes set messages to their named Pd receiver', async () => {
    const node = new PdAudioNode('pd-1', audioContextMock());
    const pd = pdMock();
    Reflect.set(node, 'pd', pd);

    await node.send('messageInlet', {
      inletIndex: 1,
      message: { type: 'set', key: 'frequency', value: 440 }
    });

    expect(pd.sendFloat).toHaveBeenCalledWith('frequency', 440);
  });

  it('loads and persists Pd source code without requiring an existing runtime', async () => {
    const pd = pdMock();
    const createPd = vi.fn().mockResolvedValue(pd);
    const update = vi.fn();
    loadLibPd.mockResolvedValue({
      checkPatch: vi.fn(() => ({ ok: false, messages: ['Unsupported #X record'] })),
      createPd,
      workletUrl: '/libpd-worklet-full.js'
    });
    const node = new PdAudioNode('pd-1', audioContextMock());
    node.bindRuntimeData({ initialData: {}, update });
    const code = '#N canvas 0 0 200 200 10;\n#X listbox 20 20 20 0 0 0 - - - 0;';

    await node.send('messageInlet', {
      inletIndex: 1,
      message: { type: 'load', code }
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCode: code, sourceUrl: '', vfsPath: '' })
    );
    expect(createPd).toHaveBeenCalledWith(
      expect.objectContaining({ files: { 'inline.pd': code }, entry: 'inline.pd' })
    );
    expect(node.getStatus()).toEqual({ state: 'ready', path: 'inline Pd code' });
  });

  it('compiles editor line comments before passing source to libpd', async () => {
    const pd = pdMock();
    const createPd = vi.fn().mockResolvedValue(pd);
    const checkPatch = vi.fn(() => ({ ok: true, messages: [] }));
    loadLibPd.mockResolvedValue({
      checkPatch,
      createPd,
      workletUrl: '/libpd-worklet-full.js'
    });
    const node = new PdAudioNode('pd-1', audioContextMock());
    node.bindRuntimeData({ initialData: {}, update: vi.fn() });
    const code = `#N canvas 0 0 200 200 10;
#X obj 20 20 osc~ 440;
// #X obj 20 50 dac~;
#X connect 0 0 1 0;`;
    const compiledCode = `#N canvas 0 0 200 200 10;
#X obj 20 20 osc~ 440;
#X text 20 50 Patchies disabled;
`;

    await node.setSourceCode(code);

    expect(node.getSourceCode()).toBe(code);
    expect(checkPatch).toHaveBeenCalledWith(
      expect.objectContaining({ files: { 'inline.pd': compiledCode } })
    );
    expect(createPd).toHaveBeenCalledWith(
      expect.objectContaining({ files: { 'inline.pd': compiledCode } })
    );
  });

  it('fetches and persists Pd patches loaded by URL', async () => {
    const pd = pdMock();
    const createPd = vi.fn().mockResolvedValue(pd);
    const update = vi.fn();
    const code = '#N canvas 0 0 200 200 10;';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue(code) })
    );
    loadLibPd.mockResolvedValue({
      checkPatch: vi.fn(() => ({ ok: true, messages: [] })),
      createPd,
      workletUrl: '/libpd-worklet-full.js'
    });
    const node = new PdAudioNode('pd-1', audioContextMock());
    node.bindRuntimeData({ initialData: {}, update });

    await node.send('messageInlet', {
      inletIndex: 1,
      message: { type: 'load', src: 'https://example.com/synth.pd' }
    });

    expect(fetch).toHaveBeenCalledWith(new URL('https://example.com/synth.pd'));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCode: null, sourceUrl: 'https://example.com/synth.pd' })
    );
    expect(createPd).toHaveBeenCalledWith(
      expect.objectContaining({ files: { 'synth.pd': code }, entry: 'synth.pd' })
    );
    expect(node.getSourceCode()).toBe(code);
  });

  it('loads and persists Pd patches from a VFS path', async () => {
    const pd = pdMock();
    const createPd = vi.fn().mockResolvedValue(pd);
    const update = vi.fn();
    const code = '#N canvas 0 0 200 200 10;\n#X obj 20 20 dac~;';
    const vfs = VirtualFilesystem.getInstance();
    vfs.registerProvider(new EmbeddedProvider());
    vfs.createEmbeddedFile('patch://pd/synth.pd', code);
    loadLibPd.mockResolvedValue({
      checkPatch: vi.fn(() => ({ ok: true, messages: [] })),
      createPd,
      workletUrl: '/libpd-worklet-full.js'
    });
    const node = new PdAudioNode('pd-1', audioContextMock());
    node.bindRuntimeData({ initialData: {}, update });

    await node.send('messageInlet', {
      inletIndex: 1,
      message: { type: 'load', src: 'patch://pd/synth.pd' }
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ sourceCode: null, sourceUrl: '', vfsPath: 'patch://pd/synth.pd' })
    );
    expect(createPd).toHaveBeenCalledWith(
      expect.objectContaining({ files: { 'synth.pd': code }, entry: 'synth.pd' })
    );
    expect(node.getSourceCode()).toBe(code);
  });

  it('persists edited code while keeping its external source as provenance', async () => {
    const pd = pdMock();
    const createPd = vi.fn().mockResolvedValue(pd);
    const update = vi.fn();
    const originalCode = '#N canvas 0 0 200 200 10;';
    const editedCode = `${originalCode}\n#X obj 20 20 osc~ 440;`;
    const abstractionCode = '#N canvas 0 0 100 100 10;';
    const vfs = VirtualFilesystem.getInstance();
    vfs.registerProvider(new EmbeddedProvider());
    vfs.createEmbeddedFile('patch://pd/synth.pd', originalCode);
    vfs.createEmbeddedFile('patch://pd/helper.pd', abstractionCode);
    loadLibPd.mockResolvedValue({
      checkPatch: vi.fn(() => ({ ok: true, messages: [] })),
      createPd,
      workletUrl: '/libpd-worklet-full.js'
    });
    const node = new PdAudioNode('pd-1', audioContextMock());
    node.bindRuntimeData({ initialData: {}, update });

    await node.setPath('patch://pd/synth.pd');
    update.mockClear();

    await node.setEditedCode(editedCode);

    expect(update).toHaveBeenCalledWith({ sourceCode: editedCode, hasConfiguredPorts: false });
    expect(node.getData()).toEqual(
      expect.objectContaining({
        vfsPath: 'patch://pd/synth.pd',
        sourceUrl: '',
        sourceCode: editedCode
      })
    );
    expect(createPd).toHaveBeenLastCalledWith(
      expect.objectContaining({
        files: { 'helper.pd': abstractionCode, 'synth.pd': editedCode },
        entry: 'synth.pd'
      })
    );

    await node.setPath('patch://pd/synth.pd');

    expect(node.getData().sourceCode).toBeNull();
  });
});
