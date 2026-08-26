import type regl from 'regl';

import type {
  AudioAnalysisPayloadWithType,
  AudioAnalysisType,
  GlslFFTInletMeta
} from '$lib/audio/AudioAnalysisSystem';

/** Maintains FFT textures and their GLSL sampler bindings in the render worker. */
export class FFTTextureStore {
  private inletsByGlslNode = new Map<string, GlslFFTInletMeta>();
  private texturesByAnalyzer = new Map<string, Map<AudioAnalysisType, regl.Texture2D>>();

  constructor(private regl: regl.Regl) {}

  update(payload: AudioAnalysisPayloadWithType): boolean {
    const inlet = payload.inlets?.[0];
    if (!inlet) return false;

    this.inletsByGlslNode.set(payload.nodeId, inlet);

    const textures = this.texturesByAnalyzer.get(inlet.analyzerNodeId) ?? new Map();
    this.texturesByAnalyzer.set(inlet.analyzerNodeId, textures);

    const texture = textures.get(payload.analysisType);
    const width = payload.array.length;
    const shouldCreate = !texture || texture.width !== width || texture.height !== 1;

    if (texture && shouldCreate) {
      texture.destroy();
    }

    const options = {
      width,
      height: 1,
      data: payload.array,
      format: 'luminance' as const,
      type: payload.format === 'int' ? ('uint8' as const) : ('float' as const),
      wrapS: 'clamp' as const,
      wrapT: 'clamp' as const,
      min: 'nearest' as const,
      mag: 'nearest' as const
    };

    if (shouldCreate) {
      textures.set(payload.analysisType, this.regl.texture(options));
    } else {
      texture(options);
    }

    return true;
  }

  getTextureForUniform(nodeId: string, uniformName: string): regl.Texture2D | undefined {
    const inlet = this.inletsByGlslNode.get(nodeId);
    if (inlet?.uniformName !== uniformName) return undefined;

    return this.texturesByAnalyzer.get(inlet.analyzerNodeId)?.get(inlet.analysisType);
  }
}
