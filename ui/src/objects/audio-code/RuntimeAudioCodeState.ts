import type { SettingsSchema } from '$lib/settings';
import { SettingsManager } from '$lib/settings';
import { createKVStore } from '$lib/storage';
import type { RuntimeDataBinding } from '$lib/audio';

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

  initialize(binding: RuntimeDataBinding): void {
    const { initialData: data, update } = binding;

    this.listener = update;
    this.code = typeof data.code === 'string' ? data.code : '';
    this.settings = isRecord(data.settings) ? data.settings : {};

    this.settingsSchema = Array.isArray(data.settingsSchema)
      ? (data.settingsSchema as SettingsSchema)
      : [];

    this.editorMetadata = pickEditorMetadata(data);

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

  setCode(code: string): void {
    this.code = code;
  }

  getCode(): string {
    return this.code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const editorMetadataKeys = ['messageInletCount', 'messageOutletCount', 'showAudioInput', 'title'];

const pickEditorMetadata = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    editorMetadataKeys.filter((key) => key in data).map((key) => [key, data[key]])
  );
