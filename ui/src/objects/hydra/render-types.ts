import type { FBOFormat, FBOResolution } from '$lib/rendering/types';

export type HydraRenderNode = {
  type: 'hydra';
  data: {
    code: string;
    videoInletCount?: number;
    videoOutletCount?: number;
    fboFormat?: FBOFormat;
    resolution?: FBOResolution;
    _runRevision?: number;
  };
};
