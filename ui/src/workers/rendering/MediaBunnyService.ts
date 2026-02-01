/**
 * MediaBunnyService - Manages MediaBunnyPlayer instances in the render worker.
 *
 * This service handles all video playback via MediaBunny, running entirely
 * in the render worker thread to avoid blocking the main thread.
 */

import { match } from 'ts-pattern';

import { MediaBunnyPlayer, type VideoMetadata } from '../../lib/video/MediaBunnyPlayer.js';

export interface MediaBunnyServiceConfig {
  /** Callback to upload bitmap to GL texture */
  setBitmap: (nodeId: string, bitmap: ImageBitmap) => void;

  /** Callback to post messages back to main thread */
  postMessage: (message: unknown) => void;
}

export class MediaBunnyService {
  private players = new Map<string, MediaBunnyPlayer>();
  private setBitmap: (nodeId: string, bitmap: ImageBitmap) => void;
  private postMessage: (message: unknown) => void;

  constructor(config: MediaBunnyServiceConfig) {
    this.setBitmap = config.setBitmap;
    this.postMessage = config.postMessage;
  }

  /**
   * Handle a message from the main thread.
   * Returns true if the message was handled, false otherwise.
   */

  handleMessage(type: string, data: Record<string, unknown>): boolean {
    return match(type)
      .with('createMediaBunnyPlayer', () => {
        this.createPlayer(data.nodeId as string);

        return true;
      })
      .with('loadMediaBunnyFile', () => {
        this.loadFile(data.nodeId as string, data.file as File);

        return true;
      })
      .with('loadMediaBunnyUrl', () => {
        this.loadUrl(data.nodeId as string, data.url as string);

        return true;
      })
      .with('mediaBunnyPlay', () => {
        this.play(data.nodeId as string);

        return true;
      })
      .with('mediaBunnyPause', () => {
        this.pause(data.nodeId as string);

        return true;
      })
      .with('mediaBunnySeek', () => {
        this.seek(data.nodeId as string, data.time as number);

        return true;
      })
      .with('mediaBunnySetLoop', () => {
        this.setLoop(data.nodeId as string, data.loop as boolean);

        return true;
      })
      .with('mediaBunnySetPlaybackRate', () => {
        this.setPlaybackRate(data.nodeId as string, data.rate as number);

        return true;
      })
      .with('destroyMediaBunnyPlayer', () => {
        this.destroyPlayer(data.nodeId as string);

        return true;
      })
      .otherwise(() => false);
  }

  private createPlayer(nodeId: string): void {
    // Destroy existing player if any
    this.destroyPlayer(nodeId);

    const player = new MediaBunnyPlayer({
      nodeId,
      onFrame: (bitmap) => {
        // Direct upload to texture - no transfer needed!
        this.setBitmap(nodeId, bitmap);
      },
      onMetadata: (metadata: VideoMetadata) => {
        this.postMessage({ type: 'mediaBunnyMetadata', nodeId, metadata });
      },
      onEnded: () => {
        this.postMessage({ type: 'mediaBunnyEnded', nodeId });
      },
      onError: (error: Error) => {
        this.postMessage({ type: 'mediaBunnyError', nodeId, error: error.message });
      },
      onTimeUpdate: (currentTime: number) => {
        this.postMessage({ type: 'mediaBunnyTimeUpdate', nodeId, currentTime });
      },
      onFirstFrame: () => {
        this.postMessage({ type: 'mediaBunnyFirstFrame', nodeId });
      }
    });

    this.players.set(nodeId, player);
  }

  private async loadFile(nodeId: string, file: File): Promise<void> {
    const player = this.players.get(nodeId);

    if (!player) {
      console.warn(`[MediaBunnyService] No player for node ${nodeId}`);
      return;
    }

    await player.loadFile(file);
  }

  private async loadUrl(nodeId: string, url: string): Promise<void> {
    const player = this.players.get(nodeId);

    if (!player) {
      console.warn(`[MediaBunnyService] No player for node ${nodeId}`);
      return;
    }

    await player.loadUrl(url);
  }

  private play(nodeId: string): void {
    this.players.get(nodeId)?.play();
  }

  private pause(nodeId: string): void {
    this.players.get(nodeId)?.pause();
  }

  private async seek(nodeId: string, timeSeconds: number): Promise<void> {
    await this.players.get(nodeId)?.seek(timeSeconds);
  }

  private setLoop(nodeId: string, loop: boolean): void {
    this.players.get(nodeId)?.setLoop(loop);
  }

  private setPlaybackRate(nodeId: string, rate: number): void {
    this.players.get(nodeId)?.setPlaybackRate(rate);
  }

  private destroyPlayer(nodeId: string): void {
    const player = this.players.get(nodeId);

    if (player) {
      player.destroy();
      this.players.delete(nodeId);
    }
  }

  /** Destroy all players (for cleanup) */
  destroyAll(): void {
    for (const [nodeId] of this.players) {
      this.destroyPlayer(nodeId);
    }
  }
}
