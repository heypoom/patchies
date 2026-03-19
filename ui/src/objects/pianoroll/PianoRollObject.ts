import { Transport } from '$lib/transport';
import { LookaheadClockScheduler } from '$lib/transport/ClockScheduler';
import { SchedulerRegistry } from '$lib/transport/SchedulerRegistry';
import { PPQ, QUANTIZE_TICKS, type PianoRollMode, type PianoRollNote } from './types';

function ticksToSeconds(ticks: number, bpm: number): number {
  return ticks / ((PPQ * bpm) / 60);
}

function snapToGrid(tick: number, quantize: string): number {
  const gridTicks = QUANTIZE_TICKS[quantize];
  if (!gridTicks) return tick;
  return Math.round(tick / gridTicks) * gridTicks;
}

interface PendingNote {
  tick: number;
  velocity: number;
  channel: number;
}

export class PianoRollObject {
  private scheduler: LookaheadClockScheduler;
  private mode: PianoRollMode = 'idle';
  private clipStartTick = 0;
  private pendingNotes = new Map<number, PendingNote>();
  private scheduleIds: string[] = [];
  private lastWasPlaying = false;

  constructor(
    private nodeId: string,
    private cbs: {
      getNotes: () => PianoRollNote[];
      getLengthBars: () => number;
      getQuantize: () => string;
      getLoop: () => boolean;
      getSyncToTransport: () => boolean;
      onNoteCommit: (note: PianoRollNote) => void;
      onRecordEnd: (clipLengthTicks: number) => void;
      onModeChange: (mode: PianoRollMode) => void;
      onSend: (msg: unknown) => void;
    }
  ) {
    this.scheduler = new LookaheadClockScheduler(() => ({
      time: Transport.seconds,
      beat: Transport.beat,
      bpm: Transport.bpm,
      phase: Transport.phase,
      beatsPerBar: Transport.beatsPerBar
    }));
    this.scheduler.setTimelineStyle({ visible: false });
  }

  create(): void {
    this.scheduler.start();
    SchedulerRegistry.getInstance().register(this.nodeId, this.scheduler);
  }

  /** Called every ~50ms from the component to detect transport state changes */
  tick(): void {
    const isPlaying = Transport.isPlaying;
    if (isPlaying === this.lastWasPlaying) return;
    this.lastWasPlaying = isPlaying;

    if (isPlaying && this.mode === 'armed') {
      this.startRecording();
    } else if (!isPlaying && this.cbs.getSyncToTransport()) {
      if (this.mode === 'recording') {
        this.endRecording(true);
      } else if (this.mode === 'playing' || this.mode === 'looping') {
        this.clearSchedules();
        this.setMode('idle');
      }
    }
  }

  arm(): void {
    if (Transport.isPlaying && !this.cbs.getSyncToTransport()) {
      this.startRecording();
    } else if (Transport.isPlaying && this.cbs.getSyncToTransport()) {
      this.startRecording();
    } else {
      this.setMode('armed');
    }
    this.lastWasPlaying = Transport.isPlaying;
  }

  record(): void {
    if (Transport.isPlaying) {
      this.startRecording();
    }
  }

  stop(): void {
    this.clearSchedules();
    if (this.mode === 'recording') {
      // Keep notes captured so far, don't start playback
      this.endRecording(false);
      return;
    }
    this.setMode('idle');
  }

  clear(): void {
    this.clearSchedules();
    this.pendingNotes.clear();
    this.setMode('idle');
  }

  toggleLoop(): void {
    if (this.mode === 'playing') this.setMode('looping');
    else if (this.mode === 'looping') this.setMode('playing');
  }

