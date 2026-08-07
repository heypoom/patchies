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

type Subscription = {
  query: GraphChangeQuery;
  callback: GraphChangeCallback;
  lastSnapshotKey?: string;
};

export class GraphObserver {
  private subscriptions = new Set<Subscription>();
  private notificationQueued = false;

  constructor(private getGraph: () => RuntimeGraphSpec) {}

  subscribe(query: GraphChangeQuery, callback: GraphChangeCallback): () => void {
    const subscription = { query, callback };

    this.subscriptions.add(subscription);
    this.notifySubscription(subscription);

    return () => this.subscriptions.delete(subscription);
  }

  notify(): void {
    if (this.notificationQueued) return;

    this.notificationQueued = true;

    queueMicrotask(() => {
      this.notificationQueued = false;

      for (const subscription of this.subscriptions) {
        this.notifySubscription(subscription);
      }
    });
  }

  destroy(): void {
    this.subscriptions.clear();
  }

  private getSnapshot(query: GraphChangeQuery): GraphSnapshot {
    const graph = this.getGraph();
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

  private notifySubscription(subscription: Subscription): void {
    const snapshot = this.getSnapshot(subscription.query);

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
}

function nodeMatchesTags(tags: string[], patterns: string[]): boolean {
  return patterns.some((pattern) =>
    tags.some((tag) =>
      pattern.endsWith('/*') ? tag.startsWith(pattern.slice(0, -1)) : tag === pattern
    )
  );
}
