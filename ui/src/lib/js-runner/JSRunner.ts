import { getImportedModuleNames, getModuleNameByNode, isSnippetModule } from './js-module-utils';
import { opencv } from './opencv';
import { MessageContext } from '$lib/messages/MessageContext';
import { profiler, typeFromNodeId } from '$lib/profiler';
import { debounce } from 'lodash';
import { createVfs, revokeObjectUrls } from '$lib/vfs';
import { handleCodeError } from './handleCodeError';
import { logger } from '$lib/utils/logger';
import { createKVStore } from '$lib/storage';
import { Transport } from '$lib/transport';
import { LookaheadClockScheduler, type ClockState } from '$lib/transport/ClockScheduler';
import { SchedulerRegistry } from '$lib/transport/SchedulerRegistry';
import type { GraphChangeCallback, GraphChangeQuery } from '$lib/runtime/services/GraphObserver';
import { VirtualFilesystem } from '$lib/vfs/VirtualFilesystem';
import { isEmbeddedVFSEntry } from '$lib/vfs/types';
import { JSModuleResolver } from './JSModuleResolver';

import type { FBOFormat } from '$lib/rendering/types';
import type { createLLMFunction } from '$lib/ai/google';

type LLMFunction = ReturnType<typeof createLLMFunction>;

export type ExternalImportSpecifier =
  | { type: 'default'; localName: string }
  | { type: 'namespace'; localName: string }
  | { type: 'named'; importedName: string; localName: string };

export type ExternalImport = {
  source: string;
  specifiers: ExternalImportSpecifier[];
};

export const lowerExternalImports = (code: string, importMappings: ExternalImport[]): string => {
  let transformedCode = code;

  const importsBySource = new Map<string, ExternalImportSpecifier[]>();

  for (const { source, specifiers } of importMappings) {
    const imports = importsBySource.get(source) ?? [];
    imports.push(...specifiers);
    importsBySource.set(source, imports);
  }

  let importIndex = 0;

  for (const [source, specifiers] of importsBySource) {
    const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const importExpression = source.startsWith('npm:')
      ? `esm('${source.replace('npm:', '')}')`
      : `import('${source}')`;
    const importRegex = new RegExp(
      `^[\\t ]*import\\s+(?:[\\w$]+(?:\\s*,\\s*)?)?(?:\\*\\s+as\\s+[\\w$]+|\\{[^}]*\\}|[\\w$]+)\\s+from\\s+['"]${escapedSource}['"][\\t ]*;?[\\t ]*(?:\\r?\\n|$)`,
      'gm'
    );
    const moduleName = `__patchies_import_${importIndex++}`;
    const namedImports = specifiers.filter(
      (specifier): specifier is Extract<ExternalImportSpecifier, { type: 'named' }> =>
        specifier.type === 'named'
    );
    const replacements = [`const ${moduleName} = await ${importExpression};`];

    for (const specifier of specifiers) {
      if (specifier.type === 'default') {
        replacements.push(`const ${specifier.localName} = ${moduleName}.default;`);
      } else if (specifier.type === 'namespace') {
        replacements.push(`const ${specifier.localName} = ${moduleName};`);
      }
    }

    if (namedImports.length > 0) {
      const bindings = namedImports.map(({ importedName, localName }) =>
        importedName === localName ? importedName : `${importedName}: ${localName}`
      );
      replacements.push(`const { ${bindings.join(', ')} } = ${moduleName};`);
    }

    let replacedBindingImport = false;
    transformedCode = transformedCode.replace(importRegex, () => {
      if (replacedBindingImport) return '';

      replacedBindingImport = true;
      return `${replacements.join('\n')}\n`;
    });

    const sideEffectImportRegex = new RegExp(
      `^[\\t ]*import\\s+['"]${escapedSource}['"][\\t ]*;?[\\t ]*(?:\\r?\\n|$)`,
      'gm'
    );
    transformedCode = transformedCode.replace(
      sideEffectImportRegex,
      specifiers.length > 0 ? '' : `await ${importExpression};\n`
    );
  }

  return transformedCode;
};

