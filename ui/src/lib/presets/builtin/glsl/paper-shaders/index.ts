import { preset as meshGradientPreset } from './mesh-gradient';
import { preset as dotGridPreset } from './dot-grid';
import { preset as wavesPreset } from './waves';
import { preset as spiralPreset } from './spiral';
import { preset as staticMeshGradientPreset } from './static-mesh-gradient';
import { preset as staticRadialGradientPreset } from './static-radial-gradient';
import { preset as simplexNoisePreset } from './simplex-noise';
import { preset as perlinNoisePreset } from './perlin-noise';
import { preset as neuroNoisePreset } from './neuro-noise';
import { preset as swirlPreset } from './swirl';
import { preset as colorPanelsPreset } from './color-panels';
import { preset as dotOrbitPreset } from './dot-orbit';
import { preset as metaballsPreset } from './metaballs';
import { preset as voronoiPreset } from './voronoi';
import { preset as warpPreset } from './warp';
import { preset as godRaysPreset } from './god-rays';
import { preset as grainGradientPreset } from './grain-gradient';
import { preset as smokeRingPreset } from './smoke-ring';
import { preset as pulsingBorderPreset } from './pulsing-border';
import { preset as ditheringPreset } from './dithering';
import { preset as gemSmokePreset } from './gem-smoke';

import type { GLSLPreset } from '../types';

export const PAPER_SHADER_PRESETS: Record<string, GLSLPreset> = {
  'Paper Mesh Gradient': meshGradientPreset,
  'Paper Dot Grid': dotGridPreset,
  'Paper Waves': wavesPreset,
  'Paper Spiral': spiralPreset,
  'Paper Static Mesh Gradient': staticMeshGradientPreset,
  'Paper Static Radial Gradient': staticRadialGradientPreset,
  'Paper Simplex Noise': simplexNoisePreset,
  'Paper Perlin Noise': perlinNoisePreset,
  'Paper Neuro Noise': neuroNoisePreset,
  'Paper Swirl': swirlPreset,
  'Paper Color Panels': colorPanelsPreset,
  'Paper Dot Orbit': dotOrbitPreset,
  'Paper Metaballs': metaballsPreset,
  'Paper Voronoi': voronoiPreset,
  'Paper Warp': warpPreset,
  'Paper God Rays': godRaysPreset,
  'Paper Grain Gradient': grainGradientPreset,
  'Paper Smoke Ring': smokeRingPreset,
  'Paper Pulsing Border': pulsingBorderPreset,
  'Paper Dithering': ditheringPreset,
  'Paper Gem Smoke': gemSmokePreset
};

export const PAPER_SHADER_PRESET_NAMES = Object.keys(PAPER_SHADER_PRESETS);
