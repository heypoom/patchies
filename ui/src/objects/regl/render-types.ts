import type { FBOFormat, FBOResolution } from '$lib/rendering/types';

export type ReglRenderNode = {
  type: 'regl';
  data: {
    code: string;
    videoOutletCount?: number;
    fboFormat?: FBOFormat;
    resolution?: FBOResolution;
  };
};
