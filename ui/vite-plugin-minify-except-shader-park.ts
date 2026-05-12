import type { RenderedChunk } from 'rollup';
import type { Plugin } from 'vite';
import { minify } from 'terser';

const SHADER_PARK_CORE_MODULE = 'node_modules/shader-park-core';

function isShaderParkCoreId(id: string) {
  return id.includes(SHADER_PARK_CORE_MODULE);
}

function containsShaderParkCore(chunk: RenderedChunk) {
  return chunk.moduleIds.some(isShaderParkCoreId);
}

export function minifyExceptShaderParkCore(): Plugin {
  return {
    name: 'minify-except-shader-park-core',
    apply: 'build',
    transform(code, id) {
      if (!isShaderParkCoreId(id)) {
        return null;
      }

      return {
        code,
        moduleSideEffects: 'no-treeshake'
      };
    },
    async renderChunk(code, chunk) {
      if (containsShaderParkCore(chunk)) {
        return null;
      }

      const result = await minify(code, {
        module: true,
        compress: true,
        mangle: true,
        format: {
          comments: false
        }
      });

      if (!result.code) return null;

      return { code: result.code };
    }
  };
}
