export type CookReason =
  | 'first-frame'
  | 'force'
  | 'config'
  | 'uniform'
  | 'message'
  | 'input'
  | 'time'
  | 'mouse'
  | 'fft'
  | 'bitmap'
  | 'feedback'
  | 'output-size'
  | 'renderer-policy';

export type CookMode = 'always' | 'on-demand';

export type CookStatus = 'cooked' | 'cached' | 'paused';

export interface CookPolicy {
  mode: CookMode;
  timeDependent?: boolean;
  frameDependent?: boolean;
  dateDependent?: boolean;
  mouseDependent?: boolean;
  fftDependent?: boolean;
  feedbackDependent?: boolean;
}

export interface CookFrameContext {
  transportTime: number;
  prevTransportTime: number;
  isTransportPlaying: boolean;
}

export interface CookDecision {
  shouldCook: boolean;
  reasons: CookReason[];
}

export interface CookNodeStatus {
  status: CookStatus;
  cookedFrames: number;
  cachedFrames: number;
  lastCookTimeMs: number | null;
  lastCookReasons: CookReason[];
}

type NodeState = {
  policy: CookPolicy;
  dirtyReasons: Set<CookReason>;
  hasCooked: boolean;
  status: CookStatus;
  cookedFrames: number;
  cachedFrames: number;
  lastCookTimeMs: number | null;
  lastCookReasons: CookReason[];
};

const DEFAULT_FRAME_CONTEXT: CookFrameContext = {
  transportTime: 0,
  prevTransportTime: 0,
  isTransportPlaying: false
};

export class CookStateManager {
  private nodes = new Map<string, NodeState>();
  private outputsByNode = new Map<string, string[]>();
  private graphSignaturesByNode = new Map<string, string>();
  private frameContext: CookFrameContext = DEFAULT_FRAME_CONTEXT;
  private cookedNodeIdsThisFrame = new Set<string>();

  registerNode(nodeId: string, policy: CookPolicy): void {
    const existing = this.nodes.get(nodeId);

    if (existing) {
      existing.policy = policy;
      return;
    }

    this.nodes.set(nodeId, {
      policy,
      dirtyReasons: new Set(['first-frame']),
      hasCooked: false,
      status: 'cached',
      cookedFrames: 0,
      cachedFrames: 0,
      lastCookTimeMs: null,
      lastCookReasons: []
    });
  }

  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.graphSignaturesByNode.delete(nodeId);
  }

  setOutputsByNode(outputsByNode: Map<string, string[]>): void {
    this.outputsByNode = outputsByNode;
  }

  setGraphSignatures(signaturesByNode: Map<string, string>): void {
    for (const nodeId of this.graphSignaturesByNode.keys()) {
      if (!signaturesByNode.has(nodeId)) {
        this.graphSignaturesByNode.delete(nodeId);
      }
    }

    for (const [nodeId, signature] of signaturesByNode) {
      const previousSignature = this.graphSignaturesByNode.get(nodeId);

      this.graphSignaturesByNode.set(nodeId, signature);

      if (previousSignature !== undefined && previousSignature !== signature) {
        this.markDirty(nodeId, 'config');
      }
    }
  }

  beginFrame(context: CookFrameContext): void {
    this.frameContext = context;
    this.cookedNodeIdsThisFrame.clear();
  }

  markDirty(nodeId: string, reason: CookReason): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    state.dirtyReasons.add(reason);
  }

  markCooked(nodeId: string, reasons: CookReason[], cookTimeMs: number): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    state.status = 'cooked';
    state.hasCooked = true;
    state.cookedFrames += 1;
    state.lastCookTimeMs = cookTimeMs;
    state.lastCookReasons = reasons;
    state.dirtyReasons.clear();
    this.cookedNodeIdsThisFrame.add(nodeId);

    for (const downstreamNodeId of this.outputsByNode.get(nodeId) ?? []) {
      this.markDirty(downstreamNodeId, 'input');
    }
  }

  markCached(nodeId: string): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    state.status = 'cached';
    state.cachedFrames += 1;
  }

  markPaused(nodeId: string): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    state.status = 'paused';
  }

  shouldCook(nodeId: string): CookDecision {
    const state = this.nodes.get(nodeId);
    if (!state) return { shouldCook: true, reasons: ['force'] };

    const reasons = new Set<CookReason>(state.dirtyReasons);

    if (state.policy.mode === 'always') {
      reasons.add('renderer-policy');
    }

    if (this.isTimeDependentCookNeeded(state.policy)) {
      reasons.add('time');
    }

    if (state.policy.frameDependent || state.policy.dateDependent) {
      reasons.add('time');
    }

    if (state.policy.feedbackDependent) {
      reasons.add('feedback');
    }

    if (reasons.size === 0) {
      this.markCached(nodeId);
      return { shouldCook: false, reasons: [] };
    }

    return { shouldCook: true, reasons: Array.from(reasons) };
  }

  getStatus(nodeId: string): CookNodeStatus | undefined {
    const state = this.nodes.get(nodeId);
    if (!state) return undefined;

    return {
      status: state.status,
      cookedFrames: state.cookedFrames,
      cachedFrames: state.cachedFrames,
      lastCookTimeMs: state.lastCookTimeMs,
      lastCookReasons: state.lastCookReasons
    };
  }

  getCookedNodeIdsThisFrame(): ReadonlySet<string> {
    return this.cookedNodeIdsThisFrame;
  }

  private isTimeDependentCookNeeded(policy: CookPolicy): boolean {
    if (!policy.timeDependent) return false;

    return (
      this.frameContext.isTransportPlaying ||
      this.frameContext.transportTime !== this.frameContext.prevTransportTime
    );
  }
}
