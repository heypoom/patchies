/**
 * UiuaService - Lazy-loading Uiua WASM runtime
 *
 * Provides evaluation and formatting of Uiua code with media output support.
 * The 10MB WASM module is only loaded when first needed.
 *
 * Media detection (via SmartOutput):
 * - Audio: arrays with ≥11,025 elements and values in [-5, 5] → WAV Uint8Array
 * - Images: 2D/3D arrays ≥30×30 → PNG Uint8Array
 * - Animations: 4D arrays with ≥5 frames → GIF Uint8Array
 */

/**
 * Output item representing a single stack value after media detection
 */
export type OutputItem =
  | { type: 'text'; value: string }
  | { type: 'audio'; data: Uint8Array; label?: string }
  | { type: 'image'; data: Uint8Array; label?: string }
  | { type: 'gif'; data: Uint8Array; label?: string }
  | { type: 'svg'; svg: string };

/**
 * Result of evaluating Uiua code
 */
export type UiuaEvalResult =
  | { success: true; stack: OutputItem[]; formatted?: string }
  | { success: false; error: string; stack: OutputItem[]; formatted?: string };

/**
 * Result of formatting Uiua code
 */
export type UiuaFormatResult =
  | { success: true; formatted: string }
  | { success: false; error: string };

/**
 * Legacy result type for backward compatibility
 * @deprecated Use UiuaEvalResult instead
 */
export type UiuaResult =
  | { success: true; output: string; stack: OutputItem[]; formatted?: string }
  | { success: false; error: string };

type UiuaModule = {
  eval_uiua: (code: string) => UiuaEvalResult;
  format_uiua: (code: string) => UiuaFormatResult;
  uiua_version: () => string;
};

export class UiuaService {
  private static instance: UiuaService | null = null;

  private module: UiuaModule | null = null;
  private loadPromise: Promise<UiuaModule> | null = null;
  private _isLoaded = false;

  private constructor() {}

  static getInstance(): UiuaService {
    if (!UiuaService.instance) {
      UiuaService.instance = new UiuaService();
    }
    return UiuaService.instance;
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  /**
   * Lazy-load the Uiua WASM module
   */
  async ensureModule(): Promise<void> {
    if (this.module) return;

    if (!this.loadPromise) {
      this.loadPromise = this.loadModule();
    }

    try {
      this.module = await this.loadPromise;
      this._isLoaded = true;
    } catch (error) {
      // Clear the failed promise so future calls will retry
      this.loadPromise = null;
      throw error;
    }
  }

  private async loadModule(): Promise<UiuaModule> {
    // Dynamic import to enable lazy loading
    const wasmModule = await import('../../assets/uiua/uiua_wasm.js');

    await wasmModule.default();

    return {
      eval_uiua: wasmModule.eval_uiua,
      format_uiua: wasmModule.format_uiua,
      uiua_version: wasmModule.uiua_version
    };
  }

  /**
   * Get Uiua version string
   */
  async getVersion(): Promise<string> {
    await this.ensureModule();

    return this.module!.uiua_version();
  }

  /**
   * Evaluate Uiua code with full media support
   *
   * Returns stack items with automatic media detection:
   * - Audio arrays → { type: 'audio', data: Uint8Array }
   * - Image arrays → { type: 'image', data: Uint8Array }
   * - GIF arrays → { type: 'gif', data: Uint8Array }
   * - SVG → { type: 'svg', svg: string }
   * - Other → { type: 'text', value: string }
   */
  async eval(code: string): Promise<UiuaEvalResult> {
    await this.ensureModule();

    try {
      // Returns native JS object via serde-wasm-bindgen (no JSON.parse needed)
      return this.module!.eval_uiua(code);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: []
      };
    }
  }

  /**
   * Format Uiua code using the built-in formatter
   */
  async format(code: string): Promise<UiuaFormatResult> {
    await this.ensureModule();

    try {
      // Returns native JS object via serde-wasm-bindgen (no JSON.parse needed)
      return this.module!.format_uiua(code);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Substitute $N placeholders with values and evaluate
   * Only supports $1-$9 (single-digit placeholders)
   */
  async evalWithValues(code: string, values: unknown[]): Promise<UiuaEvalResult> {
    // Replace in descending order ($9 first, then $8, etc.) to avoid
    // prefix collisions (e.g., replacing $1 before $10 would corrupt $10)
    let substituted = code;
    const maxIndex = Math.min(values.length, 9);

    for (let i = maxIndex - 1; i >= 0; i--) {
      const placeholder = `$${i + 1}`;
      const value = values[i];

      // Convert value to Uiua-compatible representation
      const uiuaValue = this.toUiuaValue(value);

      substituted = substituted.replaceAll(placeholder, uiuaValue);
    }

    return this.eval(substituted);
  }

  /**
   * Convert JavaScript value to Uiua literal
   */
  private toUiuaValue(value: unknown): string {
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
      const items = value.map((v) => this.toUiuaValue(v)).join(' ');

      return `[${items}]`;
    }

    // Uiua uses 1/0 for booleans
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }

    // Fallback: convert to string
    return String(value);
  }
}
