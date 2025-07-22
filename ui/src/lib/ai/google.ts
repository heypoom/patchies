import { GoogleGenAI } from '@google/genai';

export async function generateImageWithGemini(
	prompt: string,
	apiKey: string
): Promise<ImageBitmap | null> {
	const ai = new GoogleGenAI({ apiKey });

	const response = await ai.models.generateImages({
		model: 'imagen-4.0-generate-preview-06-06',
		prompt,
		config: {
			numberOfImages: 1,
			aspectRatio: '1:1'
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

export async function generateVideoWithGemini(
	prompt: string,
	apiKey: string
): Promise<string | null> {
	const ai = new GoogleGenAI({ apiKey });

	let operation = await ai.models.generateVideos({
		model: 'veo-3.0-generate-preview',
		prompt
	});

	// Poll the operation status until the video is ready
	while (!operation.done) {
		await new Promise((resolve) => setTimeout(resolve, 10000));
		operation = await ai.operations.getVideosOperation({ operation });
	}

	return operation.response?.generatedVideos?.[0].video?.uri ?? null;
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
