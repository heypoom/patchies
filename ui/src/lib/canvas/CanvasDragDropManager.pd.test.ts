import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualFilesystem } from '$lib/vfs';
import { CanvasDragDropManager } from './CanvasDragDropManager';

describe('CanvasDragDropManager Pure Data files', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
  });

  it('creates a configured pd node from a VFS file', async () => {
    const createNode = vi.fn();
    const manager = new CanvasDragDropManager({
      screenToFlowPosition: (position) => position,
      createNode,
      createNodeFromName: vi.fn()
    });
    VirtualFilesystem.getInstance().createEmbeddedFile(
      'patch://synth/main.pd',
      '#N canvas 0 0 200 200 10;'
    );

    await manager.insertVfsFile('patch://synth/main.pd', { x: 10, y: 20 });

    expect(createNode).toHaveBeenCalledWith(
      'pd',
      { x: 10, y: 20 },
      expect.objectContaining({ vfsPath: 'patch://synth/main.pd' })
    );
  });

  it('prefers the pd extension when a desktop file has a generic text MIME type', async () => {
    const createNode = vi.fn();
    const manager = new CanvasDragDropManager({
      screenToFlowPosition: (position) => position,
      createNode,
      createNodeFromName: vi.fn()
    });
    const file = new File(['#N canvas 0 0 200 200 10;'], 'main.pd', { type: 'text/plain' });
    vi.spyOn(VirtualFilesystem.getInstance(), 'storeFile').mockResolvedValue('user://main.pd');

    manager.onDrop({
      clientX: 30,
      clientY: 40,
      preventDefault: vi.fn(),
      target: { closest: () => null },
      dataTransfer: {
        getData: () => '',
        items: [{ kind: 'file', getAsFile: () => file }]
      }
    } as unknown as DragEvent);

    await vi.waitFor(() =>
      expect(createNode).toHaveBeenCalledWith(
        'pd',
        { x: 30, y: 40 },
        expect.objectContaining({ vfsPath: 'user://main.pd' })
      )
    );
  });
});