export interface JSRunnerOptions {
  customConsole?: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };

  setPortCount?: (inletCount?: number, outletCount?: number) => void;
  setRunOnMount?: (runOnMount?: boolean) => void;
  setTitle?: (title: string) => void;
  setTextureFormat?: (format: FBOFormat) => void;
  setResolution?: (widthOrPreset: number | string, height?: number) => void;
  setHidePorts?: (hidePorts: boolean) => void;
  setTags?: (tags: string[]) => void;
  onGraphChange?: (query: GraphChangeQuery, callback: GraphChangeCallback) => () => void;
  messageContext?: MessageContext;
  extraContext?: Record<string, unknown>;

  /** Skip MessageContext setup - use when caller manages their own MessageContext */
  skipMessageContext?: boolean;

  /** Called when clock scheduler listeners are registered — used to show active indicator */
  onSchedulerCallbackRegistered?: () => void;
}

/**
 * If we are using the no message context execution mode,
 * e.g. `filter` object, some methods will not be available.
 */
const NOOP_MESSAGE_CONTEXT = {
  send: () => {},
  onMessage: () => {},
  setInterval: () => 0,
  setTimeout: () => 0,
  delay: () => Promise.resolve(),
  requestAnimationFrame: () => 0,
  onCleanup: () => {},
  fft: () => new Float32Array(0)
};

export class JSRunner {
  private static instance: JSRunner;

  public moduleProviderUrl = `https://esm.sh/`;
  public modules: Map<string, string> = new Map();
  public moduleResolver = new JSModuleResolver(this.modules);

  private messageContextMap: Map<string, MessageContext> = new Map();
  private lookaheadClockSchedulerMap: Map<string, LookaheadClockScheduler> = new Map();

  private sendToRenderWorker?: (moduleName: string, code: string | null) => void;
  private sendToRenderWorkerSlow?: (moduleName: string, code: string | null) => void;
  private moduleListeners = new Set<(moduleName: string, code: string | null) => void>();

  constructor() {
    this.moduleResolver.setVfsModuleLoader(async (path) => {
      const blob = await VirtualFilesystem.getInstance().resolve(path);

      return blob.text();
    });
  }

  async gen(inputName: string): Promise<string> {
    await this.prepareModuleGraph(inputName);

    try {
      const { rollup } = await import('@rollup/browser');

      const importMappings: ExternalImport[] = [];

      const bundle = await rollup({
        input: inputName,
        plugins: [
          {
            name: 'loader',

            moduleParsed(moduleInfo) {
              const body = moduleInfo.ast?.body;
              if (!body) return;

              for (const node of body) {
                if (node.type === 'ImportDeclaration') {
                  const importSource = node.source.value;

                  if (
                    typeof importSource !== 'string' ||
                    (!importSource.startsWith('npm:') &&
                      !importSource.startsWith('http://') &&
                      !importSource.startsWith('https://'))
                  ) {
                    continue;
                  }

                  importMappings.push({
                    source: importSource,
                    specifiers: node.specifiers.map((specifier): ExternalImportSpecifier => {
                      if (specifier.type === 'ImportDefaultSpecifier') {
                        return { type: 'default', localName: specifier.local.name };
                      }

                      if (specifier.type === 'ImportNamespaceSpecifier') {
                        return { type: 'namespace', localName: specifier.local.name };
                      }

                      return {
                        type: 'named',
                        importedName:
                          specifier.imported.type === 'Identifier'
                            ? specifier.imported.name
                            : String(specifier.imported.value),
                        localName: specifier.local.name
                      };
                    })
                  });
                }
              }
            },
            resolveId: async (source, importer) => {
              if (!importer && source === inputName) return source;

              const resolved = await this.moduleResolver.resolve(
                source,
                importer ?? inputName,
                inputName
              );

              return resolved.external ? { id: resolved.id, external: true } : resolved.id;
            },
            load: async (id) => {
              return this.moduleResolver.load(id, inputName);
            },
            renderChunk(code) {
              return lowerExternalImports(code, importMappings);
            }
          }
        ]
      });

      const { output } = await bundle.generate({ format: 'es' });

      return output[0].code;
    } catch (error) {
      console.warn('rollup bundling error', error);

      throw error;
    }
  }

