export type FloatTextureDataFormat = 'r' | 'rg' | 'rgb' | 'rgba';
export type FloatTextureChannelLayout = 'rows' | 'wrapped' | 'square';
export type FloatTextureChannel = Float32Array | SharedArrayBuffer;
export type FloatTextureFloatChannelSource = Float32Array | Float32Array[];
export type FloatTextureSharedChannelSource = SharedArrayBuffer | SharedArrayBuffer[];
export type FloatTextureChannelSource = FloatTextureChannel | FloatTextureChannel[];

export type FloatTextureWrappedSource =
  | {
      type: 'wrapped';
      channels: FloatTextureFloatChannelSource;
      width: number;
      format?: FloatTextureDataFormat;
    }
  | {
      type: 'wrapped';
      channels: FloatTextureSharedChannelSource;
      width: number;
      version: number;
      format?: FloatTextureDataFormat;
    };

export type FloatTextureSquareSource =
  | {
      type: 'square';
      channels: FloatTextureFloatChannelSource;
      format?: FloatTextureDataFormat;
    }
  | {
      type: 'square';
      channels: FloatTextureSharedChannelSource;
      version: number;
      format?: FloatTextureDataFormat;
    };

export type FloatTextureInterleavedSource = {
  data: Float32Array;
  width: number;
  height: number;
  type: 'rgba';
};

export type FloatTextureSharedSource = {
  buffer: SharedArrayBuffer;
  width: number;
  height: number;
  type: 'rgba';
  version: number;
};

export type FloatTextureSource =
  | Float32Array
  | Float32Array[]
  | FloatTextureWrappedSource
  | FloatTextureSquareSource
  | FloatTextureInterleavedSource
  | FloatTextureSharedSource;

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

const isSharedArrayBuffer = (value: unknown): value is SharedArrayBuffer =>
  typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer;

const isFloatTextureChannel = (value: unknown): value is FloatTextureChannel =>
  value instanceof Float32Array || isSharedArrayBuffer(value);

const isFloat32ChannelSource = (value: unknown): value is FloatTextureFloatChannelSource =>
  value instanceof Float32Array ||
  (Array.isArray(value) && value.every((channel) => channel instanceof Float32Array));

const isSharedChannelSource = (value: unknown): value is FloatTextureSharedChannelSource =>
  isSharedArrayBuffer(value) ||
  (Array.isArray(value) && value.every((channel) => isSharedArrayBuffer(channel)));

const normalizeChannel = (channel: FloatTextureChannel): Float32Array =>
  channel instanceof Float32Array ? channel : new Float32Array(channel);

const normalizeChannelSource = (source: FloatTextureChannelSource): Float32Array[] =>
  isFloatTextureChannel(source) ? [normalizeChannel(source)] : source.map(normalizeChannel);

export function isFloatTextureInterleavedSource(
  source: unknown
): source is FloatTextureInterleavedSource {
  if (!source || typeof source !== 'object') return false;

  const value = source as Partial<FloatTextureInterleavedSource>;

  return (
    value.data instanceof Float32Array &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    value.type === 'rgba'
  );
}

export function isFloatTextureSharedSource(source: unknown): source is FloatTextureSharedSource {
  if (!source || typeof source !== 'object' || typeof SharedArrayBuffer === 'undefined') {
    return false;
  }

  const value = source as Partial<FloatTextureSharedSource>;

  return (
    value.buffer instanceof SharedArrayBuffer &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    value.type === 'rgba' &&
    typeof value.version === 'number'
  );
}

export function isFloatTextureWrappedSource(source: unknown): source is FloatTextureWrappedSource {
  if (!source || typeof source !== 'object') return false;

  const value = source as Partial<FloatTextureWrappedSource>;
  const version = (value as { version?: unknown }).version;
  const hasValidChannels =
    isFloat32ChannelSource(value.channels) ||
    (isSharedChannelSource(value.channels) && typeof version === 'number');

  return (
    value.type === 'wrapped' &&
    value.channels !== undefined &&
    hasValidChannels &&
    typeof value.width === 'number'
  );
}

export function isFloatTextureSquareSource(source: unknown): source is FloatTextureSquareSource {
  if (!source || typeof source !== 'object') return false;

  const value = source as Partial<FloatTextureSquareSource>;
  const version = (value as { version?: unknown }).version;
  const hasValidChannels =
    isFloat32ChannelSource(value.channels) ||
    (isSharedChannelSource(value.channels) && typeof version === 'number');

  return value.type === 'square' && value.channels !== undefined && hasValidChannels;
}

export const normalizeFloatTextureSource = (source: FloatTextureSource): Float32Array[] =>
  source instanceof Float32Array
    ? [source]
    : Array.isArray(source)
      ? source
      : isFloatTextureWrappedSource(source) || isFloatTextureSquareSource(source)
        ? normalizeChannelSource(source.channels)
        : isFloatTextureSharedSource(source)
          ? [new Float32Array(source.buffer)]
          : [source.data];

export function inferFloatTextureDataFormat(source: FloatTextureSource): FloatTextureDataFormat {
  if (isFloatTextureInterleavedSource(source) || isFloatTextureSharedSource(source)) return 'rgba';
  if (isFloatTextureWrappedSource(source) || isFloatTextureSquareSource(source)) {
    return source.format ?? inferFloatTextureDataFormat(normalizeChannelSource(source.channels));
  }

  const channels = normalizeFloatTextureSource(source);

  if (channels.length <= 1) return 'r';
  if (channels.length === 2) return 'rg';
  if (channels.length === 3) return 'rgb';

  return 'rgba';
}

