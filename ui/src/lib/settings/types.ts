export type SettingsPersistence = 'none' | 'node' | 'kv';

interface SettingsFieldBase {
  key: string;
  label: string;
  description?: string;
  persistence?: SettingsPersistence;
}

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
  options: { label: string; value: string; description?: string }[];
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

export type SettingsField =
  | NumberField
  | StringField
  | BooleanField
  | SelectField
  | ColorField
  | SliderField;

export type SettingsSchema = SettingsField[];

export interface SettingsAPI {
  define(schema: SettingsField[]): Promise<void>;
  get(key: string): unknown;
  getAll(): Record<string, unknown>;
  onChange(
    callback: (key: string, value: unknown, allValues: Record<string, unknown>) => void
  ): void;
  clear(): void;
}
