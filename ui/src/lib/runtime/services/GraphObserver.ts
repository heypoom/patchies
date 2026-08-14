import { getUserTags } from './graph-tags';
import { hash } from 'ohash';

import { logger } from '$lib/utils/logger';

import type {
  RuntimeConnectionSpec,
  RuntimeGraphSpec,
  RuntimeObjectSpec
} from '../types/runtime-object';

export type GraphChangeQuery = {
  tags: string[];
};

export type GraphSnapshotNode = RuntimeObjectSpec & {
  tags: string[];
};

export type GraphSnapshotEdge = Required<Pick<RuntimeConnectionSpec, 'id' | 'source' | 'target'>> &
  Pick<RuntimeConnectionSpec, 'outlet' | 'inlet'>;

export type GraphSnapshot = {
  nodes: GraphSnapshotNode[];
  edges: GraphSnapshotEdge[];
};

export type GraphChangeCallback = (snapshot: GraphSnapshot) => void;

export type GraphChange = {
  changedObjectIds: ReadonlySet<string>;
  changedConnectionNodeIds: ReadonlySet<string>;
};

type Subscription = {
  query: GraphChangeQuery;
  callback: GraphChangeCallback;
  lastSnapshotKey?: string;
  matchingNodeIds: Set<string>;
};

export class GraphObserver {
  private subscriptions = new Set<Subscription>();

  private notificationQueued = false;
  private fullNotificationQueued = false;

  private changedObjectIds = new Set<string>();
  private changedConnectionNodeIds = new Set<string>();

  constructor(private getGraph: () => RuntimeGraphSpec) {}

  subscribe(query: GraphChangeQuery, callback: GraphChangeCallback): () => void {
    const subscription = { query, callback, matchingNodeIds: new Set<string>() };

    this.subscriptions.add(subscription);
    this.notifySubscription(subscription);

    return () => this.subscriptions.delete(subscription);
  }

  notify(change?: GraphChange): void {
    if (change) {
      for (const nodeId of change.changedObjectIds) {
        this.changedObjectIds.add(nodeId);
      }

      for (const nodeId of change.changedConnectionNodeIds) {
        this.changedConnectionNodeIds.add(nodeId);
      }
    } else {
      this.fullNotificationQueued = true;
    }

    if (this.notificationQueued) return;

    this.notificationQueued = true;

    queueMicrotask(() => {
      this.notificationQueued = false;

      const graph = this.getGraph();

      const change = this.fullNotificationQueued
        ? undefined
        : {
            changedObjectIds: this.changedObjectIds,
            changedConnectionNodeIds: this.changedConnectionNodeIds
          };

      this.fullNotificationQueued = false;
      this.changedObjectIds = new Set<string>();
      this.changedConnectionNodeIds = new Set<string>();

      const objectsById = new Map(graph.objects.map((object) => [object.id, object]));

      for (const subscription of this.subscriptions) {
        const canAffectSubscription = this.changeCanAffectSubscription(
          subscription,
          change,
          objectsById
        );

        if (!change || canAffectSubscription) {
          this.notifySubscription(subscription, graph);
        }
      }
    });
  }

  destroy(): void {
    this.subscriptions.clear();
  }

  private getSnapshot(query: GraphChangeQuery, graph: RuntimeGraphSpec): GraphSnapshot {
    const nodes = graph.objects.flatMap((node) => {
      const tags = getUserTags(node.data.tags);

      return nodeMatchesTags(tags, query.tags) ? [{ ...node, tags }] : [];
    });

    const matchingNodeIds = new Set(nodes.map((node) => node.id));

    const edges = (graph.connections ?? []).flatMap((edge) =>
      matchingNodeIds.has(edge.source) && matchingNodeIds.has(edge.target)
        ? [
            {
              id:
                edge.id ?? `${edge.source}-${edge.outlet ?? ''}-${edge.target}-${edge.inlet ?? ''}`,
              source: edge.source,
              outlet: edge.outlet,
              target: edge.target,
              inlet: edge.inlet
            }
          ]
        : []
    );

    return { nodes, edges };
  }

  private notifySubscription(subscription: Subscription, graph = this.getGraph()): void {
    const snapshot = this.getSnapshot(subscription.query, graph);
    subscription.matchingNodeIds = new Set(snapshot.nodes.map((node) => node.id));

    if (snapshot.nodes.length === 0) {
      subscription.lastSnapshotKey = undefined;

      return;
    }

    const snapshotKey = hash(snapshot);
    if (snapshotKey === subscription.lastSnapshotKey) return;

    subscription.lastSnapshotKey = snapshotKey;

    try {
      subscription.callback(snapshot);
    } catch (error) {
      logger.warn('Error in onGraphChange() handler:', error);
    }
  }

  private changeCanAffectSubscription(
    subscription: Subscription,
    change: GraphChange,
    objectsById: Map<string, RuntimeObjectSpec>
  ): boolean {
    for (const nodeId of change.changedObjectIds) {
      if (this.nodeCanAffectSubscription(subscription, nodeId, objectsById)) return true;
    }

    for (const nodeId of change.changedConnectionNodeIds) {
      if (this.nodeCanAffectSubscription(subscription, nodeId, objectsById)) return true;
    }

    return false;
  }

  private nodeCanAffectSubscription(
    subscription: Subscription,
    nodeId: string,
    objectsById: Map<string, RuntimeObjectSpec>
  ): boolean {
    if (subscription.matchingNodeIds.has(nodeId)) return true;

    const node = objectsById.get(nodeId);
    return node ? nodeMatchesTags(getUserTags(node.data.tags), subscription.query.tags) : false;
  }
}

const nodeMatchesTags = (tags: string[], patterns: string[]): boolean =>
  patterns.some((pattern) =>
    tags.some((tag) =>
      pattern.endsWith('/*') ? tag.startsWith(pattern.slice(0, -1)) : tag === pattern
    )
  );
