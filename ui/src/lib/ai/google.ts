import { GoogleGenAI, Modality } from '@google/genai';

export async function generateImageWithGemini(
	prompt: string,
	apiKey: string
): Promise<ImageBitmap | null> {
	const ai = new GoogleGenAI({ apiKey });

	// Set responseModalities to include "Image" so the model can generate  an image
	const response = await ai.models.generateContent({
		model: 'gemini-2.0-flash-preview-image-generation',
		contents: prompt,
		config: {
			responseModalities: [Modality.TEXT, Modality.IMAGE]
		}
	});

	const parts = response.candidates?.[0].content?.parts ?? [];

	for (const part of parts) {
		if (part.inlineData) {
			const base64Image = part.inlineData.data;

			if (!base64Image) {
				continue;
			}

			const blob = base64ToBlob(base64Image, 'image/png');

			return createImageBitmap(blob);
		}
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
