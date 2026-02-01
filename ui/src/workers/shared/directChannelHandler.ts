/**
 * Shared direct channel handling for worker-based nodes.
 * Provides MessagePort management for worker→render and worker→worker communication.
 */

export interface RenderConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
  inletKey?: string;
}

export interface IncomingMessageMeta {
  source: string;
  inlet: number;
  inletKey?: string;
}

export interface DirectChannelConfig {
  nodeId: string;
  onIncomingMessage: (data: unknown, meta: IncomingMessageMeta) => void;
  onError: (message: string) => void;
}

export interface DirectChannelHandler {
  /** Send to render targets via direct port, returns target IDs that were sent to */
  sendToRenderTargets: (data: unknown, options?: { to?: number }) => string[];

  /** Send to worker targets via direct ports, returns target IDs that were sent to */
  sendToWorkerTargets: (data: unknown, options?: { to?: number }) => string[];

  /** Handle setRenderPort message - call with event.ports[0] */
  handleSetRenderPort: (port: MessagePort) => void;

  /** Handle setWorkerPort message - call with event.ports[0] and target/source IDs */
  handleSetWorkerPort: (port: MessagePort, targetNodeId?: string, sourceNodeId?: string) => void;

  /** Handle updateRenderConnections message */
  handleUpdateRenderConnections: (connections: RenderConnection[]) => void;

  /** Handle updateWorkerConnections message */
  handleUpdateWorkerConnections: (connections: RenderConnection[]) => void;

  /** Clean up ports on node destruction */
  cleanup: () => void;
}

export function createDirectChannelHandler(config: DirectChannelConfig): DirectChannelHandler {
  const { nodeId, onIncomingMessage, onError } = config;

  let renderPort: MessagePort | null = null;
  let renderConnections: RenderConnection[] = [];
  const workerPorts = new Map<string, MessagePort>();
  let workerConnections: RenderConnection[] = [];

  function sendToRenderTargets(data: unknown, options?: { to?: number }): string[] {
    if (!renderPort || renderConnections.length === 0) return [];

    const targets = renderConnections.filter(
      (c) => options?.to === undefined || c.outlet === options.to
    );

    for (const target of targets) {
      renderPort.postMessage({
        fromNodeId: nodeId,
        targetNodeId: target.targetNodeId,
        inlet: target.inlet,
        inletKey: target.inletKey,
        data
      });
    }

    return targets.map((t) => t.targetNodeId);
  }

  function sendToWorkerTargets(data: unknown, options?: { to?: number }): string[] {
    if (workerPorts.size === 0 || workerConnections.length === 0) return [];

    const targets = workerConnections.filter(
      (c) => options?.to === undefined || c.outlet === options.to
    );

    const sentTargets: string[] = [];

    for (const target of targets) {
      const port = workerPorts.get(target.targetNodeId);

      if (port) {
        port.postMessage({
          fromNodeId: nodeId,
          targetNodeId: target.targetNodeId,
          inlet: target.inlet,
          inletKey: target.inletKey,
          data
        });

        sentTargets.push(target.targetNodeId);
      }
    }

    return sentTargets;
  }

  function handleSetRenderPort(port: MessagePort): void {
    renderPort = port;

    port.start();
  }

  function handleSetWorkerPort(
    port: MessagePort,
    targetNodeId?: string,
    sourceNodeId?: string
  ): void {
    if (targetNodeId) {
      // This is a sending port (we send TO targetNodeId)
      workerPorts.set(targetNodeId, port);
      port.start();
    } else if (sourceNodeId) {
      // This is a receiving port (we receive FROM sourceNodeId)
      workerPorts.set(sourceNodeId, port);

      port.onmessage = (e) => {
        const { data: msgData, inlet, inletKey, fromNodeId } = e.data;

        try {
          onIncomingMessage(msgData, {
            source: fromNodeId,
            inlet,
            inletKey
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          onError(`Error in recv(): ${message}`);
        }
      };

      port.start();
    }
  }

  function handleUpdateRenderConnections(connections: RenderConnection[]): void {
    renderConnections = connections;
  }

  function handleUpdateWorkerConnections(connections: RenderConnection[]): void {
    workerConnections = connections;
  }

  function cleanup(): void {
    renderPort?.close();
    renderPort = null;
    renderConnections = [];

    for (const port of workerPorts.values()) {
      port.close();
    }

    workerPorts.clear();
    workerConnections = [];
  }

  return {
    sendToRenderTargets,
    sendToWorkerTargets,
    handleSetRenderPort,
    handleSetWorkerPort,
    handleUpdateRenderConnections,
    handleUpdateWorkerConnections,
    cleanup
  };
}
