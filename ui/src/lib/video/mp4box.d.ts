/**
 * Type declarations for mp4box
 * @see https://github.com/nicosResearchAndDevelopment/nicomo-mp4box
 */

declare module 'mp4box' {
  export interface MP4Track {
    id: number;
    type: 'video' | 'audio' | 'metadata' | 'subtitles';
    codec: string;
    nb_samples: number;
    timescale: number;
    duration: number;
    bitrate: number;
    language: string;
    video?: {
      width: number;
      height: number;
    };
    audio?: {
      sample_rate: number;
      channel_count: number;
    };
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasIOD: boolean;
    brands: string[];
    created: Date;
    modified: Date;
    tracks: MP4Track[];
    mime: string;
  }

  export interface MP4Sample {
    number: number;
    track_id: number;
    description_index: number;
    description: unknown;
    data: Uint8Array;
    size: number;
    duration: number;
    cts: number;
    dts: number;
    is_sync: boolean;
    is_leading: number;
    depends_on: number;
    is_depended_on: number;
    has_redundancy: number;
    degradation_priority: number;
    offset: number;
    timescale: number;
  }

  export interface MP4ExtractionOptions {
    nbSamples?: number;
    rapAlignment?: boolean;
  }

  export interface MP4ArrayBuffer extends ArrayBuffer {
    fileStart: number;
  }

  export interface MP4File {
    onReady?: (info: MP4Info) => void;
    onSamples?: (trackId: number, user: unknown, samples: MP4Sample[]) => void;
    onError?: (error: Error) => void;
    onMoovStart?: () => void;

    appendBuffer(buffer: MP4ArrayBuffer): number;
    start(): void;
    stop(): void;
    flush(): void;
    seek(time: number, useRap?: boolean): { offset: number; time: number };
    releaseUsedSamples(trackId: number, sampleNumber: number): void;
    setExtractionOptions(trackId: number, user?: unknown, options?: MP4ExtractionOptions): void;
    unsetExtractionOptions(trackId: number): void;
    getInfo(): MP4Info;
    getTrackById(trackId: number): MP4Track | undefined;
  }

  export function createFile(): MP4File;

  export interface DataStream {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (buffer?: ArrayBuffer, byteOffset?: number, endian?: boolean): any;
  }

  export const DataStream: DataStream;
}
