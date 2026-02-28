import { Transport } from './index';
import { P2PManager } from '$lib/p2p/P2PManager';
import { transportStore } from '../../stores/transport.store';
import { transportSyncStore } from '../../stores/transport-sync.store';

const CHANNEL = '__transport';
const HEARTBEAT_INTERVAL_MS = 1000;

/**
 * Minimum drift (in seconds) before applying a hard seek correction.
 * Below this threshold, drift is ignored — within the ~25ms visual precision.
 */
const DRIFT_THRESHOLD = 0.025;

// ─── Message protocol ──────────────────────────────────────────────────────

interface TransportStatePayload {
  /** Explicit play state to distinguish pause from stop */
  playState: 'playing' | 'paused' | 'stopped';
  bpm: number;
  timeSignature: [number, number];
  /** Transport seconds at the moment this message was sent */
  transportTime: number;
  /** performance.now() on the leader when this message was sent (ms) */
  leaderSendTime: number;
}

interface HeartbeatPayload {
  transportTime: number;
  leaderSendTime: number;
}

type TransportSyncMessage =
  | { type: 'state'; payload: TransportStatePayload }
  | { type: 'heartbeat'; payload: HeartbeatPayload }
  | { type: 'request-state' };

// ─── Manager ───────────────────────────────────────────────────────────────

class TransportSyncManager {
  private enabled = false;
  private isLeader = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeChannel: (() => void) | null = null;
  private unsubscribePeerJoin: (() => void) | null = null;
  private unsubscribePeerLeave: (() => void) | null = null;
  private unsubscribeStore: (() => void) | null = null;

  // ── Public API ────────────────────────────────────────────────────────────

  async enable(): Promise<void> {
    if (this.enabled) return;

    const p2p = P2PManager.getInstance();
    await p2p.initialize();

    this.enabled = true;

    this.subscribeToChannel(p2p);
    this.subscribeToTransportChanges();
    this.subscribeToPeerEvents(p2p);
    this.reelectLeader(p2p);

    // If there are already connected peers and we're a follower, request state
    if (!this.isLeader && p2p.getPeerCount() > 0) {
      p2p.sendToChannel(CHANNEL, { type: 'request-state' } satisfies TransportSyncMessage);
    }

    transportSyncStore.setEnabled(true);
    transportSyncStore.setPeerCount(p2p.getPeerCount());
  }

  disable(): void {
    if (!this.enabled) return;

    this.enabled = false;
    this.isLeader = false;

    this.stopHeartbeat();
    this.unsubscribeChannel?.();
    this.unsubscribePeerJoin?.();
    this.unsubscribePeerLeave?.();
    this.unsubscribeStore?.();

    this.unsubscribeChannel = null;
    this.unsubscribePeerJoin = null;
    this.unsubscribePeerLeave = null;
    this.unsubscribeStore = null;

    transportSyncStore.setEnabled(false);
    transportSyncStore.setIsLeader(false);
    transportSyncStore.setPeerCount(0);
  }