  private async prepareModuleGraph(inputName: string): Promise<void> {
    const visited = new Set<string>();

    const visit = async (moduleName: string): Promise<void> => {
      if (visited.has(moduleName)) return;

      visited.add(moduleName);

      const code = await this.moduleResolver.load(moduleName, inputName);
      if (code === null) return;

      for (const specifier of getImportedModuleNames(code)) {
        const resolved = await this.moduleResolver.resolve(specifier, moduleName, inputName);
        if (!resolved.external) await visit(resolved.id);
      }
    };

    await visit(inputName);
  }

  async preprocessCode(code: string, options: { nodeId: string }): Promise<string> {
    const { nodeId } = options;

    const isModule = isSnippetModule(code);

    if (isModule) {
      const moduleName = getModuleNameByNode(nodeId);

      this.setModuleAndSync(moduleName, code);

      return this.gen(moduleName);
    }

    return code;
  }

  /** Bundle a registered Patch module without creating a node-owned runtime. */
  async validatePatchModule(path: string): Promise<void> {
    if (!path.startsWith('patch://')) {
      throw new Error(`Only Patch modules can be validated: ${path}`);
    }

    await this.gen(path);
  }

  getMessageContext(nodeId: string): MessageContext {
    if (!this.messageContextMap.has(nodeId)) {
      this.messageContextMap.set(nodeId, new MessageContext(nodeId));
    }

    return this.messageContextMap.get(nodeId)!;
  }

  /**
   * Get or create a look-ahead clock scheduler for a node.
   *
   * Schedulers persist across code executions but are cleaned up when the node is destroyed.
   * Each scheduler self-ticks via setInterval (~25ms) — no external tick loop needed.
   */
  getLookaheadClockScheduler(nodeId: string): LookaheadClockScheduler {
    if (!this.lookaheadClockSchedulerMap.has(nodeId)) {
      const clockStateProvider = (): ClockState => ({
        time: Transport.seconds,
        beat: Transport.beat,
        bpm: Transport.bpm,
        isPlaying: Transport.isPlaying,
        playState: Transport.isPlaying ? 'playing' : Transport.seconds === 0 ? 'stopped' : 'paused',
        phase: Transport.phase,
        beatsPerBar: Transport.beatsPerBar
      });

      const scheduler = new LookaheadClockScheduler(
        clockStateProvider,
        25,
        0.1,
        logger.ofNode(nodeId)
      );

      scheduler.start();

      this.lookaheadClockSchedulerMap.set(nodeId, scheduler);
      SchedulerRegistry.getInstance().register(nodeId, scheduler);
    }

    return this.lookaheadClockSchedulerMap.get(nodeId)!;
  }

  destroy(nodeId: string): void {
    // Destroy context before removing from map (runs cleanup callbacks)
    const context = this.messageContextMap.get(nodeId);
    if (context) {
      context.destroy();
    }

    this.messageContextMap.delete(nodeId);

    // Clean up scheduler (stops interval + cancels all callbacks)
    const scheduler = this.lookaheadClockSchedulerMap.get(nodeId);
    if (scheduler) {
      SchedulerRegistry.getInstance().unregister(nodeId);
      scheduler.dispose();
      this.lookaheadClockSchedulerMap.delete(nodeId);
    }

    revokeObjectUrls(nodeId);

    const moduleName = getModuleNameByNode(nodeId);
    if (this.modules.has(moduleName)) {
      this.setModuleAndSync(moduleName, null);
    }
  }

  /**
   * Sets up the message context for the node's execution.
   * Returns the messaging context for the node.
   */
  private setupMessageContext(
    nodeId: string,
    messageContext: MessageContext = this.getMessageContext(nodeId)
  ) {
    messageContext.runCleanupCallbacks();
    messageContext.clearTimers();
    messageContext.messageCallbacks = [];

    return messageContext.getContext();
  }

