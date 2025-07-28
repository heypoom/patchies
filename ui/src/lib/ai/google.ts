import { GoogleGenAI, PersonGeneration, type ContentListUnion } from '@google/genai';

export async function generateImageWithGemini(
	prompt: string,
	{ apiKey, abortSignal }: { apiKey: string; abortSignal?: AbortSignal }
): Promise<ImageBitmap | null> {
	const ai = new GoogleGenAI({ apiKey });

	const response = await ai.models.generateImages({
		model: 'imagen-4.0-generate-preview-06-06',
		prompt,
		config: {
			numberOfImages: 1,
			aspectRatio: '1:1',
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
	return async (
		prompt: string,
		context?: { canvas?: HTMLCanvasElement; abortSignal?: AbortSignal }
	) => {
		const apiKey = localStorage.getItem('gemini-api-key');

		if (!apiKey) {
			throw new Error('API key is not set. Please set it in the settings.');
		}

		const ai = new GoogleGenAI({ apiKey });

		const contents: ContentListUnion = [];

		if (context?.canvas) {
			const base64Image = await htmlCanvasToImage(context.canvas, 'image/jpeg', 0.4);
			console.log('[llm] base64 image size:', base64Image.length);

			contents.push({ inlineData: { mimeType: 'image/jpeg', data: base64Image } });
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

/**
 * Converts an HTML <canvas> element's content to a base64 encoded image string.
 *
 * @param {HTMLCanvasElement} canvas The canvas element to convert.
 * @param {string} [imageType='image/png'] The desired image format (e.g., 'image/png', 'image/jpeg').
 * @param {number} [quality=0.92] For 'image/jpeg' or 'image/webp', a number between 0 and 1 indicating the image quality.
 * @returns {string} A DOMString containing the data URL of the image represented by the canvas.
 * Returns an empty string if the canvas is not valid or an error occurs.
 */
export async function htmlCanvasToImage(
	canvas: HTMLCanvasElement,
	imageType = 'image/jpeg',
	quality = 0.92
) {
	if (!(canvas instanceof HTMLCanvasElement)) {
		console.error('Invalid input: Provided element is not an HTMLCanvasElement.');
		return '';
	}

	try {
		let dataUrl = '';

		// Get the raw image data as a data URL (base64 encoded)
		// The toDataURL() method is native to the Canvas API and directly outputs base64.
		// For JPEG, the quality parameter is used.
		if (imageType === 'image/jpeg' || imageType === 'image/webp') {
			dataUrl = canvas.toDataURL(imageType, quality);
		} else {
			dataUrl = canvas.toDataURL(imageType);
		}

		return dataUrl.replace('data:image/jpeg;base64,', '');
	} catch (error) {
		console.error('Error converting canvas to image:', error);
		return '';
	}
}
