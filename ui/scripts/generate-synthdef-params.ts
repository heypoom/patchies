/**
 * Fetches all SuperSonic synthdef binaries from CDN, parses them to extract
 * parameter names, and writes a generated config mapping each synthdef to
 * its output bus parameter name ('out_bus' | 'out' | null).
 *
 * Usage: bun run scripts/generate-synthdef-params.ts
 *
 * SCgf binary format (v2):
 *   "SCgf" (4 bytes) → version (int32 BE) → numDefs (int16 BE)
 *   Per def:
 *     pstring name → int32 numConstants → float32[] constants
 *     → int32 numParams → float32[] paramDefaults
 *     → int32 numParamNames → (pstring name + int32 index)[]
 */

import { SYNTHDEF_NAMES } from '../src/lib/audio/supersonic-synthdefs';

const CDN_BASE = 'https://unpkg.com/supersonic-scsynth-synthdefs@latest/synthdefs/';

interface SynthDefInfo {
  params: string[];
  outParam: 'out_bus' | 'out' | null;
}

function parseSynthDefParams(buffer: ArrayBuffer): SynthDefInfo {
  const view = new DataView(buffer);
  let offset = 0;

  // "SCgf" magic
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  if (magic !== 'SCgf') throw new Error(`Bad magic: ${magic}`);
  offset += 4;

  // Version (int32 BE) — v1 uses int16 for counts, v2 uses int32
  const version = view.getInt32(offset);
  offset += 4;

  // Helper: read count field (int16 for v1, int32 for v2)
  const readCount = (): number => {
    if (version >= 2) {
      const v = view.getInt32(offset);
      offset += 4;
      return v;
    }
    const v = view.getInt16(offset);
    offset += 2;
    return v;
  };

  // Helper: read pstring (always uint8 length prefix in all versions)
  const readPstring = (): string => {
    const len = view.getUint8(offset);
    offset += 1;
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset++));
    return s;
  };

  // Number of synthdefs (int16 BE)
  const numDefs = view.getInt16(offset);
  offset += 2;

  if (numDefs < 1) throw new Error('No synthdefs in file');

  // Parse first synthdef only

  // pstring: name
  readPstring();

  // Constants
  const numConstants = readCount();
  offset += numConstants * 4; // float32 each

  // Parameters (initial values)
  const numParams = readCount();
  offset += numParams * 4; // float32 each

  // Parameter names
  const numParamNames = readCount();

  const params: string[] = [];
  for (let i = 0; i < numParamNames; i++) {
    params.push(readPstring());
    // param index: int32 for v2, int16 for v1
    offset += version >= 2 ? 4 : 2;
  }

  if (params.length === 0 && numParams > 0) {
    throw new Error(
      `Parsed 0 param names but ${numParams} params exist — likely a format mismatch`
    );
  }

  // Determine output bus param
  let outParam: 'out_bus' | 'out' | null = null;
  if (params.includes('out_bus')) outParam = 'out_bus';
  else if (params.includes('out')) outParam = 'out';

  return { params, outParam };
}

async function main() {
  console.log(`Fetching ${SYNTHDEF_NAMES.length} synthdefs from CDN...\n`);

  const results: Record<string, { outParam: 'out_bus' | 'out' | null; params: string[] }> = {};
  let fetched = 0;
  let errors = 0;

  // Fetch in batches of 10 to avoid overwhelming the CDN
  const BATCH_SIZE = 10;
  for (let i = 0; i < SYNTHDEF_NAMES.length; i += BATCH_SIZE) {
    const batch = SYNTHDEF_NAMES.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (name) => {
      const url = `${CDN_BASE}${name}.scsyndef`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const info = parseSynthDefParams(buffer);
        results[name] = { outParam: info.outParam, params: info.params };
        fetched++;
      } catch (err) {
        console.error(`  ✗ ${name}: ${err}`);
        results[name] = { outParam: null, params: [] };
        errors++;
      }
    });
    await Promise.all(promises);
    process.stdout.write(
      `  ${Math.min(i + BATCH_SIZE, SYNTHDEF_NAMES.length)}/${SYNTHDEF_NAMES.length}\r`
    );
  }

  console.log(`\nFetched ${fetched}, errors ${errors}\n`);

  // Print summary
  const withOutBus = Object.entries(results).filter(([, v]) => v.outParam === 'out_bus');
  const withOut = Object.entries(results).filter(([, v]) => v.outParam === 'out');
  const withNone = Object.entries(results).filter(([, v]) => v.outParam === null);

  console.log(`out_bus: ${withOutBus.length} synthdefs`);
  console.log(`out:     ${withOut.length} synthdefs`);
  console.log(`none:    ${withNone.length} synthdefs`);

  if (withNone.length > 0) {
    console.log(`\nSynthdefs without output bus param:`);
    for (const [name] of withNone) {
      console.log(`  - ${name}`);
    }
  }

  // Generate output file
  const outParamMap: Record<string, 'out_bus' | 'out' | null> = {};
  for (const [name, info] of Object.entries(results)) {
    outParamMap[name] = info.outParam;
  }

  const outputPath = new URL('../src/lib/generated/synthdef-params.generated.ts', import.meta.url)
    .pathname;

  const lines = Object.entries(outParamMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, param]) => `  '${name}': ${param === null ? 'null' : `'${param}'`}`)
    .join(',\n');

  const output = `// Auto-generated by scripts/generate-synthdef-params.ts
// Maps each synthdef to its output bus parameter name.
// Re-generate with: bun run scripts/generate-synthdef-params.ts

export const SYNTHDEF_OUT_PARAMS: Record<string, 'out_bus' | 'out' | null> = {
${lines}
};

/**
 * Get the output bus parameter name for a synthdef.
 * Returns 'out_bus', 'out', or null if the synthdef has no output bus param.
 */
export function getSynthDefOutParam(name: string): 'out_bus' | 'out' | null {
  return SYNTHDEF_OUT_PARAMS[name] ?? null;
}
`;

  await Bun.write(outputPath, output);
  console.log(`\nWrote ${outputPath}`);
}

main().catch(console.error);
