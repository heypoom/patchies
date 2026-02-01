/**
 * Video Decoder Worker
 *
 * Decodes video files using WebCodecs VideoDecoder and MP4Box.js demuxer.
 * Supports streaming from File/Blob for efficient large file handling (5GB+).
 *
 * Features:
 * - Container demuxing (MP4, WebM) via MP4Box.js
 * - Hardware-accelerated decoding via VideoDecoder
 * - Keyframe-aware seeking
 * - Playback timing control
 * - Audio track metadata extraction (audio decoded separately via soundfile~)
 */

import { match } from 'ts-pattern';

// ============================================================================
// Message Types
// ============================================================================

export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  frameRate: number;
  codec: string;
  hasAudio: boolean;
}

export type VideoDecoderWorkerMessage =
  | {
      type: 'loadFile';
      nodeId: string;
      file: File;
    }
  | {
      type: 'loadBlob';
      nodeId: string;
      blob: Blob;
    }
  | {
      type: 'seek';
      nodeId: string;
      timeSeconds: number;
    }
  | {
      type: 'play';
      nodeId: string;
    }
  | {
      type: 'pause';
      nodeId: string;
    }
  | {
      type: 'setPlaybackRate';
      nodeId: string;
      rate: number;
    }
  | {
      type: 'setLoop';
      nodeId: string;
      loop: boolean;
    }
  | {
      type: 'requestFrame';
      nodeId: string;
    }
  | {
      type: 'destroy';
      nodeId: string;
    };

export type VideoDecoderWorkerResponse =
  | {
      type: 'frameReady';
      nodeId: string;
      bitmap: ImageBitmap;
      timestamp: number; // microseconds
      currentTime: number; // seconds
    }
  | {
      type: 'metadata';
      nodeId: string;
      metadata: VideoMetadata;
    }
  | {
      type: 'seeked';
      nodeId: string;
      currentTime: number;
    }
  | {
      type: 'ended';
      nodeId: string;
    }
  | {
      type: 'error';
      nodeId: string;
      message: string;
    }
  | {
      type: 'destroyed';
      nodeId: string;
    };

// ============================================================================
// Video Decoder Instance State
// ============================================================================

interface KeyframeEntry {
  timestamp: number; // microseconds
  byteOffset: number;
  sampleIndex: number;
}

interface DecoderState {
  // File/Blob source
  source: File | Blob | null;

  // Demuxer state (MP4Box)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mp4boxFile: any; // MP4Box.ISOFile type

  // Decoder
  decoder: VideoDecoder | null;
  decoderConfig: VideoDecoderConfig | null;

  // Metadata
  metadata: VideoMetadata | null;

  // Keyframe index for seeking
  keyframes: KeyframeEntry[];

  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number; // seconds
  playbackRate: number;
  loop: boolean;

  // Frame timing
  lastFrameTime: number;
  pendingFrames: VideoFrame[];

  // Cleanup
  animationFrameId: number | null;
}

const decoderStates = new Map<string, DecoderState>();

// ============================================================================
// Helper Functions
// ============================================================================

function createInitialState(): DecoderState {
  return {
    source: null,
    mp4boxFile: null,
    decoder: null,
    decoderConfig: null,
    metadata: null,
    keyframes: [],
    isPlaying: false,
    isPaused: true,
    currentTime: 0,
    playbackRate: 1,
    loop: true,
    lastFrameTime: 0,
    pendingFrames: [],
    animationFrameId: null
  };
}

function sendResponse(response: VideoDecoderWorkerResponse, transfer?: Transferable[]): void {
  if (transfer && transfer.length > 0) {
    self.postMessage(response, { transfer });
  } else {
    self.postMessage(response);
  }
}

function sendError(nodeId: string, message: string): void {
  sendResponse({ type: 'error', nodeId, message });
}

// ============================================================================
// MP4Box Demuxing
// ============================================================================

async function loadFile(nodeId: string, file: File): Promise<void> {
  try {
    let state = decoderStates.get(nodeId);
    if (!state) {
      state = createInitialState();
      decoderStates.set(nodeId, state);
    }

    // Clean up previous state
    if (state.decoder) {
      state.decoder.close();
      state.decoder = null;
    }
    state.pendingFrames.forEach((f) => f.close());
    state.pendingFrames = [];

    state.source = file;

    // Dynamic import of MP4Box (will be added as dependency)
    const MP4Box = await import('mp4box');
    state.mp4boxFile = MP4Box.createFile();

    // Set up MP4Box callbacks
    state.mp4boxFile.onReady = (info: MP4BoxInfo) => {
      handleMP4BoxReady(nodeId, info);
    };

    state.mp4boxFile.onSamples = (trackId: number, _ref: unknown, samples: MP4BoxSample[]) => {
      handleMP4BoxSamples(nodeId, trackId, samples);
    };

    state.mp4boxFile.onError = (error: Error) => {
      sendError(nodeId, `MP4Box error: ${error.message}`);
    };

    // Read file in chunks for streaming support
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await chunk.arrayBuffer();

      // MP4Box requires fileStart property on the buffer
      (buffer as ArrayBufferWithFileStart).fileStart = offset;
      state.mp4boxFile.appendBuffer(buffer);

      offset += CHUNK_SIZE;
    }

    state.mp4boxFile.flush();
  } catch (error) {
    sendError(nodeId, error instanceof Error ? error.message : 'Failed to load file');
  }
}

