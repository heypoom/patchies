import type { FBOFormat, FBOResolution } from '$lib/rendering/types';
import type { GLUniformDef } from '../../types/uniform-config';

export type ShaderParkRenderMode = 'flat' | '3d';

export type ShaderParkRenderNode = {
  type: 'shaderpark';
  data: {
    code: string;
    videoInletCount?: number;
    videoOutletCount?: number;
    shaderParkVideoUniformIndices?: number[];
    shaderParkUniformDefs?: GLUniformDef[];
    uniformValues?: Record<string, unknown>;
    renderMode?: ShaderParkRenderMode;
    fboFormat?: FBOFormat;
    resolution?: FBOResolution;
  };
};
