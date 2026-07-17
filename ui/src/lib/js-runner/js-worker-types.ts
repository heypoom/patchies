import type { AudioAnalysisFormat, AudioAnalysisType } from '$lib/audio/AudioAnalysisSystem';
import type { PrimaryButton } from '$lib/eventbus/events';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import type { Message } from '$lib/messages/MessageSystem';
import type { ProfilerCategory, TimingStats } from '$lib/profiler/types';

/** Render connection for direct worker-to-render messaging. */
export interface RenderConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
  inletKey?: string;
}

export type WorkerMessage = { nodeId: string } & (
  | { type: 'setPatchId'; patchId: string }
  | { type: 'executeCode'; code: string; processedCode: string }
  | { type: 'incomingMessage'; data: unknown; meta: Omit<Message, 'data'> }
  | { type: 'updateModule'; moduleName: string; code: string | null }
  | { type: 'cleanup' }
  | { type: 'destroy' }
  | { type: 'vfsUrlResolved'; requestId: string; url?: string; error?: string }
  | { type: 'llmConfig'; requestId: string; text?: string; error?: string }
  | { type: 'setFFTData'; analysisType: string; format: string; array: Uint8Array | Float32Array }
  | { type: 'videoFramesReady'; frames: (ImageBitmap | null)[]; timestamp: number }
  | { type: 'setRenderPort' }
  | { type: 'updateRenderConnections'; connections: RenderConnection[] }
  | { type: 'setWorkerPort'; targetNodeId?: string; sourceNodeId?: string }
  | { type: 'updateWorkerConnections'; connections: RenderConnection[] }
  | { type: 'channelMessage'; channel: string; data: unknown; sourceNodeId: string }
  | { type: 'profilerEnable'; enabled: boolean }
  | { type: 'settingsValuesInit'; requestId: string; values: Record<string, unknown> }
  | { type: 'settingsValueChanged'; key: string; value: unknown }
  | { type: 'superSonicChannelReady'; requestId: string; error?: string }
);

export type WorkerResponse = { nodeId: string } & (
  | { type: 'ready' }
  | {
      type: 'executionComplete';
      success: boolean;
      error?: string;
      initDurationMs?: number;
    }
  | { type: 'profilerStats'; category: ProfilerCategory; stats: TimingStats }
  | {
      type: 'consoleOutput';
      level: 'log' | 'warn' | 'error' | 'debug' | 'info';
      args: unknown[];
      lineErrors?: Record<number, string[]>;
    }
  | { type: 'sendMessage'; data: unknown; options?: SendMessageOptions }
  | { type: 'setPortCount'; inletCount: number; outletCount: number }
  | { type: 'setTitle'; title: string }
  | { type: 'setPrimaryButton'; primaryButton: PrimaryButton }
  | { type: 'setRunOnMount'; runOnMount: boolean }
  | { type: 'callbackRegistered'; callbackType: 'message' | 'interval' | 'timeout' }
  | { type: 'flash' }
  | { type: 'fftEnabled'; enabled: boolean }
  | { type: 'registerFFTRequest'; analysisType: AudioAnalysisType; format: AudioAnalysisFormat }
  | { type: 'resolveVfsUrl'; requestId: string; path: string }
  | { type: 'llmRequest'; requestId: string; prompt: string; imageNodeId?: string; model?: string }
  | { type: 'setVideoCount'; inletCount: number; outletCount: number }
  | { type: 'videoFrameCallbackRegistered'; resolution?: [number, number] }
  | { type: 'requestVideoFrames'; requestId: string; resolution?: [number, number] }
  | { type: 'sendToChannel'; channel: string; data: unknown }
  | { type: 'subscribeChannel'; channel: string }
  | { type: 'unsubscribeChannel'; channel: string }
  | { type: 'settingsDefine'; requestId: string; schema: unknown[] }
  | { type: 'settingsSet'; key: string; value: unknown }
  | { type: 'settingsClear' }
  | { type: 'requestSuperSonicChannel'; requestId: string }
);
