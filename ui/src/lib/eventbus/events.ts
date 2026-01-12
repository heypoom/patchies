import type { SendMessageOptions } from '$lib/messages/MessageContext';

export type PatchiesEvent =
	| ConsoleOutputEvent
	| GLPreviewFrameCapturedEvent
	| PyodideConsoleOutputEvent
	| PyodideSendMessageEvent
	| NodePortCountUpdateEvent
	| NodeTitleUpdateEvent
	| NodeHidePortsUpdateEvent
	| NodeDragEnabledUpdateEvent
	| NodeVideoOutputEnabledUpdateEvent
	| NodeMouseScopeUpdateEvent;

export interface ConsoleOutputEvent {
	type: 'consoleOutput';
	nodeId: string;
	messageType: 'log' | 'warn' | 'error' | 'debug';
	timestamp: number;
	args: unknown[]; // Raw arguments for rich rendering
	lineErrors?: Record<number, string[]>; // Error messages grouped by line number
}

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

export interface NodeTitleUpdateEvent {
	type: 'nodeTitleUpdate';
	nodeId: string;
	title: string;
}

export interface NodeHidePortsUpdateEvent {
	type: 'nodeHidePortsUpdate';
	nodeId: string;
	hidePorts: boolean;
}

export interface NodeDragEnabledUpdateEvent {
	type: 'nodeDragEnabledUpdate';
	nodeId: string;
	dragEnabled: boolean;
}

export interface NodeVideoOutputEnabledUpdateEvent {
	type: 'nodeVideoOutputEnabledUpdate';
	nodeId: string;
	videoOutputEnabled: boolean;
}

export interface NodeMouseScopeUpdateEvent {
	type: 'nodeMouseScopeUpdate';
	nodeId: string;
	scope: 'global' | 'local';
}
