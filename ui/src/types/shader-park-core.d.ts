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

  export type ShaderParkThreeSource = {
    uniforms: ShaderParkUniform[];
    frag: string;
    vert: string;
    error?: unknown;
    geoGLSL: string;
    colorGLSL: string;
  };

  export const fragFooter: string;
  export const minimalHeader: string;
  export const minimalVertexSource: string;
  export const sculptureStarterCode: string;
  export const useHemisphereLight: string;
  export const usePBRHeader: string;

  export function sculptToGLSL(source: string): ShaderParkGeneratedSource;
  export function sculptToThreeJSShaderSource(source: string): ShaderParkThreeSource;
  export function uniformsToGLSL(uniforms: Array<{ name: string; type: string }>): string;
}
