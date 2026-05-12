declare module 'shader-park-core' {
  export const fragFooter: string;
  export const minimalHeader: string;
  export const minimalVertexSource: string;
  export const sculptureStarterCode: string;
  export const useHemisphereLight: string;
  export const usePBRHeader: string;

  export function sculptToGLSL(source: string): unknown;
  export function uniformsToGLSL(uniforms: Array<{ name: string; type: string }>): string;
}
