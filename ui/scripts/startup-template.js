import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** @param {string} path */
const sourcePath = (path) => fileURLToPath(new URL(path, import.meta.url));

const shellPath = sourcePath('../src/app.html');
const stylesPath = sourcePath('../src/lib/startup/startup-loader.css');
const scriptPath = sourcePath('../src/lib/startup/startup-loader.ts');

// SvelteKit watches generated/ during development and ignores its other output folders.
export const startupTemplatePath = sourcePath('../.svelte-kit/generated/startup-app.html');
export const startupTemplateSources = [shellPath, stylesPath, scriptPath];

export function readStartupTemplate() {
  const styles = readFileSync(stylesPath, 'utf8');

  const script = ts.transpileModule(readFileSync(scriptPath, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    fileName: scriptPath
  }).outputText;

  return readFileSync(shellPath, 'utf8')
    .replace('<!-- patchies:startup-styles -->', () => `<style>\n${styles}</style>`)
    .replace('<!-- patchies:startup-script -->', () => `<script>\n${script}</script>`);
}

export function writeStartupTemplate() {
  const template = readStartupTemplate();

  if (existsSync(startupTemplatePath) && readFileSync(startupTemplatePath, 'utf8') === template) {
    return;
  }

  mkdirSync(dirname(startupTemplatePath), { recursive: true });
  writeFileSync(startupTemplatePath, template);
}
