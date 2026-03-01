import type { LookaheadClockScheduler, NodeTimelineStyle } from './LookaheadClockScheduler';

/** Describes one scheduled event for timeline visualization. */
export interface ScheduledEventDescriptor {
  id: string;
  kind: 'beat' | 'schedule' | 'every' | 'marker';
  beats?: number[] | '*';
  time?: number;
  interval?: number;
  lastFired?: number;
  fired?: boolean;
  /** Per-marker color override. Only used for kind: 'marker'. */
  color?: string;
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

  /**
   * Get event snapshots across all registered schedulers.
   *
   * When a scheduler has `visible: false`, only explicit
   * markers with kind of 'marker' are included.
   **/
  getAllEvents(): Map<string, ScheduledEventDescriptor[]> {
    const eventsMap = new Map<string, ScheduledEventDescriptor[]>();

    for (const [nodeId, scheduler] of this.entries) {
      const events = scheduler.getEventSnapshot();

      const visibleEvents =
        scheduler.timelineStyle.visible === false
          ? events.filter((e) => e.kind === 'marker')
          : events;

      if (visibleEvents.length > 0) eventsMap.set(nodeId, visibleEvents);
    }

    return eventsMap;
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
