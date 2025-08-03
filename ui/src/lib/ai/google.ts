import { GLEventBus, type GLPreviewFrameCapturedEvent } from '$lib/canvas/GLEventBus';
import { GLSystem } from '$lib/canvas/GLSystem';
import { GoogleGenAI, PersonGeneration, type ContentListUnion } from '@google/genai';

export async function generateImageWithGemini(
	prompt: string,
	{
		aspectRatio,
		apiKey,
		abortSignal
	}: { aspectRatio: string; apiKey: string; abortSignal?: AbortSignal }
): Promise<ImageBitmap | null> {
	const ai = new GoogleGenAI({ apiKey });

	const response = await ai.models.generateImages({
		model: 'imagen-4.0-generate-preview-06-06',
		prompt,
		config: {
			numberOfImages: 1,
			aspectRatio,
			abortSignal,
			personGeneration: PersonGeneration.ALLOW_ALL
		}
	});

	for (const out of response.generatedImages ?? []) {
		const base64Image = out.image?.imageBytes;

		if (!base64Image) {
			continue;
		}

		const blob = base64ToBlob(base64Image, 'image/png');

		return createImageBitmap(blob);
	}

	return null;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
	const byteCharacters = atob(base64);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	const byteArray = new Uint8Array(byteNumbers);
	return new Blob([byteArray], { type: mimeType });
}

export function createLLMFunction() {
	return async (prompt: string, context?: { imageNodeId?: string; abortSignal?: AbortSignal }) => {
		const apiKey = localStorage.getItem('gemini-api-key');

		if (!apiKey) {
			throw new Error('API key is not set. Please set it in the settings.');
		}

		const ai = new GoogleGenAI({ apiKey });
		const contents: ContentListUnion = [];

		// If there is a connected node that provides an image, we will include it in the request.
		if (context?.imageNodeId !== undefined) {
			const format = 'image/jpeg';
			const bitmap = await capturePreviewFrame(context.imageNodeId);

			if (bitmap) {
				const base64Image = await bitmapToBase64Image({ bitmap, format, quality: 0.7 });
				console.log('[llm] base64 input image size:', base64Image.length);

				contents.push({ inlineData: { mimeType: format, data: base64Image } });
			}
		}

		contents.push({ text: prompt });

		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents,
			config: { abortSignal: context?.abortSignal }
		});

		return response.text;
	};
}

export function bitmapToBase64Image({
	bitmap,
	format = 'image/jpeg',
	quality
}: {
	bitmap: ImageBitmap;
	format?: string;
	quality?: number;
}): string {
	const canvas = document.createElement('canvas');
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;

	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(bitmap, 0, 0);

	return canvas.toDataURL(format, quality).replace(`data:${format};base64,`, '');
}

export async function capturePreviewFrame(
	nodeId: string,
	{ timeout = 10000 }: { timeout?: number } = {}
) {
	const glSystem = GLSystem.getInstance();
	const requestId = Math.random().toString(36).substring(2, 15);
	let timeoutHandle: number;

	return new Promise<ImageBitmap | null>((resolve) => {
		const handleImageCaptured = (event: GLPreviewFrameCapturedEvent) => {
			if (event.requestId !== requestId) return;

			clearInterval(timeoutHandle);
			glSystem.eventBus.removeEventListener('previewFrameCaptured', handleImageCaptured);

			if (!event.success) return resolve(null);

			resolve(event.bitmap ?? null);
		};

		glSystem.eventBus.addEventListener('previewFrameCaptured', handleImageCaptured);

		// @ts-expect-error -- timeout type is wrong
		timeoutHandle = setTimeout(() => {
			glSystem.eventBus.removeEventListener('previewFrameCaptured', handleImageCaptured);
			resolve(null);
		}, timeout);

		glSystem.send('capturePreview', { nodeId, requestId });
	});
}
