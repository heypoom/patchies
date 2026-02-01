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

export interface WorkerQueueStats {
  pendingSamples: number; // Encoded samples waiting to be decoded
  decodeQueueSize: number; // Chunks in VideoDecoder queue
  pendingFrames: number; // Decoded frames waiting to be sent
  extractionPaused: boolean; // Whether MP4Box is paused due to backpressure
  totalSamplesExtracted: number; // Total samples demuxed from file
  peakSamples: number; // High water mark for pendingSamples
  peakFrames: number; // High water mark for pendingFrames
}

export type VideoDecoderWorkerResponse =
  | {
      type: 'frameReady';
      nodeId: string;
      bitmap: ImageBitmap;
      timestamp: number; // microseconds
      currentTime: number; // seconds
      queueStats: WorkerQueueStats; // Queue depths for diagnostics
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

  // Sample queue for backpressure (store metadata only - data fetched lazily)
  pendingSamples: SampleMetadata[];
  sampleProcessingId: number | null;
  extractionPaused: boolean; // Whether MP4Box extraction is paused due to backpressure
  videoTrackId: number | null; // Track ID for resuming extraction
  allSamplesExtracted: boolean; // True when MP4Box has given us all sample metadata

  // Stats tracking
  totalSamplesExtracted: number; // Total samples demuxed from file
  peakSamples: number; // High water mark for pendingSamples
  peakFrames: number; // High water mark for pendingFrames

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

// Store MP4Box module reference for use in callbacks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MP4BoxModule: any = null;

// ============================================================================
// Helper Functions
// ============================================================================

// Backpressure constants
const MAX_DECODE_QUEUE_SIZE = 10; // Max chunks waiting in VideoDecoder
const MAX_PENDING_FRAMES = 30; // Max decoded frames waiting to be sent
const SAMPLE_BATCH_SIZE = 5; // How many samples to process per tick
const MAX_PENDING_SAMPLES = 300; // Max encoded samples (~5 seconds at 60fps) - prevents OOM
const SAMPLE_RESUME_THRESHOLD = 100; // Resume extraction when samples drop below this

function createInitialState(): DecoderState {
  return {
    source: null,
    mp4boxFile: null,
    decoder: null,
    decoderConfig: null,
    metadata: null,
    keyframes: [],
    pendingSamples: [],
    sampleProcessingId: null,
    extractionPaused: false,
    videoTrackId: null,
    allSamplesExtracted: false,
    totalSamplesExtracted: 0,
    peakSamples: 0,
    peakFrames: 0,
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
    if (state.sampleProcessingId !== null) {
      clearTimeout(state.sampleProcessingId);
      state.sampleProcessingId = null;
    }
    if (state.decoder) {
      state.decoder.close();
      state.decoder = null;
    }
    state.pendingSamples = [];
    state.pendingFrames.forEach((f) => f.close());
    state.pendingFrames = [];
    state.keyframes = [];
    state.extractionPaused = false;
    state.videoTrackId = null;

    state.source = file;

    // Dynamic import of MP4Box (will be added as dependency)
    MP4BoxModule = await import('mp4box');
    state.mp4boxFile = MP4BoxModule.createFile();

    let extractionSetUp = false;

    // Set up MP4Box callbacks
    state.mp4boxFile.onReady = (info: MP4BoxInfo) => {
      handleMP4BoxReady(nodeId, info);
      extractionSetUp = true;
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

    // First pass: load enough to get metadata (moov box triggers onReady)
    while (offset < file.size && !extractionSetUp) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await chunk.arrayBuffer();

      // MP4Box requires fileStart property on the buffer
      (buffer as ArrayBufferWithFileStart).fileStart = offset;
      state.mp4boxFile.appendBuffer(buffer);

      offset += CHUNK_SIZE;
    }

    // Now extraction is set up. Seek to beginning to re-process with extraction enabled.
    const seekResult = state.mp4boxFile.seek(0, true);

    // Re-read entire file from the seek offset (usually 0) with extraction now enabled
    const rereadOffset = seekResult?.offset ?? 0;
    offset = rereadOffset;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await chunk.arrayBuffer();

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

/**
 * Lightweight sample metadata for lazy loading.
 * Stores timing and location info without the actual bytes.
 */
interface SampleMetadata {
  is_sync: boolean;
  cts: number;
  dts: number;
  duration: number;
  timescale: number;
  size: number;
  offset: number; // Byte offset in file - used to fetch data on-demand
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

  // Get codec description (avcC/hvcC box) from the track
  // This is required for H.264/H.265 decoding
  let description: Uint8Array | undefined;
  try {
    const trak = state.mp4boxFile.getTrackById(videoTrack.id);
    if (trak) {
      const entry = trak.mdia?.minf?.stbl?.stsd?.entries?.[0];
      // Look for avcC (H.264) or hvcC (H.265) or vpcC (VP9) box
      const codecBox = entry?.avcC || entry?.hvcC || entry?.vpcC;
      if (codecBox && MP4BoxModule) {
        // Use MP4Box's DataStream to serialize the codec config box
        const stream = new MP4BoxModule.DataStream(
          undefined,
          0,
          MP4BoxModule.DataStream.BIG_ENDIAN
        );
        codecBox.write(stream);
        // Skip the box header (8 bytes: 4 for size + 4 for type)
        description = new Uint8Array(stream.buffer, 8);
      }
    }
  } catch {
    // Could not extract codec description - some codecs may not need it
  }

  // Configure video decoder
  state.decoderConfig = {
    codec: videoTrack.codec,
    codedWidth: videoTrack.video?.width ?? 0,
    codedHeight: videoTrack.video?.height ?? 0,
    hardwareAcceleration: 'prefer-hardware',
    description
  };

  // Create decoder
  state.decoder = new VideoDecoder({
    output: (frame: VideoFrame) => handleDecodedFrame(nodeId, frame),
    error: (error: Error) => sendError(nodeId, `Decoder error: ${error.message}`)
  });

  state.decoder.configure(state.decoderConfig);

  // Store track ID for pausing/resuming extraction
  state.videoTrackId = videoTrack.id;
  state.extractionPaused = false;

  // Start extracting samples from video track
  state.mp4boxFile.setExtractionOptions(videoTrack.id, null, {
    nbSamples: Infinity
  });
  state.mp4boxFile.start();

  // Flush to trigger sample extraction (all data was already appended)
  state.mp4boxFile.flush();

  // Send metadata to main thread
  sendResponse({
    type: 'metadata',
    nodeId,
    metadata: state.metadata
  });
}

function handleMP4BoxSamples(nodeId: string, _trackId: number, samples: MP4BoxSample[]): void {
  const state = decoderStates.get(nodeId);
  if (!state) return;

  // Queue sample METADATA for processing (not the actual bytes - saves RAM)
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

    // Store only metadata - NOT the data bytes (this is the key to streaming)
    const metadata: SampleMetadata = {
      is_sync: sample.is_sync,
      cts: sample.cts,
      dts: sample.dts,
      duration: sample.duration,
      timescale: sample.timescale,
      size: sample.size,
      offset: sample.offset
    };
    state.pendingSamples.push(metadata);
    state.totalSamplesExtracted++;
  }

  // Release sample data from MP4Box's internal buffers to free memory
  if (state.mp4boxFile && state.videoTrackId !== null) {
    state.mp4boxFile.releaseUsedSamples(state.videoTrackId, samples.length);
  }

  // Track peak samples for diagnostics
  if (state.pendingSamples.length > state.peakSamples) {
    state.peakSamples = state.pendingSamples.length;
  }

  // Pause MP4Box extraction if sample queue is getting too large (prevents OOM)
  if (state.pendingSamples.length >= MAX_PENDING_SAMPLES && !state.extractionPaused) {
    state.mp4boxFile?.stop();
    state.extractionPaused = true;
  }

  // Start processing samples if not already running
  if (state.sampleProcessingId === null) {
    processSampleQueue(nodeId);
  }
}

/**
 * Process queued samples with backpressure.
 * Fetches sample data lazily from File to avoid loading entire video into RAM.
 */
async function processSampleQueue(nodeId: string): Promise<void> {
  const state = decoderStates.get(nodeId);
  if (!state || !state.decoder || !state.source) return;

  // When paused, only decode enough for preview (first frame)
  // Don't keep decoding - it wastes memory
  if (state.isPaused && state.pendingFrames.length > 0) {
    // Already have preview frame, stop processing until playback resumes
    state.sampleProcessingId = null;
    return;
  }

  // Check backpressure conditions
  const decoderQueueFull = state.decoder.decodeQueueSize >= MAX_DECODE_QUEUE_SIZE;
  const frameQueueFull = state.pendingFrames.length >= MAX_PENDING_FRAMES;

  if (decoderQueueFull || frameQueueFull) {
    // Wait and retry - decoder is busy
    state.sampleProcessingId = self.setTimeout(() => {
      state.sampleProcessingId = null;
      processSampleQueue(nodeId);
    }, 16) as unknown as number; // ~60fps check rate
    return;
  }

  // Process a batch of samples - fetch data lazily from File
  const samplesToProcess = Math.min(SAMPLE_BATCH_SIZE, state.pendingSamples.length);

  for (let i = 0; i < samplesToProcess; i++) {
    const sample = state.pendingSamples.shift();
    if (!sample) break;

    try {
      // LAZY LOADING: Fetch sample bytes on-demand from File (not pre-loaded)
      const sampleBlob = state.source.slice(sample.offset, sample.offset + sample.size);
      const sampleData = await sampleBlob.arrayBuffer();

      // Create encoded video chunk
      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: (sample.cts / sample.timescale) * 1_000_000, // to microseconds
        duration: (sample.duration / sample.timescale) * 1_000_000,
        data: sampleData
      });

      // Feed to decoder
      state.decoder.decode(chunk);
    } catch (error) {
      sendError(nodeId, `Decode error: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Resume MP4Box extraction if sample queue has drained below threshold
  if (state.extractionPaused && state.pendingSamples.length < SAMPLE_RESUME_THRESHOLD) {
    state.mp4boxFile?.start();
    state.extractionPaused = false;
  }

  // Continue processing if there are more samples
  if (state.pendingSamples.length > 0) {
    state.sampleProcessingId = self.setTimeout(() => {
      state.sampleProcessingId = null;
      processSampleQueue(nodeId);
    }, 0) as unknown as number; // Process next batch immediately if queue has room
  } else {
    state.sampleProcessingId = null;
  }
}

function handleDecodedFrame(nodeId: string, frame: VideoFrame): void {
  const state = decoderStates.get(nodeId);
  if (!state) {
    frame.close();
    return;
  }

  // If paused, only keep first frame as preview - close all others immediately
  if (!state.isPlaying || state.isPaused) {
    if (state.pendingFrames.length === 0) {
      // Keep first frame as preview
      state.pendingFrames.push(frame);
      sendFrameToMain(nodeId, frame);
    } else {
      // Already have preview, close this frame immediately to prevent memory leak
      frame.close();
    }
    return;
  }

  // During playback, enforce hard cap on pending frames to prevent memory explosion
  if (state.pendingFrames.length >= MAX_PENDING_FRAMES) {
    // Drop oldest frames to make room (close them to free memory)
    const frameToDrop = state.pendingFrames.shift();
    frameToDrop?.close();
  }

  state.pendingFrames.push(frame);

  // Track peak frames for diagnostics
  if (state.pendingFrames.length > state.peakFrames) {
    state.peakFrames = state.pendingFrames.length;
  }

  // During playback, process frame queue
  processFrameQueue(nodeId);
}

async function sendFrameToMain(
  nodeId: string,
  frame: VideoFrame,
  closeAfter = false
): Promise<void> {
  const state = decoderStates.get(nodeId);
  if (!state) {
    if (closeAfter) frame.close();
    return;
  }

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
        currentTime,
        queueStats: {
          pendingSamples: state.pendingSamples.length,
          decodeQueueSize: state.decoder?.decodeQueueSize ?? 0,
          pendingFrames: state.pendingFrames.length,
          extractionPaused: state.extractionPaused,
          totalSamplesExtracted: state.totalSamplesExtracted,
          peakSamples: state.peakSamples,
          peakFrames: state.peakFrames
        }
      },
      [bitmap]
    );

    state.currentTime = currentTime;
  } catch (error) {
    sendError(nodeId, `Failed to create bitmap: ${error}`);
  } finally {
    // Close the frame after bitmap is created
    if (closeAfter) {
      frame.close();
    }
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
      // Pass closeAfter=true so frame is closed after bitmap is created
      sendFrameToMain(nodeId, frame, true);
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

  // Resume sample processing (was paused to save memory)
  if (state.pendingSamples.length > 0 && state.sampleProcessingId === null) {
    processSampleQueue(nodeId);
  }

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

  // Cancel sample processing
  if (state.sampleProcessingId !== null) {
    clearTimeout(state.sampleProcessingId);
    state.sampleProcessingId = null;
  }

  // Clear pending samples and frames
  state.pendingSamples = [];
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

  // Cancel sample processing
  if (state.sampleProcessingId !== null) {
    clearTimeout(state.sampleProcessingId);
  }

  // Close decoder
  if (state.decoder) {
    state.decoder.close();
  }

  // Close pending frames
  state.pendingFrames.forEach((f) => f.close());

  // Clear pending samples
  state.pendingSamples = [];

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