  destroy(): void {
    this.disable();
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  private subscribeToChannel(p2p: P2PManager): void {
    this.unsubscribeChannel = p2p.subscribeToChannel(CHANNEL, (data) => {
      this.onMessage(data as TransportSyncMessage);
    });
  }

  private subscribeToTransportChanges(): void {
    type StoreSnapshot = { playState: string; bpm: number; timeSignature: string };
    let prevSnapshot: StoreSnapshot | null = null;

    this.unsubscribeStore = transportStore.subscribe((state) => {
      const curr: StoreSnapshot = {
        playState: state.playState,
        bpm: state.bpm,
        timeSignature: state.timeSignature.join('/')
      };

      const changed =
        prevSnapshot !== null &&
        (curr.playState !== prevSnapshot.playState ||
          curr.bpm !== prevSnapshot.bpm ||
          curr.timeSignature !== prevSnapshot.timeSignature);

      prevSnapshot = curr;

      if (this.enabled && this.isLeader && changed) {
        this.broadcastState();
      }
    });
  }

  private subscribeToPeerEvents(p2p: P2PManager): void {
    this.unsubscribePeerJoin = p2p.onPeerJoin(() => {
      if (!this.enabled) return;

      this.reelectLeader(p2p);
      transportSyncStore.setPeerCount(p2p.getPeerCount());

      if (this.isLeader) {
        // New peer joined — broadcast current state so they can catch up
        this.broadcastState();
      } else {
        // We're a follower — request state from whoever is leader
        p2p.sendToChannel(CHANNEL, { type: 'request-state' } satisfies TransportSyncMessage);
      }
    });

    this.unsubscribePeerLeave = p2p.onPeerLeave(() => {
      if (!this.enabled) return;

      const wasLeader = this.isLeader;
      this.reelectLeader(p2p);
      transportSyncStore.setPeerCount(p2p.getPeerCount());

      // If we just became leader, broadcast our current state
      if (this.isLeader && !wasLeader) {
        this.broadcastState();
      }
    });
  }

  // ── Leader election ───────────────────────────────────────────────────────

  private reelectLeader(p2p: P2PManager): void {
    const myId = p2p.getMyPeerId();
    const allIds = [myId, ...p2p.getPeerIds()].sort();
    const leaderId = allIds[0];

    const wasLeader = this.isLeader;
    this.isLeader = leaderId === myId;

    transportSyncStore.setIsLeader(this.isLeader);

    if (this.isLeader && !wasLeader) {
      this.startHeartbeat();
    } else if (!this.isLeader && wasLeader) {
      this.stopHeartbeat();
    }
  }

  // ── Message handling ──────────────────────────────────────────────────────

  private onMessage(msg: TransportSyncMessage): void {
    if (!this.enabled) return;

    if (msg.type === 'request-state') {
      if (this.isLeader) this.broadcastState();
      return;
    }

    // Only followers process state and heartbeat
    if (this.isLeader) return;

    if (msg.type === 'state') {
      this.applyState(msg.payload);
    } else if (msg.type === 'heartbeat') {
      this.applyDriftCorrection(msg.payload);
    }
  }

  // ── Leader: broadcast ─────────────────────────────────────────────────────

  private buildStatePayload(): TransportStatePayload {
    return {
      playState: Transport.isPlaying ? 'playing' : Transport.seconds === 0 ? 'stopped' : 'paused',
      bpm: Transport.bpm,
      timeSignature: [Transport.beatsPerBar, Transport.denominator],
      transportTime: Transport.seconds,
      leaderSendTime: Date.now() // wall-clock ms; synced across machines via NTP
    };
  }

  private broadcastState(): void {
    const p2p = P2PManager.getInstance();
    const msg: TransportSyncMessage = { type: 'state', payload: this.buildStatePayload() };
    p2p.sendToChannel(CHANNEL, msg);
  }

  private broadcastHeartbeat(): void {
    const p2p = P2PManager.getInstance();
    const msg: TransportSyncMessage = {
      type: 'heartbeat',
      payload: { transportTime: Transport.seconds, leaderSendTime: Date.now() }
    };
    p2p.sendToChannel(CHANNEL, msg);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.enabled && this.isLeader && Transport.isPlaying) {
        this.broadcastHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── Follower: apply ───────────────────────────────────────────────────────

  private applyState(payload: TransportStatePayload): void {
    // Estimate true leader time accounting for one-way network latency.
    // Date.now() is wall-clock time shared across machines (NTP-synced),
    // so the difference is the actual one-way trip time — no /2 needed.
    const oneWayLatency_ms = Date.now() - payload.leaderSendTime;
    const estimatedTime = payload.transportTime + Math.max(0, oneWayLatency_ms) / 1000;

    // Sync BPM
    if (Math.abs(Transport.bpm - payload.bpm) > 0.01) {
      Transport.setBpm(payload.bpm);
    }

    // Sync time signature
    const [leaderBeats, leaderDenom] = payload.timeSignature;
    if (Transport.beatsPerBar !== leaderBeats || Transport.denominator !== leaderDenom) {
      Transport.setTimeSignature(leaderBeats, leaderDenom);
    }

    // Sync play state
    if (payload.playState === 'playing') {
      if (!Transport.isPlaying) {
        Transport.seek(estimatedTime);
        Transport.play();
      } else {
        // Already playing — correct drift
        const drift = estimatedTime - Transport.seconds;
        if (Math.abs(drift) >= DRIFT_THRESHOLD) {
          Transport.seek(estimatedTime);
        }
      }
    } else if (payload.playState === 'stopped') {
      Transport.stop();
    } else {
      // paused
      if (Transport.isPlaying) {
        Transport.pause();
      }
    }
  }

  private applyDriftCorrection(payload: HeartbeatPayload): void {
    if (!Transport.isPlaying) return;

    const oneWayLatency_ms = Date.now() - payload.leaderSendTime;
    const estimatedLeaderTime = payload.transportTime + Math.max(0, oneWayLatency_ms) / 1000;
    const drift = estimatedLeaderTime - Transport.seconds;

    if (Math.abs(drift) >= DRIFT_THRESHOLD) {
      Transport.seek(estimatedLeaderTime);
    }
  }
}

export const transportSyncManager = new TransportSyncManager();
