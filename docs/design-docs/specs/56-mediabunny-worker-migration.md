# 56. MediaBunnyPlayer Worker Migration

## Goal

Move `MediaBunnyPlayer` entirely into the render worker to eliminate main thread blocking from `createImageBitmap` (~8ms per frame).

## Current Architecture

```
Main Thread                              Worker Thread
┌─────────────────────────────────┐      ┌─────────────────────────┐
│ VideoNode.svelte                │      │ renderWorker            │
│   └─ MediaBunnyPlayer           │      │   └─ fboRenderer        │
│        - decode samples         │      │        - GL textures    │
│        - createImageBitmap (8ms)│──────│        - render loop    │
│        - buffer frames          │ bitmap                         │
│        - playback timing        │      │                         │
└─────────────────────────────────┘      └─────────────────────────┘
```

## Proposed Architecture

```
Main Thread                              Worker Thread
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ VideoNode.svelte                │      │ renderWorker                    │
│   - sends commands (play/pause) │──────│   └─ fboRenderer                │
│   - receives status updates     │ cmds │        └─ MediaBunnyPlayer      │
│   - handles audio (AudioService)│      │             - decode samples    │
│                                 │◄─────│             - createImageBitmap │
└─────────────────────────────────┘status│             - buffer frames     │
                                         │             - playback timing   │
                                         │             - direct GL upload  │
                                         └─────────────────────────────────┘
```

## Benefits

1. **Zero main thread blocking** - all heavy work in worker
2. **No bitmap transfer overhead** - bitmap stays in worker, uploaded directly to texture
3. **Tighter render integration** - playback synced with render loop
4. **Simpler data flow** - main thread just sends commands

## Implementation Plan

### Phase 1: Prepare MediaBunnyPlayer for Worker

**File: `ui/src/lib/video/MediaBunnyPlayer.ts`**

Changes needed:

- [ ] Remove any DOM dependencies (verify there are none)
- [ ] Change callback pattern to be worker-friendly
- [ ] Add method to directly output to a texture upload callback

```typescript
// New interface for worker context
export interface MediaBunnyPlayerWorkerConfig {
  nodeId: string;
  onFrame: (bitmap: ImageBitmap, timestamp: number) => void;
  onMetadata: (metadata: VideoMetadata) => void;
  onEnded: () => void;
  onError: (error: Error) => void;
  onTimeUpdate?: (currentTime: number) => void; // New: periodic time updates
}
```

### Phase 2: Add MediaBunnyPlayer Management to FBORenderer

**File: `ui/src/workers/rendering/fboRenderer.ts`**

Add:

- [ ] Map to store MediaBunnyPlayer instances per node
- [ ] Methods to create/destroy players
- [ ] Methods to control playback (play, pause, seek, etc.)
- [ ] Integration with render loop for frame display

```typescript
// Add to FBORenderer class
private mediaBunnyPlayers = new Map<string, MediaBunnyPlayer>();

createMediaBunnyPlayer(nodeId: string): void {
  const player = new MediaBunnyPlayer({
    nodeId,
    onFrame: (bitmap, timestamp) => {
      // Direct upload to texture - no transfer needed!
      this.setBitmap(nodeId, bitmap);
    },
    onMetadata: (metadata) => {
      self.postMessage({ type: 'mediaBunnyMetadata', nodeId, metadata });
    },
    onEnded: () => {
      self.postMessage({ type: 'mediaBunnyEnded', nodeId });
    },
    onError: (error) => {
      self.postMessage({ type: 'mediaBunnyError', nodeId, error: error.message });
    },
    onTimeUpdate: (currentTime) => {
      self.postMessage({ type: 'mediaBunnyTimeUpdate', nodeId, currentTime });
    }
  });
  this.mediaBunnyPlayers.set(nodeId, player);
}

async loadMediaBunnyFile(nodeId: string, file: File): Promise<void> {
  const player = this.mediaBunnyPlayers.get(nodeId);
  if (player) await player.loadFile(file);
}

// Similar methods for: play, pause, seek, setLoop, setPlaybackRate, destroy
```

