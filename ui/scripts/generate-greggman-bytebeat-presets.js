import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputPath = new URL('../src/lib/presets/builtin/bytebeat/greggman.ts', import.meta.url);
const SOURCE_URL = 'https://greggman.github.io/html5bytebeat/editor/songs.json';

const BUCKETS = [
  { name: 'Tiny (<80 chars)', accepts: (size) => size < 80 },
  { name: 'Small (80-199 chars)', accepts: (size) => size >= 80 && size < 200 },
  { name: 'Medium (200-999 chars)', accepts: (size) => size >= 200 && size < 1000 },
  { name: 'Long (1000+ chars)', accepts: (size) => size >= 1000 }
];

const syntaxByEditorValue = {
  0: 'infix',
  1: 'postfix',
  2: 'glitch',
  3: 'function'
};

const typeByEditorValue = {
  0: 'bytebeat',
  1: 'floatbeat',
  2: 'signedBytebeat'
};

function getHashParams(link) {
  const hash = new URL(link).hash.replace(/^#/, '');
  return new URLSearchParams(hash);
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'untitled';
}

function makeUniqueKey(title, seenKeys) {
  const baseKey = `${slugify(title)}.greggman.beat`;
  let key = baseKey;
  let duplicateIndex = 2;

  while (seenKeys.has(key)) {
    key = `${baseKey.replace(/\.greggman\.beat$/, '')}-${duplicateIndex}.greggman.beat`;
    duplicateIndex += 1;
  }

  seenKeys.add(key);
  return key;
}

function getBucketName(size) {
  return BUCKETS.find((bucket) => bucket.accepts(size))?.name ?? BUCKETS.at(-1).name;
}

function decodeHexLzma(hex, tempDir, index) {
  const compressedPath = join(tempDir, `${String(index).padStart(3, '0')}.lzma`);
  writeFileSync(compressedPath, Buffer.from(hex, 'hex'));

  return execFileSync('xz', ['--format=lzma', '--decompress', '--stdout', compressedPath], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  }).trim();
}

function startsWithComment(source) {
  return source
    .split('\n')
    .find((line) => line.trim())
    ?.trim()
    .startsWith('//');
}

function serialize(value) {
  return JSON.stringify(value, null, 2);
}

async function fetchSongs() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  const songs = await fetchSongs();
  const seenKeys = new Set();
  const presets = {};
  const folders = Object.fromEntries(BUCKETS.map((bucket) => [bucket.name, []]));
  const tempDir = mkdtempSync(join(tmpdir(), 'patchies-greggman-bytebeat-'));

  try {
    songs.forEach((song, index) => {
      const params = getHashParams(song.link);
      const key = makeUniqueKey(song.title, seenKeys);
      const decodedExpr = decodeHexLzma(params.get('bb'), tempDir, index);
      const syntax = syntaxByEditorValue[params.get('e') ?? '0'] ?? 'infix';
      const type = typeByEditorValue[params.get('t') ?? '0'] ?? 'bytebeat';
      const sampleRate = Number(params.get('s') ?? 8000);
      const author = song.user?.login ?? 'greggman';
      const header = startsWithComment(decodedExpr)
        ? ['// source: greggman.com']
        : [`// ${song.title}`, '// source: greggman.com'];
      const expr = [...header, '', decodedExpr].join('\n');

      presets[key] = {
        type: 'bytebeat~',
        description: `${song.title} by ${author}`,
        data: {
          expr,
          type,
          syntax,
          sampleRate
        }
      };

      folders[getBucketName(song.size)].push(key);
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  const file = `/**
 * Generated from ${SOURCE_URL}.
 *
 * Regenerate with:
 *   node scripts/generate-greggman-bytebeat-presets.js
 */

export const GREGGMAN_BYTEBEAT_PRESETS = ${serialize(presets)} as const;

export const GREGGMAN_BYTEBEAT_PRESET_FOLDERS = ${serialize(folders)} as const;

export const GREGGMAN_BYTEBEAT_PRESET_KEYS = Object.values(
  GREGGMAN_BYTEBEAT_PRESET_FOLDERS
).flat();
`;

  writeFileSync(outputPath, file);
  execFileSync('./node_modules/.bin/prettier', ['--write', fileURLToPath(outputPath)], {
    stdio: 'ignore'
  });
  console.log(
    `Generated ${Object.keys(presets).length} Greggman bytebeat presets -> ${outputPath.pathname}`
  );
}

main();
