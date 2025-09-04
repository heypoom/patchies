import type { SendMessageOptions } from '$lib/messages/MessageContext';

export type PatchiesEvent =
	| GLPreviewFrameCapturedEvent
	| PyodideConsoleOutputEvent
	| PyodideSendMessageEvent
	| NodePortCountUpdateEvent;

export interface PyodideConsoleOutputEvent {
	type: 'pyodideConsoleOutput';
	output: 'stdout' | 'stderr';
	message: string;
	nodeId: string;

	/** Mark that code execution is done. */
	finished?: boolean;
}

export interface PyodideSendMessageEvent {
	type: 'pyodideSendMessage';
	data: unknown;
	options?: SendMessageOptions;
	nodeId: string;
}

export interface GLPreviewFrameCapturedEvent {
	type: 'previewFrameCaptured';
	nodeId: string;
	requestId: string;
	success: boolean;
	bitmap?: ImageBitmap;
}

export interface NodePortCountUpdateEvent {
	type: 'nodePortCountUpdate';
	portType: 'message' | 'video';
	nodeId: string;
	inletCount: number;
	outletCount: number;
}
