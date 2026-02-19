/**
 * UiuaService - Lazy-loading Uiua WASM runtime
 *
 * Provides evaluation and formatting of Uiua code.
 * The 10MB WASM module is only loaded when first needed.
 */

type UiuaModule = {
  eval_uiua: (code: string) => string;
  format_uiua: (code: string) => string;
  uiua_version: () => string;
};

export type UiuaResult = { success: true; output: string } | { success: false; error: string };

export type UiuaFormatResult =
  | { success: true; formatted: string }
  | { success: false; error: string };

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
   * Evaluate Uiua code
   */
  async eval(code: string): Promise<UiuaResult> {
    await this.ensureModule();

    try {
      const resultJson = this.module!.eval_uiua(code);

      return JSON.parse(resultJson) as UiuaResult;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Format Uiua code using the built-in formatter
   */
  async format(code: string): Promise<UiuaFormatResult> {
    await this.ensureModule();

    try {
      const resultJson = this.module!.format_uiua(code);

      return JSON.parse(resultJson) as UiuaFormatResult;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Substitute $N placeholders with values and evaluate
   * Only supports $1-$9 (single-digit placeholders)
   */
  async evalWithValues(code: string, values: unknown[]): Promise<UiuaResult> {
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
