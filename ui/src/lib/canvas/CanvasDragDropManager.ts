import { match } from 'ts-pattern';
import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
import { VirtualFilesystem } from '$lib/vfs';
import { logger } from '$lib/utils/logger';

/**
 * Callback to create a node with type, position, and optional custom data
 */
export type CreateNodeCallback = (
  type: string,
  position: { x: number; y: number },
  customData?: unknown
) => void;

/**
 * Callback to create a node from its name (handles visual nodes vs textual objects)
 */
export type CreateNodeFromNameCallback = (name: string, position: { x: number; y: number }) => void;

/**
 * Coordinate transformer from screen to flow position
 */
export type ScreenToFlowPositionFn = (coords: { x: number; y: number }) => { x: number; y: number };

export interface CanvasDragDropManagerConfig {
  screenToFlowPosition: ScreenToFlowPositionFn;
  createNode: CreateNodeCallback;
  createNodeFromName: CreateNodeFromNameCallback;
}

/**
 * Manages drag-and-drop operations for the flow canvas.
 * Handles file drops (images, audio, video, text), node palette drops,
 * and assembly memory drops.
 */
export class CanvasDragDropManager {
  private screenToFlowPosition: ScreenToFlowPositionFn;
  private createNode: CreateNodeCallback;
  private createNodeFromName: CreateNodeFromNameCallback;

  constructor(config: CanvasDragDropManagerConfig) {
    this.screenToFlowPosition = config.screenToFlowPosition;
    this.createNode = config.createNode;
    this.createNodeFromName = config.createNodeFromName;
  }

  /**
   * Handle drop events on the canvas
   */
  onDrop(event: DragEvent): void {
    const type = event.dataTransfer?.getData('application/svelteflow');
    const items = event.dataTransfer?.items;
    const memoryData = event.dataTransfer?.getData('application/asm-memory');
    const vfsPath = event.dataTransfer?.getData('application/x-vfs-path');
    const presetData = event.dataTransfer?.getData('application/x-preset');

    // Check if the drop target is within a node (to avoid duplicate handling)
    const target = event.target as HTMLElement;
    const isDropOnNode = target.closest('.svelte-flow__node');

    // If dropping VFS file on a node, let the node handle it via native drop event
    if (vfsPath && isDropOnNode) {
      return;
    }

    event.preventDefault();

    // Get accurate positioning with zoom/pan
    const position = this.screenToFlowPosition({ x: event.clientX, y: event.clientY });

    // Handle preset drops - create node from preset
    if (presetData && !isDropOnNode) {
      this.handlePresetDrop(presetData, position);
      return;
    }

    // Handle VFS file drops - create appropriate node based on file type
    if (vfsPath && !isDropOnNode) {
      this.handleVfsFileDrop(vfsPath, position);
      return;
    }

    // Handle assembly memory drops - create asm.value node
    if (memoryData && !isDropOnNode) {
      try {
        const data = JSON.parse(memoryData);
        this.createNode('asm.value', position, data);

        return;
      } catch (error) {
        logger.warn('Failed to parse memory drag data:', error);
      }
    }

    // Handle file drops - only if not dropping on an existing node
    if (items && items.length > 0 && !isDropOnNode) {
      // Filter to file items only
      const fileItems = Array.from(items).filter((item) => item.kind === 'file');
      if (fileItems.length > 0) {
        this.handleFileDrops(fileItems, position);
        return;
      }
    }

    // Handle node palette drops
    if (type) {
      this.createNodeFromName(type, position);
    }
  }

  /**
   * Handle dragover events to set appropriate drop effect
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();

    // Check what type of drag this is and set appropriate drop effect
    const hasMemoryData = event.dataTransfer?.types.includes('application/asm-memory');
    const hasSvelteFlowData = event.dataTransfer?.types.includes('application/svelteflow');
    const hasVfsData = event.dataTransfer?.types.includes('application/x-vfs-path');
    const hasPresetData = event.dataTransfer?.types.includes('application/x-preset');

    if (hasPresetData) {
      event.dataTransfer!.dropEffect = 'copy';
    } else if (hasVfsData) {
      event.dataTransfer!.dropEffect = 'copy';
    } else if (hasMemoryData) {
      event.dataTransfer!.dropEffect = 'copy';
    } else if (hasSvelteFlowData) {
      event.dataTransfer!.dropEffect = 'move';
    } else {
      event.dataTransfer!.dropEffect = 'move';
    }
  }

  /**
   * Handle preset drops from the sidebar
   */
  private handlePresetDrop(presetData: string, position: { x: number; y: number }): void {
    try {
      const { preset } = JSON.parse(presetData) as {
        path: string[];
        preset: { type: string; data: unknown; name: string };
      };

      // Create node with preset's type and data
      this.createNode(preset.type, position, preset.data);
    } catch (error) {
      logger.warn('Failed to parse preset drag data:', error);
    }
  }

