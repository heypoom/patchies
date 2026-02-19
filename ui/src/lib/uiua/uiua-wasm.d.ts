// Type declarations for uiua_wasm module
declare module '../../assets/uiua/uiua_wasm.js' {
  export function eval_uiua(code: string): string;
  export function format_uiua(code: string): string;
  export function uiua_version(): string;

  export default function init(): Promise<void>;
}
