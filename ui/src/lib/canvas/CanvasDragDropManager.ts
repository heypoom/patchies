import { match } from 'ts-pattern';
import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
import { VirtualFilesystem } from '$lib/vfs';

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
		event.preventDefault();

		const type = event.dataTransfer?.getData('application/svelteflow');
		const items = event.dataTransfer?.items;
		const memoryData = event.dataTransfer?.getData('application/asm-memory');

		// Check if the drop target is within a node (to avoid duplicate handling)
		const target = event.target as HTMLElement;
		const isDropOnNode = target.closest('.svelte-flow__node');

		// Get accurate positioning with zoom/pan
		const position = this.screenToFlowPosition({ x: event.clientX, y: event.clientY });

		// Handle assembly memory drops - create asm.value node
		if (memoryData && !isDropOnNode) {
			try {
				const data = JSON.parse(memoryData);
				this.createNode('asm.value', position, data);
				return;
			} catch (error) {
				console.warn('Failed to parse memory drag data:', error);
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

		if (hasMemoryData) {
			event.dataTransfer!.dropEffect = 'copy';
		} else if (hasSvelteFlowData) {
			event.dataTransfer!.dropEffect = 'move';
		} else {
			event.dataTransfer!.dropEffect = 'move';
		}
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
						console.log('got handle', handle);
					}
				} catch {
					// Not supported or denied - continue without handle
					console.log('not supported or denied - continue without handle');
				}
			}

			const nodeType = this.getNodeTypeFromFile(file);

			if (nodeType) {
				console.log('creating node with handle', handle);
				const customData = await this.getFileNodeData(file, nodeType, handle);
				this.createNode(nodeType, position, customData);
			}
		}
	}

	/**
	 * Map file types to node types based on MIME type
	 */
	private getNodeTypeFromFile(file: File): string | null {
		const mimeType = file.type;

		// Image files -> img node
		if (mimeType.startsWith('image/')) {
			return 'img';
		}

		// Video files -> video node
		if (mimeType.startsWith('video/')) {
			return 'video';
		}

		// Text files -> markdown node
		if (mimeType.startsWith('text/')) {
			return 'markdown';
		}

		// Audio files -> soundfile~ node
		if (mimeType.startsWith('audio/')) {
			return 'soundfile~';
		}

		// Unsupported file type
		return null;
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
					return {
						...getDefaultNodeData('markdown'),
						markdown: content
					};
				} catch (error) {
					console.error('Failed to read markdown file:', error);
					return {
						...getDefaultNodeData('markdown'),
						markdown: `Error loading file: ${file.name}`
					};
				}
			})
			.with('soundfile~', () =>
				Promise.resolve({
					...getDefaultNodeData('soundfile~'),
					file,
					fileName: file.name
				})
			)
			.with('video', () =>
				Promise.resolve({
					...getDefaultNodeData('video'),
					file,
					fileName: file.name
				})
			)
			.otherwise(() => Promise.resolve(getDefaultNodeData(nodeType)));
	}
}
