export type PatchiesEvent = GLPreviewFrameCapturedEvent | PyodideConsoleOutputEvent;

export interface PyodideConsoleOutputEvent {
	type: 'pyodideConsoleOutput';
	output: 'stdout' | 'stderr';
	message: string;
	nodeId: string;
}

export interface GLPreviewFrameCapturedEvent {
	type: 'previewFrameCaptured';
	nodeId: string;
	requestId: string;
	success: boolean;
	bitmap?: ImageBitmap;
}
