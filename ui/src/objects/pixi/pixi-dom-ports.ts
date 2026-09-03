interface PixiDomPortData {
  inletCount?: number;
  outletCount?: number;
}

interface CreatePixiDomSetPortCountOptions {
  getNodeId: () => string;

  updateNodeData: (nodeId: string, updates: PixiDomPortData) => void;
  updateNodeInternals: (nodeId: string) => void;
}

export const getPixiDomPortLayout = (data: PixiDomPortData, videoOutputEnabled: boolean) => {
  const inletCount = data.inletCount ?? 1;
  const outletCount = data.outletCount ?? 0;

  const videoOutletCount = videoOutputEnabled ? 1 : 0;

  return {
    inletIndices: Array.from({ length: inletCount }, (_, index) => index),
    messageOutletIndices: Array.from(
      { length: outletCount },
      (_, index) => index + videoOutletCount
    ),
    totalOutletCount: outletCount + videoOutletCount,
    videoOutletIndex: videoOutputEnabled ? 0 : undefined
  };
};

export const createPixiDomSetPortCount =
  ({ getNodeId, updateNodeData, updateNodeInternals }: CreatePixiDomSetPortCountOptions) =>
  (inletCount = 1, outletCount = 0) => {
    const nodeId = getNodeId();

    updateNodeData(nodeId, { inletCount, outletCount });
    updateNodeInternals(nodeId);
  };
