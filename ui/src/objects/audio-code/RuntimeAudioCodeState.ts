import type { SettingsSchema } from '$lib/settings';
import { SettingsManager } from '$lib/settings';
import { createKVStore } from '$lib/storage';

export class RuntimeAudioCodeState {
  private listener: (updates: Record<string, unknown>) => void = () => {};

  private code = '';
  private settings: Record<string, unknown> = {};
  private settingsSchema: SettingsSchema = [];
  private editorMetadata: Record<string, unknown> = {};

  readonly settingsManager: SettingsManager;

  constructor(nodeId: string) {
    const updateNodeSettings = (
      settings: Record<string, unknown>,
      settingsSchema: SettingsSchema
    ) => {
      this.settings = settings;
      this.settingsSchema = settingsSchema;

      this.publish({ settings, settingsSchema });
    };

    this.settingsManager = new SettingsManager(
      () => this.settings,
      updateNodeSettings,
      createKVStore(nodeId)
    );
  }

  initialize(data: Record<string, unknown>): void {
    this.code = typeof data.code === 'string' ? data.code : '';
    this.settings = isRecord(data.settings) ? data.settings : {};
    this.settingsSchema = Array.isArray(data.settingsSchema)
      ? (data.settingsSchema as SettingsSchema)
      : [];
    this.editorMetadata = pickEditorMetadata(data);
  }

  setCode(code: string): void {
    this.code = code;
  }

  getCode(): string {
    return this.code;
  }

  setListener(listener: (updates: Record<string, unknown>) => void): void {
    this.listener = listener;

    this.publish({
      settings: this.settings,
      settingsSchema: this.settingsSchema,
      ...this.editorMetadata
    });
  }

  publish(updates: Record<string, unknown>): void {
    this.editorMetadata = { ...this.editorMetadata, ...pickEditorMetadata(updates) };
    this.listener(updates);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const editorMetadataKeys = ['messageInletCount', 'messageOutletCount', 'showAudioInput', 'title'];

const pickEditorMetadata = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    editorMetadataKeys.filter((key) => key in data).map((key) => [key, data[key]])
  );