  /**
   * Insert a preset at the specified position (public method for event-based insertion)
   */
  insertPreset(
    preset: { type: string; data: unknown; name: string },
    position: { x: number; y: number }
  ): void {
    this.createNode(preset.type, position, preset.data);
  }

  /**
   * Insert a VFS file at the specified position (public method for event-based insertion)
   */
  async insertVfsFile(vfsPath: string, position: { x: number; y: number }): Promise<void> {
    await this.handleVfsFileDrop(vfsPath, position);
  }

  /**
   * Handle dropped files by creating appropriate nodes
   */
  private async handleFileDrops(
    items: DataTransferItem[],
    basePosition: { x: number; y: number }
  ): Promise<void> {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      // Offset multiple files to avoid overlap
      const position = {
        x: basePosition.x + index * 20,
        y: basePosition.y + index * 20
      };

      const file = item.getAsFile();
      if (!file) continue;

      // Try to get FileSystemFileHandle for persistence (Chrome 86+)
      let handle: FileSystemFileHandle | undefined;

      if ('getAsFileSystemHandle' in item) {
        try {
          type Item = DataTransferItem & {
            getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
          };

          const fsHandle = await (item as Item).getAsFileSystemHandle();

          if (fsHandle?.kind === 'file') {
            handle = fsHandle as FileSystemFileHandle;
            logger.debug('got fs handle', handle);
          }
        } catch {
          // Not supported or denied - continue without handle
          logger.debug('fs not supported or denied');
        }
      }

      const nodeType = this.getNodeTypeFromFile(file);

      if (nodeType) {
        logger.debug('creating node with handle', handle);

        const customData = await this.getFileNodeData(file, nodeType, handle);
        this.createNode(nodeType, position, customData);
      }
    }
  }

  /**
   * Handle VFS file drops by creating appropriate nodes
   * Supports both direct VFS entries and files within linked folders
   */
  private async handleVfsFileDrop(
    vfsPath: string,
    position: { x: number; y: number }
  ): Promise<void> {
    const vfs = VirtualFilesystem.getInstance();
    // Use getEntryOrLinkedFile to support files within linked folders
    const entry = vfs.getEntryOrLinkedFile(vfsPath);

    if (!entry) {
      logger.warn('VFS entry not found:', vfsPath);
      return;
    }

    const nodeType = this.getNodeTypeFromMimeType(entry.mimeType);

    if (nodeType) {
      const customData = await this.getVfsFileNodeData(vfsPath, nodeType);
      this.createNode(nodeType, position, customData);
    }
  }

  /**
   * Get node type from file, checking both MIME type and extension
   */
  private getNodeTypeFromFile(file: File): string | null {
    // First try MIME type
    const fromMime = this.getNodeTypeFromMimeType(file.type);
    if (fromMime) return fromMime;

    // Fall back to extension-based detection for custom types
    return this.getNodeTypeFromExtension(file.name);
  }

  /**
   * Map file extensions to node types (for types browsers don't recognize)
   */
  private getNodeTypeFromExtension(filename: string): string | null {
    const ext = filename.split('.').pop()?.toLowerCase();

    return match(ext)
      .with('rom', () => 'uxn')
      .with('csd', () => 'csound~')
      .with('ck', () => 'chuck~')
      .otherwise(() => null);
  }

  /**
   * Map MIME types to node types
   */
  private getNodeTypeFromMimeType(mimeType: string | undefined): string | null {
    if (!mimeType) return null;

    return match(mimeType)
      .when(
        (t) => t.startsWith('image/'),
        () => 'img'
      )
      .when(
        (t) => t.startsWith('video/'),
        () => 'video'
      )
      .when(
        (t) =>
          t === 'application/javascript' ||
          t === 'text/javascript' ||
          t === 'application/x-javascript',
        () => 'js'
      )
      .when(
        (t) => t === 'text/x-csound-csd',
        () => 'csound~'
      )
      .when(
        (t) => t === 'text/x-chuck',
        () => 'chuck~'
      )
      .when(
        (t) => t.startsWith('text/'),
        () => 'markdown'
      )
      .when(
        (t) => t.startsWith('audio/'),
        () => 'soundfile~'
      )
      .when(
        (t) => t === 'application/x-uxn-rom',
        () => 'uxn'
      )
      .otherwise(() => null);
  }

  /**
   * Create appropriate data for VFS file-based nodes
   */
  private async getVfsFileNodeData(vfsPath: string, nodeType: string): Promise<unknown> {
    const vfs = VirtualFilesystem.getInstance();

    // Refactored: combine common logic for file-based text nodes
    const textNodeTypes = ['markdown', 'js', 'csound~', 'chuck~'];
    if (textNodeTypes.includes(nodeType)) {
      try {
        const file = await vfs.resolve(vfsPath);
        const content = await file.text();

        return {
          ...getDefaultNodeData(nodeType),
          ...(nodeType === 'markdown' && { markdown: content }),
          ...(nodeType === 'js' && { code: content }),
          ...((nodeType === 'csound~' || nodeType === 'chuck~') && { expr: content })
        };
      } catch (error) {
        logger.error(`Failed to read VFS ${nodeType} file:`, error);

        return {
          ...getDefaultNodeData(nodeType),
          ...(nodeType === 'markdown' && { markdown: '// Error loading file' }),
          ...(nodeType === 'js' && { code: '// Error loading file' }),
          ...((nodeType === 'csound~' || nodeType === 'chuck~') && {
            expr: '// Error loading file'
          })
        };
      }
    }

    if (['img', 'video', 'soundfile~', 'uxn'].includes(nodeType)) {
      return { ...getDefaultNodeData(nodeType), vfsPath };
    }

    return getDefaultNodeData(nodeType);
  }

  /**
   * Create appropriate data for file-based nodes
   */
  private async getFileNodeData(
    file: File,
    nodeType: string,
    handle?: FileSystemFileHandle
  ): Promise<unknown> {
    const vfs = VirtualFilesystem.getInstance();

    return await match(nodeType)
      .with('img', async () => {
        const vfsPath = await vfs.storeFile(file, handle);

        return {
          ...getDefaultNodeData('img'),
          vfsPath
        };
      })
      .with('markdown', async () => {
        try {
          const content = await file.text();

          return { ...getDefaultNodeData('markdown'), markdown: content };
        } catch (error) {
          logger.error('Failed to read markdown file:', error);

          return {
            ...getDefaultNodeData('markdown'),
            markdown: `Error loading file: ${file.name}`
          };
        }
      })
      .with('js', async () => {
        try {
          const content = await file.text();

          return { ...getDefaultNodeData('js'), code: content };
        } catch (error) {
          logger.error('Failed to read JavaScript file:', error);

          return { ...getDefaultNodeData('js'), code: `// Error loading file: ${file.name}` };
        }
      })
      .with('soundfile~', async () => {
        const vfsPath = await vfs.storeFile(file, handle);

        return {
          ...getDefaultNodeData('soundfile~'),
          vfsPath,
          fileName: file.name
        };
      })
      .with('video', async () => {
        const vfsPath = await vfs.storeFile(file, handle);

        return {
          ...getDefaultNodeData('video'),
          vfsPath,
          fileName: file.name
        };
      })
      .with('uxn', async () => {
        const vfsPath = await vfs.storeFile(file, handle);

        return {
          ...getDefaultNodeData('uxn'),
          vfsPath,
          fileName: file.name
        };
      })
      .with('csound~', async () => {
        try {
          const content = await file.text();

          return { ...getDefaultNodeData('csound~'), expr: content };
        } catch (error) {
          logger.error('Failed to read Csound file:', error);

          return { ...getDefaultNodeData('csound~'), expr: `; Error loading file: ${file.name}` };
        }
      })
      .with('chuck~', async () => {
        try {
          const content = await file.text();

          return { ...getDefaultNodeData('chuck~'), expr: content };
        } catch (error) {
          logger.error('Failed to read ChucK file:', error);

          return { ...getDefaultNodeData('chuck~'), expr: `// Error loading file: ${file.name}` };
        }
      })
      .otherwise(() => Promise.resolve(getDefaultNodeData(nodeType)));
  }
}
