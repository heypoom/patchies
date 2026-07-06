import type { FBOFormat, FBOResolution } from '$lib/rendering/types';

export type TextmodeRenderNode = {
  type: 'textmode';
  data: {
    code: string;
    fboFormat?: FBOFormat;
    resolution?: FBOResolution;
  };
};
