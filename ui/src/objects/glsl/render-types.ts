import type { FBOFormat, FBOResolution } from '$lib/rendering/types';
import type { GLUniformDef } from '../../types/uniform-config';

export type GlslRenderNode = {
  type: 'glsl';
  data: {
    code: string;
    glUniformDefs: GLUniformDef[];
    uniformValues?: Record<string, unknown>;
    mrtCount?: number;
    fboFormat?: FBOFormat;
    resolution?: FBOResolution;
  };
};