### Phase 3: Add Message Handlers to RenderWorker

**File: `ui/src/workers/rendering/renderWorker.ts`**

Add message handlers:

- [ ] `createMediaBunnyPlayer` - create player for node
- [ ] `loadMediaBunnyFile` - load file (File transferred via postMessage)
- [ ] `loadMediaBunnyUrl` - load from URL
- [ ] `mediaBunnyPlay` - start playback
- [ ] `mediaBunnyPause` - pause playback
- [ ] `mediaBunnySeek` - seek to time
- [ ] `mediaBunnySetLoop` - set loop mode
- [ ] `mediaBunnySetPlaybackRate` - set playback rate
- [ ] `destroyMediaBunnyPlayer` - cleanup

```typescript
// Add to self.onmessage handler
.with('createMediaBunnyPlayer', () => fboRenderer.createMediaBunnyPlayer(data.nodeId))
.with('loadMediaBunnyFile', () => fboRenderer.loadMediaBunnyFile(data.nodeId, data.file))
.with('loadMediaBunnyUrl', () => fboRenderer.loadMediaBunnyUrl(data.nodeId, data.url))
.with('mediaBunnyPlay', () => fboRenderer.mediaBunnyPlay(data.nodeId))
.with('mediaBunnyPause', () => fboRenderer.mediaBunnyPause(data.nodeId))
.with('mediaBunnySeek', () => fboRenderer.mediaBunnySeek(data.nodeId, data.time))
.with('mediaBunnySetLoop', () => fboRenderer.mediaBunnySetLoop(data.nodeId, data.loop))
.with('mediaBunnySetPlaybackRate', () => fboRenderer.mediaBunnySetPlaybackRate(data.nodeId, data.rate))
.with('destroyMediaBunnyPlayer', () => fboRenderer.destroyMediaBunnyPlayer(data.nodeId))
```

### Phase 4: Add GLSystem Wrapper Methods

**File: `ui/src/lib/canvas/GLSystem.ts`**

Add wrapper methods:

- [ ] `createMediaBunnyPlayer(nodeId)`
- [ ] `loadMediaBunnyFile(nodeId, file)` - transfers File to worker
- [ ] `loadMediaBunnyUrl(nodeId, url)`
- [ ] `mediaBunnyPlay(nodeId)`
- [ ] `mediaBunnyPause(nodeId)`
- [ ] `mediaBunnySeek(nodeId, time)`
- [ ] `mediaBunnySetLoop(nodeId, loop)`
- [ ] `mediaBunnySetPlaybackRate(nodeId, rate)`
- [ ] `destroyMediaBunnyPlayer(nodeId)`

Add message handlers for worker responses:

- [ ] `mediaBunnyMetadata` - receive metadata
- [ ] `mediaBunnyEnded` - playback ended
- [ ] `mediaBunnyError` - error occurred
- [ ] `mediaBunnyTimeUpdate` - current time update

```typescript
// GLSystem methods
createMediaBunnyPlayer(nodeId: string) {
  this.send('createMediaBunnyPlayer', { nodeId });
}

loadMediaBunnyFile(nodeId: string, file: File) {
  // File can be sent via postMessage (cloned, but blob data is shared)
  this.renderWorker.postMessage({ type: 'loadMediaBunnyFile', nodeId, file });
}

mediaBunnyPlay(nodeId: string) {
  this.send('mediaBunnyPlay', { nodeId });
}
// ... etc
```

### Phase 5: Update VideoNode.svelte

**File: `ui/src/lib/components/nodes/VideoNode.svelte`**

Changes:

- [ ] Remove local MediaBunnyPlayer instantiation
- [ ] Use GLSystem methods instead
- [ ] Listen for worker messages via event bus or callback registration
- [ ] Keep AudioService integration (audio stays on main thread)

