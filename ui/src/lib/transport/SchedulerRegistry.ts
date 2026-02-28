import type { LookaheadClockScheduler, NodeTimelineStyle } from './LookaheadClockScheduler';

/** Describes one scheduled event for timeline visualization. */
export interface ScheduledEventDescriptor {
  id: string;
  kind: 'beat' | 'schedule' | 'every';
  beats?: number[] | '*';
  time?: number;
  interval?: number;
  lastFired?: number;
  fired?: boolean;
}

/** A record of a recently fired event for flash animation. */
export interface FiredEventRecord {
  id: string;
  firedAt: number;
  wallTime: number;
}

/**
 * Central registry that tracks all active LookaheadClockScheduler instances
 * by nodeId. The TimelineRuler polls this at 30fps to visualize events.
 */
export class SchedulerRegistry {
  private static instance: SchedulerRegistry;
  private entries = new Map<string, LookaheadClockScheduler>();

  register(nodeId: string, scheduler: LookaheadClockScheduler): void {
    this.entries.set(nodeId, scheduler);
  }

  unregister(nodeId: string): void {
    this.entries.delete(nodeId);
  }

  getNodeIds(): string[] {
    return Array.from(this.entries.keys());
  }

  /** Get event snapshots across all registered schedulers. */
  getAllEvents(): Map<string, ScheduledEventDescriptor[]> {
    const result = new Map<string, ScheduledEventDescriptor[]>();

    for (const [nodeId, scheduler] of this.entries) {
      result.set(nodeId, scheduler.getEventSnapshot());
    }

    return result;
  }

  getNodeStyle(nodeId: string): NodeTimelineStyle | undefined {
    return this.entries.get(nodeId)?.timelineStyle;
  }

  /** Drain fired event buffers across all registered schedulers. */
  getAllFiredEvents(): Map<string, FiredEventRecord[]> {
    const result = new Map<string, FiredEventRecord[]>();

    for (const [nodeId, scheduler] of this.entries) {
      const events = scheduler.drainFiredEvents();

      if (events.length > 0) {
        result.set(nodeId, events);
      }
    }

    return result;
  }

  private constructor() {}

  static getInstance(): SchedulerRegistry {
    if (!SchedulerRegistry.instance) {
      SchedulerRegistry.instance = new SchedulerRegistry();
    }

    return SchedulerRegistry.instance;
  }
}
