/**
 * Worklet Direct Channel — shared global registry for direct message passing
 * between AudioWorklet processors, bypassing the main thread.
 *
 * All processors on the same AudioContext share one AudioWorkletGlobalScope.
 * This module uses `globalThis` to create a singleton registry that persists
 * across separately-bundled processor modules (each Vite-bundled as IIFE).
 *
 * Usage in processor files:
 *   import { workletChannel } from './worklet-channel';
 *   workletChannel.register(nodeId, recvFn);
 *   workletChannel.send(nodeId, message, outlet);
 */

interface WorkletConnection {
  targetNodeId: string;
  inlet: number;
}

interface WorkletChannel {
  /** Register a processor with its recv callback */
  register(nodeId: string, recv: (data: unknown, inlet: number) => void): void;

  /** Unregister a processor (on stop/destroy) */
  unregister(nodeId: string): void;

  /** Replace the outlet→target connection map for a source node */
  updateConnections(
    nodeId: string,
    connections: Array<{ outlet: number; targetNodeId: string; inlet: number }>
  ): void;

  /** Send a message from source outlet. Returns delivered targetNodeIds. */
  send(sourceNodeId: string, message: unknown, outlet: number): string[];
}

declare let globalThis: {
  __workletChannel?: WorkletChannel;
};

function createWorkletChannel(): WorkletChannel {
  /** nodeId → recv callback */
  const registry = new Map<string, (data: unknown, inlet: number) => void>();

  /** nodeId → outlet → connections[] */
  const connectionMap = new Map<string, Map<number, WorkletConnection[]>>();

  /** Pre-allocated array to avoid allocation in send() hot path */
  const deliveredTargets: string[] = [];

  return {
    register(nodeId, recv) {
      registry.set(nodeId, recv);
    },

    unregister(nodeId) {
      registry.delete(nodeId);
      connectionMap.delete(nodeId);
    },

    updateConnections(nodeId, connections) {
      const outletMap = new Map<number, WorkletConnection[]>();

      for (const conn of connections) {
        let list = outletMap.get(conn.outlet);
        if (!list) {
          list = [];
          outletMap.set(conn.outlet, list);
        }
        list.push({ targetNodeId: conn.targetNodeId, inlet: conn.inlet });
      }

      connectionMap.set(nodeId, outletMap);
    },

    send(sourceNodeId, message, outlet) {
      // Reset reusable array (avoid allocation)
      deliveredTargets.length = 0;

      const outletMap = connectionMap.get(sourceNodeId);
      if (!outletMap) return deliveredTargets;

      const connections = outletMap.get(outlet);
      if (!connections) return deliveredTargets;

      for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];
        const recv = registry.get(conn.targetNodeId);
        if (recv) {
          recv(message, conn.inlet);
          deliveredTargets.push(conn.targetNodeId);
        }
      }

      return deliveredTargets;
    }
  };
}

// Lazy init: first bundled module to load creates the registry, rest reuse
if (!globalThis.__workletChannel) {
  globalThis.__workletChannel = createWorkletChannel();
}

export const workletChannel: WorkletChannel = globalThis.__workletChannel;