  executeJavaScript(nodeId: string, code: string, options: JSRunnerOptions = {}) {
    const {
      customConsole = console,
      setPortCount = () => {},
      setRunOnMount = () => {},
      setTitle = () => {},
      setTextureFormat = () => {},
      setResolution = () => {},
      setHidePorts = () => {},
      setTags = () => {},
      onGraphChange = () => () => {},
      messageContext,
      extraContext = {},
      skipMessageContext = false,
      onSchedulerCallbackRegistered
    } = options;

    const messageSystemContext = skipMessageContext
      ? NOOP_MESSAGE_CONTEXT
      : this.setupMessageContext(nodeId, messageContext);

    // Clear stale logs from last run, so only errors from the current run are visible
    if (!skipMessageContext) {
      logger.clearNodeLogs(nodeId);
    }

    // Set up error handler for recv() callbacks
    if (!skipMessageContext) {
      const runnerMessageContext = messageContext ?? this.getMessageContext(nodeId);

      runnerMessageContext.onCallbackError = (error) => {
        handleCodeError(error, code, nodeId, customConsole);
      };
    }

    // Set up clock scheduler - cancel previous callbacks before executing new code
    const scheduler = this.getLookaheadClockScheduler(nodeId);
    scheduler.cancelAll();

    const functionParams = [
      'console',
      'send',
      'onMessage',
      'setInterval',
      'setTimeout',
      'delay',
      'requestAnimationFrame',
      'onCleanup',
      'fft',
      'llm',
      'kv',
      'setPortCount',
      'setRunOnMount',
      'setTitle',
      'setTextureFormat',
      'setResolution',
      'setHidePorts',
      'setTags',
      'onGraphChange',
      'vfs',
      'clock',
      'opencv',
      ...Object.keys(extraContext)
    ];

    // Clock object for transport-synced timing with scheduling methods
    const clock = {
      // Read properties
      get time() {
        return Transport.seconds;
      },
      get ticks() {
        return Transport.ticks;
      },
      get beat() {
        return Transport.beat;
      },
      get phase() {
        return Transport.phase;
      },
      get bpm() {
        return Transport.bpm;
      },
      get isPlaying() {
        return Transport.isPlaying;
      },
      get bar() {
        return Transport.bar;
      },
      get beatsPerBar() {
        return Transport.beatsPerBar;
      },
      get timeSignature(): [number, number] {
        return [Transport.beatsPerBar, Transport.denominator];
      },

      // Per-node subdivision helpers (computed locally from ticks + ppq)
      subdiv(n: number) {
        const ticks = Transport.ticks;
        const ppq = Transport.ppq;
        const ticksPerSubdiv = ppq / n;
        return Math.floor((ticks % ppq) / ticksPerSubdiv);
      },
      subdivPhase(n: number) {
        const ticks = Transport.ticks;
        const ppq = Transport.ppq;
        const ticksPerSubdiv = ppq / n;
        return ((ticks % ppq) % ticksPerSubdiv) / ticksPerSubdiv;
      },

      // Control methods
      play: () => Transport.play(),
      pause: () => Transport.pause(),
      stop: () => Transport.stop(),
      setBpm: (bpm: number) => Transport.setBpm(bpm),
      setTimeSignature: (numerator: number, denominator = 4) =>
        Transport.setTimeSignature(numerator, denominator),
      seek: (time: number) => Transport.seek(time),

      // Scheduling methods
      onBeat: (...args: Parameters<typeof scheduler.onBeat>) => {
        onSchedulerCallbackRegistered?.();

        return scheduler.onBeat(...args);
      },
      schedule: scheduler.schedule.bind(scheduler),
      every: (...args: Parameters<typeof scheduler.every>) => {
        onSchedulerCallbackRegistered?.();

        return scheduler.every(...args);
      },
      onPlayStateChange: (...args: Parameters<typeof scheduler.onPlayStateChange>) => {
        onSchedulerCallbackRegistered?.();

        return scheduler.onPlayStateChange(...args);
      },
      cancel: scheduler.cancel.bind(scheduler),
      cancelAll: scheduler.cancelAll.bind(scheduler),
      setTimelineStyle: scheduler.setTimelineStyle.bind(scheduler)
    };

    let llmFn: LLMFunction | undefined;

    async function llm(...args: Parameters<LLMFunction>) {
      if (!llmFn) {
        const { createLLMFunction } = await import('$lib/ai/google');
        llmFn = createLLMFunction();
      }

      return llmFn(...args);
    }

    const functionArgs = [
      customConsole,
      messageSystemContext.send,
      messageSystemContext.onMessage,
      messageSystemContext.setInterval,
      messageSystemContext.setTimeout,
      messageSystemContext.delay,
      messageSystemContext.requestAnimationFrame,
      messageSystemContext.onCleanup,
      messageSystemContext.fft,
      llm,
      createKVStore(nodeId),
      setPortCount,
      setRunOnMount,
      setTitle,
      setTextureFormat,
      setResolution,
      setHidePorts,
      setTags,
      onGraphChange,
      createVfs(nodeId),
      clock,
      () => opencv((name) => import(/* @vite-ignore */ `${this.moduleProviderUrl}${name}`)),
      ...Object.values(extraContext)
    ];

    const codeWithWrapper = `
			const inner = async () => {
				var recv = onMessage; // alias
				var esm = (name) => import('${this.moduleProviderUrl}' + name);

				${code}
			}

			return inner()
		`;

    const userFunction = new Function(...functionParams, codeWithWrapper);

    if (profiler.enabled && !options.skipMessageContext) {
      const t0 = performance.now();
      const result = userFunction(...functionArgs) as Promise<unknown> | unknown;
      const record = () =>
        profiler.record(nodeId, typeFromNodeId(nodeId), 'init', performance.now() - t0);
      if (result instanceof Promise) {
        result.then(record, record);
      } else {
        record();
      }
      return result;
    }

    return userFunction(...functionArgs);
  }

