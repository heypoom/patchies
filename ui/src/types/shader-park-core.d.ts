declare module 'shader-park-core' {
  export type ShaderParkUniform = {
    name: string;
    type: string;
    value?: unknown;
    min?: unknown;
    max?: unknown;
  };

  export type ShaderParkGeneratedSource = {
    uniforms: ShaderParkUniform[];
    stepSizeConstant: number;
    maxIterations: number;
    maxReflections: number;
    userGLSL: string;
    geoGLSL: string;
    colorGLSL: string;
    error?: unknown;
  };

  export const fragFooter: string;
  export const minimalHeader: string;
  export const minimalVertexSource: string;
  export const sculptureStarterCode: string;
  export const useHemisphereLight: string;
  export const usePBRHeader: string;

  export function sculptToGLSL(source: string): ShaderParkGeneratedSource;
  export function uniformsToGLSL(uniforms: Array<{ name: string; type: string }>): string;
}