  incomingNote(msg: { type: string; note: number; velocity?: number; channel?: number }): void {
    if (this.mode !== 'recording') return;
    const tick = Transport.ticks - this.clipStartTick;

    if (msg.type === 'noteOn' && (msg.velocity ?? 0) > 0) {
      this.pendingNotes.set(msg.note, {
        tick,
        velocity: msg.velocity ?? 64,
        channel: msg.channel ?? 1
      });
    } else {
      const pending = this.pendingNotes.get(msg.note);
      if (!pending) return;
      const quantize = this.cbs.getQuantize();
      const noteTick = quantize !== 'off' ? snapToGrid(pending.tick, quantize) : pending.tick;
      const durationTicks = Math.max(tick - pending.tick, QUANTIZE_TICKS[quantize] ?? 1);
      this.cbs.onNoteCommit({
        tick: noteTick,
        durationTicks,
        note: msg.note,
        velocity: pending.velocity,
        channel: pending.channel
      });
      this.pendingNotes.delete(msg.note);
    }
  }

  private startRecording(): void {
    this.clipStartTick = Transport.ticks;
    this.pendingNotes.clear();
    this.clearSchedules();
    this.setMode('recording');

    const lengthBars = this.cbs.getLengthBars();
    if (lengthBars > 0) {
      const clipLengthTicks = this.computeClipTicks(lengthBars);
      const endTime = Transport.seconds + ticksToSeconds(clipLengthTicks, Transport.bpm);
      this.scheduleIds.push(this.scheduler.schedule(endTime, () => this.endRecording(true)));
    }
  }

  private endRecording(startPlaying: boolean): void {
    const lengthBars = this.cbs.getLengthBars();
    const clipLengthTicks =
      lengthBars > 0 ? this.computeClipTicks(lengthBars) : Transport.ticks - this.clipStartTick;

    // Close open notes at clip boundary
    for (const [note, pending] of this.pendingNotes) {
      const durationTicks = Math.max(clipLengthTicks - pending.tick, 1);
      this.cbs.onNoteCommit({
        tick: pending.tick,
        durationTicks,
        note,
        velocity: pending.velocity,
        channel: pending.channel
      });
    }
    this.pendingNotes.clear();
    this.cbs.onRecordEnd(clipLengthTicks);

    if (startPlaying) {
      const loop = this.cbs.getLoop();
      this.schedulePlayback(Transport.seconds, clipLengthTicks, loop);
      this.setMode(loop ? 'looping' : 'playing');
    } else {
      this.setMode('idle');
    }
  }

  private schedulePlayback(startTime: number, clipLengthTicks: number, loop: boolean): void {
    this.clearSchedules();
    const notes = this.cbs.getNotes();
    const bpm = Transport.bpm;

    for (const n of notes) {
      const onTime = startTime + ticksToSeconds(n.tick, bpm);
      const offTime = startTime + ticksToSeconds(n.tick + n.durationTicks, bpm);
      this.scheduleIds.push(
        this.scheduler.schedule(onTime, () =>
          this.cbs.onSend({
            type: 'noteOn',
            note: n.note,
            velocity: n.velocity,
            channel: n.channel
          })
        )
      );
      this.scheduleIds.push(
        this.scheduler.schedule(offTime, () =>
          this.cbs.onSend({ type: 'noteOff', note: n.note, velocity: 0, channel: n.channel })
        )
      );
    }

    if (loop) {
      const loopEnd = startTime + ticksToSeconds(clipLengthTicks, bpm);
      this.scheduleIds.push(
        this.scheduler.schedule(loopEnd, () =>
          this.schedulePlayback(loopEnd, clipLengthTicks, true)
        )
      );
    }
  }

  private clearSchedules(): void {
    for (const id of this.scheduleIds) this.scheduler.cancel(id);
    this.scheduleIds = [];
  }

  private computeClipTicks(bars: number): number {
    return bars * Transport.beatsPerBar * PPQ * (4 / Transport.denominator);
  }

  private setMode(mode: PianoRollMode): void {
    this.mode = mode;
    this.cbs.onModeChange(mode);
  }

  destroy(): void {
    this.clearSchedules();
    SchedulerRegistry.getInstance().unregister(this.nodeId);
    this.scheduler.dispose();
  }
}
