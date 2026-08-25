import type { FBOFormat, FBOResolution } from '$lib/rendering/types';

export type PixiRenderNode = {
  type: 'pixi';
  data: {
    code: string;
    fboFormat?: FBOFormat;
    resolution?: FBOResolution;
    _runRevision?: number;
  };
};
