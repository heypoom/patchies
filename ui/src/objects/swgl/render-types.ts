import type { FBOFormat, FBOResolution } from '$lib/rendering/types';

export type SwglRenderNode = {
  type: 'swgl';
  data: {
    code: string;
    mrtCount?: number;
    fboFormat?: FBOFormat;
    resolution?: FBOResolution;
  };
};
