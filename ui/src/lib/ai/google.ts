import { GLSystem } from '$lib/canvas/GLSystem';
import type { GLPreviewFrameCapturedEvent } from '$lib/eventbus/events';

export async function generateImageWithGemini(
  prompt: string,
  {
    apiKey,
    model = 'gemini-2.5-flash-image',
    abortSignal,
    inputImageNodeId
  }: {
    apiKey: string;
    model?: string;
    abortSignal?: AbortSignal;
    inputImageNodeId?: string;
  }
): Promise<ImageBitmap> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Add input image if provided (for image-to-image generation)
  if (inputImageNodeId) {
    const glSystem = GLSystem.getInstance();
    const [outWidth, outHeight] = glSystem.outputSize;

    // for image-to-image, we use half resolution of the output size.
    const customSize = [outWidth, outHeight] as [number, number];

    const bitmap = await capturePreviewFrame(inputImageNodeId, { customSize });

    if (bitmap) {
      const base64Image = bitmapToBase64Image({
        bitmap,
        format: 'image/jpeg',
        quality: 0.98
      });

      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      });
    }
  }

  // Add text prompt
  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model,
    contents,
    config: { abortSignal }
  });

  // Check all candidates for an image
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData && part.inlineData.data) {
        const base64Image = part.inlineData.data;
        const blob = base64ToBlob(base64Image, 'image/png');
        return createImageBitmap(blob);
      }
    }
  }

  // If no image was generated, check if the AI returned a text response
  const textResponses: string[] = [];
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if ('text' in part && part.text) {
        textResponses.push(part.text.trim());
      }
    }
  }

  if (textResponses.length > 0) {
    throw new Error(`AI response: ${textResponses.join(' ')}`);
  }

  throw new Error('No image generated and no response from AI.');
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

export async function generateImageWithOpenRouter(
  prompt: string,
  {
    apiKey,
    model,
    abortSignal
  }: {
    apiKey: string;
    model: string;
    abortSignal?: AbortSignal;
  }
): Promise<ImageBitmap> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://patchies.app',
      'X-Title': 'Patchies'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image']
    }),
    signal: abortSignal
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const images: { image_url?: { url?: string } }[] = data.choices?.[0]?.message?.images ?? [];

  for (const img of images) {
    const url = img.image_url?.url;
    if (!url) continue;
    const base64 = url.replace(/^data:[^;]+;base64,/, '');
    const blob = base64ToBlob(base64, 'image/png');
    return createImageBitmap(blob);
  }

  // Some models embed the image in content parts instead
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content) {
    throw new Error(
      `Model did not generate an image. Try an image-capable model. Response: ${content}`
    );
  }

  throw new Error(
    'No image returned. Make sure your OpenRouter model supports image generation (e.g. google/gemini-2.5-flash-preview-05-20).'
  );
}

export function createLLMFunction() {
  return async (
    prompt: string,
    context?: {
      imageNodeId?: string;
      abortSignal?: AbortSignal;
      model?: string;
      temperature?: number;
      topK?: number;
    }
  ) => {
    const { getTextProvider } = await import('./providers');
    const provider = getTextProvider(context?.model);

    const images: Array<{ mimeType: string; data: string }> = [];

    // If there is a connected node that provides an image, we will include it in the request.
    if (context?.imageNodeId !== undefined) {
      const format = 'image/jpeg';
      const bitmap = await capturePreviewFrame(context.imageNodeId);

      if (bitmap) {
        const base64Image = bitmapToBase64Image({ bitmap, format, quality: 0.7 });
        console.log('[llm] base64 input image size:', base64Image.length);
        images.push({ mimeType: format, data: base64Image });
      }
    }

    return provider.generateText([{ role: 'user', content: prompt, images }], {
      signal: context?.abortSignal,
      temperature: context?.temperature,
      topK: context?.topK
    });
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

export async function compressImageFile(
  file: File | Blob,
  { maxSize = 1024, quality = 0.75 }: { maxSize?: number; quality?: number } = {}
): Promise<{ mimeType: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mimeType = 'image/jpeg';
  const data = canvas.toDataURL(mimeType, quality).replace(`data:${mimeType};base64,`, '');
  return { mimeType, data };
}

export async function capturePreviewFrame(
  nodeId: string,
  { timeout = 10000, customSize }: { timeout?: number; customSize?: [number, number] } = {}
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

    glSystem.send('capturePreview', { nodeId, requestId, customSize });
  });
}
