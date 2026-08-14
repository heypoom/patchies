export type SettingsPersistence = 'none' | 'node' | 'kv';

export type SettingsVisibilityCondition =
  | {
      key: string;
      equals: unknown;
    }
  | {
      all: SettingsVisibilityCondition[];
    }
  | {
      not: SettingsVisibilityCondition;
    };

interface SettingsFieldBase {
  key: string;
  label: string;
  description?: string;
  persistence?: SettingsPersistence;
  visibleWhen?: SettingsVisibilityCondition;
}

export type SettingsOption = {
  label: string;
  value: string;
  description?: string;
};

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface NumberField extends SettingsFieldBase {
  type: 'number';
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface StringField extends SettingsFieldBase {
  type: 'string';
  default?: string;
  placeholder?: string;
}

export interface BooleanField extends SettingsFieldBase {
  type: 'boolean';
  default?: boolean;
}

export interface SelectField extends SettingsFieldBase {
  type: 'select';
  default?: string;
  options: string[] | SettingsOption[];
}

export interface ComboboxField extends SettingsFieldBase {
  type: 'combobox';
  default?: string;
  options: string[] | SettingsOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxVisibleOptions?: number;
}

export interface ColorField extends SettingsFieldBase {
  type: 'color';
  default?: string; // hex string, e.g. '#ff0000'
  presets?: string[]; // optional swatch grid, falls back to native picker
}

export interface SliderField extends SettingsFieldBase {
  type: 'slider';
  default?: number;
  min: number;
  max: number;
  step?: number;
}

export interface Vec2Field extends SettingsFieldBase {
  type: 'vec2';
  default?: [number, number];
  min?: [number, number];
  max?: [number, number];
  step?: number;
}

/**
 * Persist arbitrary JSON data without rendering a settings control.
 *
 * JSON fields deliberately omit UI-only properties such as `label` and
 * `visibleWhen`. Update them through `settings.set()`.
 */
export interface JsonField {
  key: string;
  type: 'json';
  default?: JsonValue;
  persistence?: SettingsPersistence;
}

export type SettingsField =
  | NumberField
  | StringField
  | BooleanField
  | SelectField
  | ComboboxField
  | ColorField
  | SliderField
  | Vec2Field
  | JsonField;

export type SettingsSchema = SettingsField[];

export interface SettingsAPI {
  define(schema: SettingsSchema): Promise<void>;
  get(key: string): unknown;
  getAll(): Record<string, unknown>;
  set(key: string, value: unknown): void;
  onChange(
    callback: (key: string, value: unknown, allValues: Record<string, unknown>) => void
  ): void;
  clear(): void;
}
