/**
 * Web Worker for executing Uiua code using the Uiua WASM module.
 * Offloads the ~10MB WASM module and compilation to a background thread.
 */

import { match } from 'ts-pattern';
import type { UiuaEvalResult, UiuaFormatResult, OutputItem } from '$lib/uiua/UiuaService';

// Message types sent from main thread to worker
export type UiuaWorkerMessage = { id: string } & (
  | { type: 'init' }
  | { type: 'eval'; code: string }
  | { type: 'evalWithValues'; code: string; values: unknown[] }
  | { type: 'format'; code: string }
  | { type: 'getVersion' }
);

// Message types sent from worker to main thread
export type UiuaWorkerResponse = { id: string } & (
  | { type: 'ready' }
  | { type: 'evalResult'; result: UiuaEvalResult }
  | { type: 'formatResult'; result: UiuaFormatResult }
  | { type: 'versionResult'; version: string }
  | { type: 'error'; error: string }
);

type UiuaModule = {
  eval_uiua: (code: string) => UiuaEvalResult;
  format_uiua: (code: string) => UiuaFormatResult;
  uiua_version: () => string;
};

// Global Uiua module instance
let uiuaModule: UiuaModule | null = null;
let loadPromise: Promise<UiuaModule> | null = null;

function postResponse(response: UiuaWorkerResponse) {
  self.postMessage(response);
}

async function loadModule(): Promise<UiuaModule> {
  // Dynamic import to load the WASM module
  const wasmModule = await import('../../assets/uiua/uiua_wasm.js');
  await wasmModule.default();

  return {
    eval_uiua: wasmModule.eval_uiua,
    format_uiua: wasmModule.format_uiua,
    uiua_version: wasmModule.uiua_version
  };
}

async function ensureModule(): Promise<UiuaModule> {
  if (uiuaModule) return uiuaModule;

  if (!loadPromise) {
    loadPromise = loadModule();
  }

  try {
    uiuaModule = await loadPromise;
    return uiuaModule;
  } catch (error) {
    loadPromise = null;
    throw error;
  }
}

/**
 * Convert JavaScript value to Uiua literal
 */
function toUiuaValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '0';
  }

  if (typeof value === 'number') {
    // Uiua uses ¯ for negative numbers
    if (value < 0) {
      return `¯${Math.abs(value)}`;
    }
    return String(value);
  }

  // Uiua strings use double quotes
  if (typeof value === 'string') {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  // Uiua arrays are space-separated in brackets
  if (Array.isArray(value)) {
    const items = value.map((v) => toUiuaValue(v)).join(' ');
    return `[${items}]`;
  }

  // Uiua uses 1/0 for booleans
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  // Fallback: convert to string
  return String(value);
}

/**
 * Convert WASM result to plain JS objects that can be cloned via postMessage.
 * WASM-bindgen returns Proxy objects that cannot be structured-cloned.
 * We need to deeply convert all values to plain JS types.
 */
function sanitizeOutputItem(item: OutputItem): OutputItem {
  switch (item.type) {
    case 'text':
      return { type: 'text', value: String(item.value) };
    case 'svg':
      return { type: 'svg', svg: String(item.svg) };
    case 'audio':
      return {
        type: 'audio',
        data: new Uint8Array(item.data),
        label: item.label ? String(item.label) : undefined
      };
    case 'image':
      return {
        type: 'image',
        data: new Uint8Array(item.data),
        label: item.label ? String(item.label) : undefined
      };
    case 'gif':
      return {
        type: 'gif',
        data: new Uint8Array(item.data),
        label: item.label ? String(item.label) : undefined
      };
    default:
      // Fallback: try JSON round-trip
      return JSON.parse(JSON.stringify(item));
  }
}

function sanitizeResult(result: UiuaEvalResult): UiuaEvalResult {
  // Convert stack items - result.stack might be a Proxy array
  const stack: OutputItem[] = [];
  for (let i = 0; i < result.stack.length; i++) {
    stack.push(sanitizeOutputItem(result.stack[i]));
  }

  if (result.success) {
    return {
      success: true,
      stack,
      formatted: result.formatted ? String(result.formatted) : undefined
    };
  }
  return {
    success: false,
    error: String(result.error),
    stack,
    formatted: result.formatted ? String(result.formatted) : undefined
  };
}

async function handleEval(id: string, code: string) {
  try {
    const module = await ensureModule();
    const result = module.eval_uiua(code);
    postResponse({ type: 'evalResult', id, result: sanitizeResult(result) });
  } catch (error) {
    postResponse({
      type: 'evalResult',
      id,
      result: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: []
      }
    });
  }
}

async function handleEvalWithValues(id: string, code: string, values: unknown[]) {
  try {
    // Replace $N placeholders with values (descending order to avoid prefix collisions)
    let substituted = code;
    const maxIndex = Math.min(values.length, 9);

    for (let i = maxIndex - 1; i >= 0; i--) {
      const placeholder = `$${i + 1}`;
      const uiuaValue = toUiuaValue(values[i]);
      substituted = substituted.replaceAll(placeholder, uiuaValue);
    }

    const module = await ensureModule();
    const result = module.eval_uiua(substituted);
    postResponse({ type: 'evalResult', id, result: sanitizeResult(result) });
  } catch (error) {
    postResponse({
      type: 'evalResult',
      id,
      result: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: []
      }
    });
  }
}

function sanitizeFormatResult(result: UiuaFormatResult): UiuaFormatResult {
  if (result.success) {
    return { success: true, formatted: String(result.formatted) };
  }
  return { success: false, error: String(result.error) };
}

async function handleFormat(id: string, code: string) {
  try {
    const module = await ensureModule();
    const result = module.format_uiua(code);
    postResponse({ type: 'formatResult', id, result: sanitizeFormatResult(result) });
  } catch (error) {
    postResponse({
      type: 'formatResult',
      id,
      result: {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

async function handleGetVersion(id: string) {
  try {
    const module = await ensureModule();
    const version = module.uiua_version();
    postResponse({ type: 'versionResult', id, version: String(version) });
  } catch (error) {
    postResponse({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Handle incoming messages from main thread
self.onmessage = async (event: MessageEvent<UiuaWorkerMessage>) => {
  const { id } = event.data;

  match(event.data)
    .with({ type: 'init' }, () => ensureModule())
    .with({ type: 'eval' }, ({ code }) => handleEval(id, code))
    .with({ type: 'evalWithValues' }, ({ code, values }) => handleEvalWithValues(id, code, values))
    .with({ type: 'format' }, ({ code }) => handleFormat(id, code))
    .with({ type: 'getVersion' }, () => handleGetVersion(id))
    .otherwise(() => {});
};

// Signal that worker is ready
postResponse({ type: 'ready', id: '0' });
console.log('[uiua worker] initialized');
