import type { FBOFormat, FBOResolution } from '$lib/rendering/types';

export type CanvasRenderNode = {
  type: 'canvas';
  data: {
    code: string;
    fboFormat?: FBOFormat;
    resolution?: FBOResolution;
  };
};
