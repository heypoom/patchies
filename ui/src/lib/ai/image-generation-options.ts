import type { GenerateContentConfig } from '@google/genai';

export interface ImageGenerationOptions {
  aspectRatio?: string;
  resolution?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  seed?: number;
  size?: string;
  quality?: string;
  outputFormat?: string;
  background?: string;
  outputCompression?: number;
}

export function getGeminiImageResolutions(model: string): string[] {
  if (model.includes('2.5-flash-image')) return [];
  if (model.includes('flash-lite-image')) return ['1K'];
  if (model.includes('3.1-flash-image')) return ['512', '1K', '2K', '4K'];

  return ['1K', '2K', '4K'];
}

export function getGeminiImageConfig(
  options: ImageGenerationOptions = {},
  model: string
): GenerateContentConfig {
  const { aspectRatio, temperature, topP, topK, seed } = options;
  const resolution = getGeminiImageResolutions(model).includes(options.resolution ?? '')
    ? options.resolution
    : undefined;

  return {
    temperature,
    topP,
    topK,
    seed,
    ...((aspectRatio || resolution) && {
      // The installed SDK exposes newer image fields through extraBody.
      httpOptions: {
        extraBody: {
          generationConfig: {
            imageConfig: {
              aspectRatio: aspectRatio || undefined,
              imageSize: resolution
            }
          }
        }
      }
    })
  };
}

export function getOpenRouterImageOptions(options: ImageGenerationOptions = {}) {
  const size = options.size?.trim() || undefined;
  if (size && !/^[1-9]\d*x[1-9]\d*$/.test(size)) {
    throw new Error('Pixel dimensions must use width x height, for example 1024x1024.');
  }

  const hasPixelSize = !!size;
  const supportsCompression = options.outputFormat === 'jpeg' || options.outputFormat === 'webp';
  const supportsTransparency = options.outputFormat !== 'jpeg';

  return {
    aspect_ratio: hasPixelSize ? undefined : options.aspectRatio || undefined,
    resolution: hasPixelSize ? undefined : options.resolution || undefined,
    size,
    quality: options.quality || undefined,
    output_format: options.outputFormat || undefined,
    background:
      !supportsTransparency && options.background === 'transparent'
        ? undefined
        : options.background || undefined,
    output_compression: supportsCompression ? options.outputCompression : undefined,
    seed: options.seed
  };
}