// MP4Box type helpers
interface ArrayBufferWithFileStart extends ArrayBuffer {
  fileStart: number;
}

interface MP4BoxInfo {
  duration: number;
  timescale: number;
  tracks: MP4BoxTrack[];
}

interface MP4BoxTrack {
  id: number;
  type: string;
  codec: string;
  video?: {
    width: number;
    height: number;
  };
  audio?: {
    sample_rate: number;
    channel_count: number;
  };
  nb_samples: number;
  timescale: number;
  duration: number;
}

interface MP4BoxSample {
  is_sync: boolean;
  cts: number; // composition timestamp
  dts: number; // decode timestamp
  duration: number;
  timescale: number;
  data: Uint8Array;
  size: number;
  offset: number;
}

function handleMP4BoxReady(nodeId: string, info: MP4BoxInfo): void {
  const state = decoderStates.get(nodeId);
  if (!state) return;

  // Find video track
  const videoTrack = info.tracks.find((t) => t.type === 'video');
  if (!videoTrack) {
    sendError(nodeId, 'No video track found in file');
    return;
  }

  // Check for audio track
  const audioTrack = info.tracks.find((t) => t.type === 'audio');

  // Calculate frame rate
  const durationSeconds = videoTrack.duration / videoTrack.timescale;
  const frameRate = videoTrack.nb_samples / durationSeconds;

  // Store metadata
  state.metadata = {
    duration: info.duration / info.timescale,
    width: videoTrack.video?.width ?? 0,
    height: videoTrack.video?.height ?? 0,
    frameRate,
    codec: videoTrack.codec,
    hasAudio: !!audioTrack
  };

  // Configure video decoder
  state.decoderConfig = {
    codec: videoTrack.codec,
    codedWidth: videoTrack.video?.width ?? 0,
    codedHeight: videoTrack.video?.height ?? 0,
    hardwareAcceleration: 'prefer-hardware'
  };

  // Create decoder
  state.decoder = new VideoDecoder({
    output: (frame: VideoFrame) => handleDecodedFrame(nodeId, frame),
    error: (error: Error) => sendError(nodeId, `Decoder error: ${error.message}`)
  });

  state.decoder.configure(state.decoderConfig);

  // Start extracting samples from video track
  state.mp4boxFile.setExtractionOptions(videoTrack.id, null, {
    nbSamples: Infinity
  });
  state.mp4boxFile.start();

  // Send metadata to main thread
  sendResponse({
    type: 'metadata',
    nodeId,
    metadata: state.metadata
  });
}

function handleMP4BoxSamples(nodeId: string, _trackId: number, samples: MP4BoxSample[]): void {
  const state = decoderStates.get(nodeId);
  if (!state || !state.decoder) return;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];

    // Build keyframe index
    if (sample.is_sync) {
      state.keyframes.push({
        timestamp: (sample.cts / sample.timescale) * 1_000_000, // to microseconds
        byteOffset: sample.offset,
        sampleIndex: state.keyframes.length
      });
    }

    // Create encoded video chunk
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts / sample.timescale) * 1_000_000, // to microseconds
      duration: (sample.duration / sample.timescale) * 1_000_000,
      data: sample.data
    });

    // Feed to decoder
    state.decoder.decode(chunk);
  }
}

function handleDecodedFrame(nodeId: string, frame: VideoFrame): void {
  const state = decoderStates.get(nodeId);
  if (!state) {
    frame.close();
    return;
  }

  // If not playing, just store the first frame for preview
  if (!state.isPlaying || state.isPaused) {
    // Close any existing pending frames except the last one
    while (state.pendingFrames.length > 0) {
      const oldFrame = state.pendingFrames.shift();
      oldFrame?.close();
    }
    state.pendingFrames.push(frame);

    // Send the frame as preview
    sendFrameToMain(nodeId, frame);
    return;
  }

  // During playback, queue frames
  state.pendingFrames.push(frame);

  // Process frame queue in playback loop
  processFrameQueue(nodeId);
}

async function sendFrameToMain(nodeId: string, frame: VideoFrame): Promise<void> {
  const state = decoderStates.get(nodeId);
  if (!state) return;

  try {
    // Create ImageBitmap with flipY for GPU texture
    const bitmap = await createImageBitmap(frame, {
      imageOrientation: 'flipY'
    });

    const currentTime = (frame.timestamp ?? 0) / 1_000_000; // to seconds

    sendResponse(
      {
        type: 'frameReady',
        nodeId,
        bitmap,
        timestamp: frame.timestamp ?? 0,
        currentTime
      },
      [bitmap]
    );

    state.currentTime = currentTime;
  } catch (error) {
    sendError(nodeId, `Failed to create bitmap: ${error}`);
  }
}

