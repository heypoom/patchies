import type { Migration } from '../types';

const MAIN_THREAD_VIDEO_OBJECTS = new Set([
  'p5',
  'canvas.dom',
  'textmode.dom',
  'three.dom',
  'pixi.dom',
  'surface'
]);

const WORKER_VIDEO_OBJECTS = new Set(['canvas', 'regl', 'textmode', 'three']);
const LEGACY_OUTPUT_CALL_LINE = /^[ \t]*noOutput\(\);?[ \t]*(?:\r?\n|$)/gm;
const LEGACY_OUTPUT_IDENTIFIER = /\bnoOutput\b/;
const VIDEO_OUTPUT_SETTER_CALL = /\bsetVideoOutput\s*\(/;

function migrateMainThreadCode(code: string) {
  const withoutLegacyCalls = code.replace(LEGACY_OUTPUT_CALL_LINE, '');

  if (withoutLegacyCalls !== code) return withoutLegacyCalls.replace(/^\r?\n/, '');
  if (LEGACY_OUTPUT_IDENTIFIER.test(code)) return code;
  if (VIDEO_OUTPUT_SETTER_CALL.test(code)) return code;

  return `setVideoOutput(true)\n\n${code}`;
}

function migrateWorkerCode(code: string) {
  return code.replace(LEGACY_OUTPUT_CALL_LINE, 'setVideoOutput(false)\n');
}

export const migration016: Migration = {
  version: 16,
  name: 'video-output-api',

  migrate(patch) {
    if (!patch.nodes) return patch;

    const nodes = patch.nodes.map((node) => {
      const code = node.data?.code;
      if (typeof code !== 'string') return node;

      let migratedCode = code;

      if (node.type && MAIN_THREAD_VIDEO_OBJECTS.has(node.type)) {
        migratedCode = migrateMainThreadCode(code);
      } else if (node.type && WORKER_VIDEO_OBJECTS.has(node.type)) {
        migratedCode = migrateWorkerCode(code);
      }

      if (migratedCode === code) return node;

      return {
        ...node,
        data: {
          ...node.data,
          code: migratedCode
        }
      };
    });

    return { ...patch, nodes };
  }
};