  setModuleAndSync(moduleName: string, code: string | null): void {
    if (code === null) {
      this.modules.delete(moduleName);
    } else {
      this.modules.set(moduleName, code);
    }

    this.notifyModuleChanged(moduleName, code);
  }

  setVfsModuleLoader(loader: (path: string, importerId: string) => Promise<string>): void {
    this.moduleResolver.setVfsModuleLoader(loader);
  }

  async syncPatchModules(vfs: VirtualFilesystem = VirtualFilesystem.getInstance()): Promise<void> {
    const nextModules = new Map(
      [...vfs.getAllEntries()].flatMap(([path, entry]) =>
        isEmbeddedVFSEntry(entry) && /\.(?:js|mjs)$/.test(path)
          ? [[path, entry.content] as const]
          : []
      )
    );

    for (const moduleName of [...this.modules.keys()]) {
      if (moduleName.startsWith('patch://') && !nextModules.has(moduleName)) {
        this.setModuleAndSync(moduleName, null);
      }
    }

    for (const [moduleName, code] of nextModules) {
      this.setModuleAndSync(moduleName, code);
    }

    await this.ensureRenderWorker();
  }

  subscribeModules(listener: (moduleName: string, code: string | null) => void): () => void {
    this.moduleListeners.add(listener);

    for (const [moduleName, code] of this.modules) listener(moduleName, code);

    return () => this.moduleListeners.delete(listener);
  }

  private notifyModuleChanged(moduleName: string, code: string | null): void {
    this.sendToRenderWorker?.(moduleName, code);
    this.notifyModuleListeners(moduleName, code);
  }

  private notifyModuleListeners(moduleName: string, code: string | null): void {
    for (const listener of this.moduleListeners) listener(moduleName, code);
  }

  async ensureRenderWorker() {
    if (typeof window === 'undefined' || this.sendToRenderWorker) return;

    const { GLSystem } = await import('../canvas/GLSystem');

    this.sendToRenderWorker = (moduleName: string, code: string | null) =>
      GLSystem.getInstance().send('updateJSModule', { moduleName, code });

    this.sendToRenderWorkerSlow = debounce(this.sendToRenderWorker, 500);

    for (const [moduleName, code] of this.modules) {
      this.sendToRenderWorker(moduleName, code);
    }
  }

  public static getInstance(): JSRunner {
    if (!JSRunner.instance) {
      JSRunner.instance = new JSRunner();
    }

    return JSRunner.instance;
  }
}