function processFrameQueue(nodeId: string): void {
  const state = decoderStates.get(nodeId);
  if (!state || !state.isPlaying || state.isPaused) return;

  const now = performance.now();
  const elapsed = now - state.lastFrameTime;
  const frameInterval = 1000 / ((state.metadata?.frameRate ?? 30) * state.playbackRate);

  if (elapsed >= frameInterval && state.pendingFrames.length > 0) {
    const frame = state.pendingFrames.shift();
    if (frame) {
      sendFrameToMain(nodeId, frame);
      frame.close();
    }
    state.lastFrameTime = now;
  }

  // Continue playback loop
  if (state.isPlaying && !state.isPaused) {
    state.animationFrameId = requestAnimationFrame(() => processFrameQueue(nodeId));
  }
}

// ============================================================================
// Playback Control
// ============================================================================

function play(nodeId: string): void {
  const state = decoderStates.get(nodeId);
  if (!state) return;

  state.isPlaying = true;
  state.isPaused = false;
  state.lastFrameTime = performance.now();

  processFrameQueue(nodeId);
}

function pause(nodeId: string): void {
  const state = decoderStates.get(nodeId);
  if (!state) return;

  state.isPaused = true;

  if (state.animationFrameId !== null) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
}

function seek(nodeId: string, timeSeconds: number): void {
  const state = decoderStates.get(nodeId);
  if (!state || !state.decoder) return;

  // Find nearest keyframe before the target time
  const targetTimeMicros = timeSeconds * 1_000_000;
  let nearestKeyframe: KeyframeEntry | null = null;

  for (const kf of state.keyframes) {
    if (kf.timestamp <= targetTimeMicros) {
      nearestKeyframe = kf;
    } else {
      break;
    }
  }

  if (!nearestKeyframe) {
    nearestKeyframe = state.keyframes[0];
  }

  // Clear pending frames
  state.pendingFrames.forEach((f) => f.close());
  state.pendingFrames = [];

  // Reset decoder
  state.decoder.reset();
  state.decoder.configure(state.decoderConfig!);

  state.currentTime = timeSeconds;

  sendResponse({
    type: 'seeked',
    nodeId,
    currentTime: timeSeconds
  });

  // TODO: Re-decode from keyframe to target time
  // This requires re-reading samples from the file starting at nearestKeyframe
}

function setPlaybackRate(nodeId: string, rate: number): void {
  const state = decoderStates.get(nodeId);
  if (!state) return;

  state.playbackRate = Math.max(0.25, Math.min(4, rate));
}

function setLoop(nodeId: string, loop: boolean): void {
  const state = decoderStates.get(nodeId);
  if (!state) return;

  state.loop = loop;
}

function destroy(nodeId: string): void {
  const state = decoderStates.get(nodeId);
  if (!state) return;

  // Cancel animation frame
  if (state.animationFrameId !== null) {
    cancelAnimationFrame(state.animationFrameId);
  }

  // Close decoder
  if (state.decoder) {
    state.decoder.close();
  }

  // Close pending frames
  state.pendingFrames.forEach((f) => f.close());

  // Remove state
  decoderStates.delete(nodeId);

  sendResponse({ type: 'destroyed', nodeId });
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = (event: MessageEvent<VideoDecoderWorkerMessage>) => {
  const message = event.data;

  match(message)
    .with({ type: 'loadFile' }, ({ nodeId, file }) => {
      loadFile(nodeId, file);
    })
    .with({ type: 'loadBlob' }, ({ nodeId, blob }) => {
      loadFile(nodeId, blob as File);
    })
    .with({ type: 'seek' }, ({ nodeId, timeSeconds }) => {
      seek(nodeId, timeSeconds);
    })
    .with({ type: 'play' }, ({ nodeId }) => {
      play(nodeId);
    })
    .with({ type: 'pause' }, ({ nodeId }) => {
      pause(nodeId);
    })
    .with({ type: 'setPlaybackRate' }, ({ nodeId, rate }) => {
      setPlaybackRate(nodeId, rate);
    })
    .with({ type: 'setLoop' }, ({ nodeId, loop }) => {
      setLoop(nodeId, loop);
    })
    .with({ type: 'requestFrame' }, ({ nodeId }) => {
      const state = decoderStates.get(nodeId);
      if (state && state.pendingFrames.length > 0) {
        const frame = state.pendingFrames[0];
        sendFrameToMain(nodeId, frame);
      }
    })
    .with({ type: 'destroy' }, ({ nodeId }) => {
      destroy(nodeId);
    })
    .exhaustive();
};