function createChannelGroups(channels: Float32Array[], dataFormat: FloatTextureDataFormat) {
  const channelsPerRow = CHANNELS_PER_FORMAT[dataFormat];
  const rowCount = Math.max(1, Math.ceil(channels.length / channelsPerRow));

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const start = rowIndex * channelsPerRow;
    const group = channels.slice(start, start + channelsPerRow);
    const width = Math.max(1, ...group.map((channel) => channel.length));

    return { group, width };
  });
}

function fillPixel(
  data: Float32Array,
  pixelIndex: number,
  group: Float32Array[],
  sampleIndex: number,
  channelsPerRow: number,
  extraPixelValue: [number, number, number, number]
) {
  const offset = pixelIndex * 4;

  for (let component = 0; component < 4; component++) {
    const channel = component < channelsPerRow ? group[component] : undefined;

    data[offset + component] = channel?.[sampleIndex] ?? extraPixelValue[component];
  }
}

function fillExtraPixel(
  data: Float32Array,
  pixelIndex: number,
  extraPixelValue: [number, number, number, number]
) {
  const offset = pixelIndex * 4;

  data[offset + 0] = extraPixelValue[0];
  data[offset + 1] = extraPixelValue[1];
  data[offset + 2] = extraPixelValue[2];
  data[offset + 3] = extraPixelValue[3];
}

export function packFloatTexture(
  source: FloatTextureSource,
  { dataFormat, extraPixelValue = DEFAULT_EXTRA_PIXEL_VALUE, target }: PackFloatTextureOptions = {}
): PackedFloatTexture {
  if (isFloatTextureInterleavedSource(source)) {
    const width = Math.max(1, Math.round(source.width));
    const height = Math.max(1, Math.round(source.height));
    const expectedLength = width * height * 4;

    if (source.data.length !== expectedLength) {
      throw new Error(
        `Expected RGBA data length ${expectedLength}, received ${source.data.length}`
      );
    }

    return { width, height, data: source.data };
  }

  if (isFloatTextureSharedSource(source)) {
    const width = Math.max(1, Math.round(source.width));
    const height = Math.max(1, Math.round(source.height));
    const expectedByteLength = width * height * 4 * Float32Array.BYTES_PER_ELEMENT;

    if (source.buffer.byteLength !== expectedByteLength) {
      throw new Error(
        `Expected RGBA buffer byteLength ${expectedByteLength}, received ${source.buffer.byteLength}`
      );
    }

    return { width, height, data: new Float32Array(source.buffer) };
  }

  if (isFloatTextureWrappedSource(source) || isFloatTextureSquareSource(source)) {
    const channels = normalizeChannelSource(source.channels);
    const resolvedDataFormat = source.format ?? dataFormat ?? inferFloatTextureDataFormat(channels);
    const channelsPerRow = CHANNELS_PER_FORMAT[resolvedDataFormat];
    const groups = createChannelGroups(channels, resolvedDataFormat);

    if (isFloatTextureWrappedSource(source)) {
      const width = Math.max(1, Math.round(source.width));
      const height = groups.reduce((sum, group) => sum + Math.ceil(group.width / width), 0);
      const expectedLength = width * height * 4;
      const data = target?.length === expectedLength ? target : new Float32Array(expectedLength);
      let rowStart = 0;

      for (const { group, width: groupWidth } of groups) {
        const rowCount = Math.ceil(groupWidth / width);

        for (let row = 0; row < rowCount; row++) {
          for (let x = 0; x < width; x++) {
            const sampleIndex = row * width + x;
            const pixelIndex = (rowStart + row) * width + x;

            if (sampleIndex < groupWidth) {
              fillPixel(data, pixelIndex, group, sampleIndex, channelsPerRow, extraPixelValue);
            } else {
              fillExtraPixel(data, pixelIndex, extraPixelValue);
            }
          }
        }

        rowStart += rowCount;
      }

      return { width, height, data };
    }

    const totalPixels = groups.reduce((sum, group) => sum + group.width, 0);
    const size = Math.max(1, Math.ceil(Math.sqrt(totalPixels)));
    const expectedLength = size * size * 4;
    const data = target?.length === expectedLength ? target : new Float32Array(expectedLength);
    let pixelIndex = 0;

    for (const { group, width: groupWidth } of groups) {
      for (let sampleIndex = 0; sampleIndex < groupWidth; sampleIndex++) {
        fillPixel(data, pixelIndex, group, sampleIndex, channelsPerRow, extraPixelValue);
        pixelIndex++;
      }
    }

    while (pixelIndex < size * size) {
      fillExtraPixel(data, pixelIndex, extraPixelValue);
      pixelIndex++;
    }

    return { width: size, height: size, data };
  }

  const channels = normalizeFloatTextureSource(source);
  const resolvedDataFormat = dataFormat ?? inferFloatTextureDataFormat(source);
  const channelsPerRow = CHANNELS_PER_FORMAT[resolvedDataFormat];
  const groups = createChannelGroups(channels, resolvedDataFormat);
  const width = Math.max(...groups.map((group) => group.width));
  const height = groups.length;
  const expectedLength = width * height * 4;

  const data = target?.length === expectedLength ? target : new Float32Array(expectedLength);

  for (let row = 0; row < height; row++) {
    const { group } = groups[row];

    for (let x = 0; x < width; x++) {
      fillPixel(data, row * width + x, group, x, channelsPerRow, extraPixelValue);
    }
  }

  return { width, height, data };
}
