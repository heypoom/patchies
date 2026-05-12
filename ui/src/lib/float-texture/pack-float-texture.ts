export type FloatTextureDataFormat = 'r' | 'rg' | 'rgb' | 'rgba';

export type FloatTextureSource = Float32Array | Float32Array[];

export interface PackedFloatTexture {
  width: number;
  height: number;
  data: Float32Array;
}

interface PackFloatTextureOptions {
  dataFormat?: FloatTextureDataFormat;
  extraPixelValue?: [number, number, number, number];
  target?: Float32Array;
}

const CHANNELS_PER_FORMAT: Record<FloatTextureDataFormat, number> = {
  r: 1,
  rg: 2,
  rgb: 3,
  rgba: 4
};

const DEFAULT_EXTRA_PIXEL_VALUE: [number, number, number, number] = [0, 0, 0, 1];

export const normalizeFloatTextureSource = (source: FloatTextureSource): Float32Array[] =>
  source instanceof Float32Array ? [source] : source;

export function inferFloatTextureDataFormat(source: FloatTextureSource): FloatTextureDataFormat {
  const channels = normalizeFloatTextureSource(source);

  if (channels.length <= 1) return 'r';
  if (channels.length === 2) return 'rg';
  if (channels.length === 3) return 'rgb';

  return 'rgba';
}

export function packFloatTexture(
  source: FloatTextureSource,
  { dataFormat, extraPixelValue = DEFAULT_EXTRA_PIXEL_VALUE, target }: PackFloatTextureOptions = {}
): PackedFloatTexture {
  const channels = normalizeFloatTextureSource(source);
  const resolvedDataFormat = dataFormat ?? inferFloatTextureDataFormat(source);
  const channelsPerRow = CHANNELS_PER_FORMAT[resolvedDataFormat];
  const rowCount = Math.max(1, Math.ceil(channels.length / channelsPerRow));

  const rowWidths = Array.from({ length: rowCount }, (_, rowIndex) => {
    const start = rowIndex * channelsPerRow;
    const group = channels.slice(start, start + channelsPerRow);

    return Math.max(1, ...group.map((channel) => channel.length));
  });

  const width = Math.max(...rowWidths);
  const height = rowCount;
  const expectedLength = width * height * 4;

  const data = target?.length === expectedLength ? target : new Float32Array(expectedLength);

  for (let row = 0; row < height; row++) {
    const channelStart = row * channelsPerRow;

    for (let x = 0; x < width; x++) {
      const pixelIndex = (row * width + x) * 4;

      for (let component = 0; component < 4; component++) {
        const channel = component < channelsPerRow ? channels[channelStart + component] : undefined;

        data[pixelIndex + component] = channel?.[x] ?? extraPixelValue[component];
      }
    }
  }

  return { width, height, data };
}