```typescript
// Before (main thread MediaBunnyPlayer)
mediaBunnyPlayer = new MediaBunnyPlayer({
  nodeId,
  onFrame: (bitmap, timestamp) => { ... },
  onMetadata: (metadata) => { ... },
  ...
});
await mediaBunnyPlayer.loadFile(file);

// After (worker MediaBunnyPlayer)
glSystem.createMediaBunnyPlayer(nodeId);
glSystem.loadMediaBunnyFile(nodeId, file);

// Listen for events
glSystem.eventBus.addEventListener('mediaBunnyMetadata', (e) => {
  if (e.nodeId === nodeId) {
    // Handle metadata
  }
});
```

### Phase 6: Handle Preview Canvas (Optional)

The current code draws to a preview canvas on main thread:

```typescript
if (previewCanvas && previewCtx && useCanvasPreview) {
  previewCtx.drawImage(bitmap, 0, 0, ...);
}
```

Options:

1. **Remove canvas preview for MediaBunny** - use GL preview only
2. **Transfer bitmap back for preview** - adds overhead but keeps feature
3. **Use OffscreenCanvas in worker** - complex but possible

Recommendation: Start with option 1 (GL preview only), add canvas preview later if needed.

## Message Types Summary

### Main → Worker

| Message                     | Data                     | Description            |
| --------------------------- | ------------------------ | ---------------------- |
| `createMediaBunnyPlayer`    | `{ nodeId }`             | Create player instance |
| `loadMediaBunnyFile`        | `{ nodeId, file: File }` | Load video file        |
| `loadMediaBunnyUrl`         | `{ nodeId, url }`        | Load video from URL    |
| `mediaBunnyPlay`            | `{ nodeId }`             | Start playback         |
| `mediaBunnyPause`           | `{ nodeId }`             | Pause playback         |
| `mediaBunnySeek`            | `{ nodeId, time }`       | Seek to time           |
| `mediaBunnySetLoop`         | `{ nodeId, loop }`       | Set loop mode          |
| `mediaBunnySetPlaybackRate` | `{ nodeId, rate }`       | Set playback rate      |
| `destroyMediaBunnyPlayer`   | `{ nodeId }`             | Destroy player         |

### Worker → Main

| Message                | Data                      | Description                                     |
| ---------------------- | ------------------------- | ----------------------------------------------- |
| `mediaBunnyMetadata`   | `{ nodeId, metadata }`    | Video metadata loaded                           |
| `mediaBunnyEnded`      | `{ nodeId }`              | Playback ended                                  |
| `mediaBunnyError`      | `{ nodeId, error }`       | Error occurred                                  |
| `mediaBunnyTimeUpdate` | `{ nodeId, currentTime }` | Periodic time update                            |
| `mediaBunnyFirstFrame` | `{ nodeId }`              | First frame received (for timeout cancellation) |

## Audio Sync Considerations

Current behavior: Audio and video are independently timed using wall clock.

Future improvements (not in this migration):

1. Worker sends `mediaBunnyTimeUpdate` periodically
2. Main thread can compare with audio time
3. If drift detected, adjust playback rate or seek

## Testing Checklist

- [ ] Basic playback works (play/pause)
- [ ] Seeking works
- [ ] Loop mode works
- [ ] Playback rate changes work
- [ ] Metadata is received correctly
- [ ] Error handling works (unsupported codec, etc.)
- [ ] Multiple VideoNodes work simultaneously
- [ ] Node deletion cleans up properly
- [ ] Profile confirms no main thread blocking
- [ ] Video renders correctly to GL texture
- [ ] Preview frames work (GL-based)

## Rollback Plan

Keep the old main-thread MediaBunnyPlayer code behind a feature flag:

```typescript
const USE_WORKER_MEDIABUNNY = true; // Toggle for testing
```

This allows quick rollback if issues are discovered.
