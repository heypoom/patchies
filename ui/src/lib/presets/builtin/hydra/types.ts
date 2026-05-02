export type HydraNodeData = {
  code: string;
  messageInletCount?: number;
  messageOutletCount?: number;
  videoInletCount?: number;
  videoOutletCount?: number;
  title?: string;
};

export type HydraPreset = {
  type: 'hydra';
  description?: string;
  data: HydraNodeData;
};
