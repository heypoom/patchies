import type { ProjMapSurface } from '$lib/projmap/types';

export type ProjMapRenderNode = {
  type: 'projmap';
  data: {
    surfaces: ProjMapSurface[];
  };
};
