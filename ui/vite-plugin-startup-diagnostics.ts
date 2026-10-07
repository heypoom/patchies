import type { Plugin } from 'vite';

/** Observe production imports and bundle evaluation without changing how bundles load. */
export const startupDiagnostics = (): Plugin => ({
  name: 'patchies-startup-diagnostics',
  apply: 'build',

  renderDynamicImport({ format, targetChunk, targetModuleId }) {
    if (format !== 'es') return;

    const name = targetChunk?.fileName ?? targetModuleId?.split('/').pop() ?? 'Dynamic import';

    return {
      left: `(globalThis.__patchiesStartup?.trackImport ?? ((_name, promise) => promise))(${JSON.stringify(name)}, import(`,
      right: '))'
    };
  },

  renderChunk(code, _chunk, { format }) {
    if (format !== 'es') return;

    // Appending preserves existing source-map positions and participates in content hashing.
    return {
      code: `${code}\n;globalThis.__patchiesStartup?.evaluated(import.meta.url);\n`,
      map: null
    };
  }
});
