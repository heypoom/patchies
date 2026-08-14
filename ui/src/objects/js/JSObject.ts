import { JSRunner } from '$lib/js-runner/JSRunner';
import { getUserTags } from '$lib/runtime/services/graph-tags';
import { messages } from '$lib/objects/schemas/common';
import { SettingsManager, createSettingsAPI } from '$lib/settings';
import { createKVStore } from '$lib/storage';
import { createCustomConsole } from '$lib/utils/createCustomConsole';
import { match } from 'ts-pattern';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import type { RuntimeObject } from '$lib/objects/v2/interfaces/text-objects';

type JSObjectData = {
  code?: string;
  libraryName?: string | null;
  runOnMount?: boolean;
  executeCode?: number;
  inletCount?: number;
  outletCount?: number;
  isGraphSubscriptionActive?: boolean;
  isMessageCallbackActive?: boolean;
  isTimerCallbackActive?: boolean;
};

export class JSObject implements RuntimeObject<JSObjectData> {
  static type = 'js';
  static category = 'programming';
  static description = 'Run JavaScript and compose tagged graph fragments';
  static tags = ['programming', 'javascript', 'code'];

  static inlets: ObjectInlet[] = [
    { name: 'message', type: 'any', handle: { handleType: 'message' } }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'message', type: 'any', handle: { handleType: 'message' } }
  ];

  private subscriptions = new Set<() => void>();
  private lastExecuteCode: number | undefined;
  private settingsManager: SettingsManager;

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {
    this.settingsManager = new SettingsManager(
      () =>
        this.context.getData<JSObjectData & { settings?: Record<string, unknown> }>().settings ??
        {},
      (settings, settingsSchema) =>
        this.context.setData({ settings, settingsSchema }, { notifyUI: true }),
      createKVStore(nodeId)
    );
  }

  async create(): Promise<void> {
    const data = this.context.getData<JSObjectData>();
    this.lastExecuteCode = data.executeCode;

    if (data.runOnMount) {
      await this.execute();
    }
  }

  update(data: JSObjectData): void {
    if (data.executeCode === this.lastExecuteCode) return;

    this.lastExecuteCode = data.executeCode;
    void this.execute();
  }

  onMessage(data: unknown): void {
    match(data)
      .with(messages.setCode, ({ value }) =>
        this.context.setData({ code: value }, { notifyUI: true })
      )
      .with(messages.setSetting, ({ key, value }) => this.settingsManager.setValue(key, value))
      .with(messages.run, () => void this.execute())
      .with(messages.stop, () => this.stop())
      .otherwise(() => {});
  }

  destroy(): void {
    this.clearSubscriptions();

    JSRunner.getInstance().destroy(this.nodeId);
  }

  getInlets(): ObjectInlet[] {
    const inletCount = this.context.getData<JSObjectData>().inletCount ?? 1;

    return Array.from({ length: inletCount }, (_, index) => ({
      name: `in-${index + 1}`,
      type: 'any',
      handle: { handleType: 'message', handleId: index }
    }));
  }

  getOutlets(): ObjectOutlet[] {
    const outletCount = this.context.getData<JSObjectData>().outletCount ?? 1;

    return Array.from({ length: outletCount }, (_, index) => ({
      name: `out-${index + 1}`,
      type: 'any',
      handle: { handleType: 'message', handleId: index }
    }));
  }

  async runAsLibraryDependent(): Promise<void> {
    await this.execute({ rerunLibraryDependents: false });
  }

  private async execute({ rerunLibraryDependents = true } = {}): Promise<void> {
    this.clearSubscriptions();

    const messageContext = this.context.getMessageContext();

    messageContext.onMessageCallbackRegistered = () =>
      this.context.setData({ isMessageCallbackActive: true }, { notifyUI: true });

    messageContext.onIntervalCallbackRegistered = () =>
      this.context.setData({ isTimerCallbackActive: true }, { notifyUI: true });

    messageContext.onTimeoutCallbackRegistered = () =>
      this.context.setData({ isTimerCallbackActive: true }, { notifyUI: true });

    messageContext.onAnimationFrameCallbackRegistered = () =>
      this.context.setData({ isTimerCallbackActive: true }, { notifyUI: true });

    this.context.setData(
      {
        isGraphSubscriptionActive: false,
        isMessageCallbackActive: false,
        isTimerCallbackActive: false
      },
      { notifyUI: true }
    );

    const data = this.context.getData<JSObjectData>();
    const code = typeof data.code === 'string' ? data.code : '';
    const runner = JSRunner.getInstance();

    let libraryName: string | null = null;

    const processedCode = await runner.preprocessCode(code, {
      nodeId: this.nodeId,
      setLibraryName: (nextLibraryName) => {
        libraryName = nextLibraryName;

        const updates = nextLibraryName
          ? { libraryName: nextLibraryName, inletCount: 0, outletCount: 0 }
          : { libraryName: null };

        this.context.setData(updates, { notifyUI: true });
      }
    });

    if (processedCode === null) {
      if (rerunLibraryDependents && libraryName) {
        this.context.rerunLibraryDependents(this.nodeId, libraryName);
      }

      return;
    }

    await runner.executeJavaScript(this.nodeId, processedCode, {
      customConsole: createCustomConsole(this.nodeId),
      messageContext,

      setPortCount: (inletCount = 1, outletCount = 1) =>
        this.context.setData({ inletCount, outletCount }, { notifyUI: true }),

      setRunOnMount: (runOnMount = true) =>
        this.context.setData({ runOnMount }, { notifyUI: true }),

      setTitle: (title) => this.context.setData({ title }, { notifyUI: true }),
      setTags: (tags) => this.context.setData({ tags: getUserTags(tags) }, { notifyUI: true }),

      onGraphChange: (query, callback) => {
        const unsubscribe = this.context.subscribeGraph(query, callback);

        if (!unsubscribe) return () => {};

        this.subscriptions.add(unsubscribe);
        this.context.setData({ isGraphSubscriptionActive: true }, { notifyUI: true });

        return () => {
          this.subscriptions.delete(unsubscribe);
          unsubscribe();

          if (this.subscriptions.size === 0) {
            this.context.setData({ isGraphSubscriptionActive: false }, { notifyUI: true });
          }
        };
      },

      extraContext: { settings: createSettingsAPI(this.settingsManager) }
    });
  }

  private clearSubscriptions(): void {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }

    this.subscriptions.clear();
    this.context.setData({ isGraphSubscriptionActive: false }, { notifyUI: true });
  }

  private stop(): void {
    this.clearSubscriptions();

    const messageContext = this.context.getMessageContext();

    messageContext.runCleanupCallbacks();
    messageContext.clearTimers();
    messageContext.messageCallbacks = [];

    const updates = {
      isGraphSubscriptionActive: false,
      isMessageCallbackActive: false,
      isTimerCallbackActive: false
    };

    this.context.setData(updates, { notifyUI: true });
  }
}
