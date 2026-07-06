import type { FBOFormat, FBOResolution } from '$lib/rendering/types';

export type ThreeRenderNode = {
  type: 'three';
  data: {
    code: string;
    fboFormat?: FBOFormat;
    resolution?: FBOResolution;
    _runRevision?: number;
  };
};
