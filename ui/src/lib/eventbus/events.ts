import type { SendMessageOptions } from '$lib/messages/MessageContext';

export type PatchiesEvent =
  | ConsoleOutputEvent
  | GLPreviewFrameCapturedEvent
  | PyodideConsoleOutputEvent
  | PyodideSendMessageEvent
  | NodePortCountUpdateEvent
  | NodeTitleUpdateEvent
  | NodeRunOnMountUpdateEvent
  | NodeHidePortsUpdateEvent
  | NodeInteractionUpdateEvent
  | NodeVideoOutputEnabledUpdateEvent
  | NodeMouseScopeUpdateEvent
  | NodeReplaceEvent
  | IframePostMessageEvent
  | FileRelinkedEvent
  | VfsPathRenamedEvent
  | InsertVfsFileToCanvasEvent
  | InsertPresetToCanvasEvent
  | WorkerSendMessageEvent
  | WorkerCallbackRegisteredEvent
  | WorkerFlashEvent
  | RequestWorkerVideoFramesEvent
  | RequestWorkerVideoFramesBatchEvent
  | MediaBunnyMetadataEvent
  | MediaBunnyFirstFrameEvent
  | MediaBunnyTimeUpdateEvent
  | MediaBunnyEndedEvent
  | MediaBunnyErrorEvent
  | AsmMachineStateChangedEvent
  | ObjectParamsChangedEvent
  | QuickAddConfirmedEvent
  | CodeCommitEvent;

export interface ConsoleOutputEvent {
  type: 'consoleOutput';
  nodeId: string;
  messageType: 'log' | 'warn' | 'error' | 'debug';
  timestamp: number;
  args: unknown[]; // Raw arguments for rich rendering
  lineErrors?: Record<number, string[]>; // Error messages grouped by line number
}

export interface PyodideConsoleOutputEvent {
  type: 'pyodideConsoleOutput';
  output: 'stdout' | 'stderr';
  message: string;
  nodeId: string;

  /** Mark that code execution is done. */
  finished?: boolean;
}

export interface PyodideSendMessageEvent {
  type: 'pyodideSendMessage';
  data: unknown;
  options?: SendMessageOptions;
  nodeId: string;
}

export interface GLPreviewFrameCapturedEvent {
  type: 'previewFrameCaptured';
  nodeId: string;
  requestId: string;
  success: boolean;
  bitmap?: ImageBitmap;
}

export interface NodePortCountUpdateEvent {
  type: 'nodePortCountUpdate';
  portType: 'message' | 'video';
  nodeId: string;
  inletCount: number;
  outletCount: number;
}

export interface NodeTitleUpdateEvent {
  type: 'nodeTitleUpdate';
  nodeId: string;
  title: string;
}

export interface NodeRunOnMountUpdateEvent {
  type: 'nodeRunOnMountUpdate';
  nodeId: string;
  runOnMount: boolean;
}

export interface NodeHidePortsUpdateEvent {
  type: 'nodeHidePortsUpdate';
  nodeId: string;
  hidePorts: boolean;
}

export type NodeInteractionMode = 'drag' | 'pan' | 'wheel' | 'interact';

export interface NodeInteractionUpdateEvent {
  type: 'nodeInteractionUpdate';
  nodeId: string;
  mode: NodeInteractionMode;
  enabled: boolean;
}

export interface NodeVideoOutputEnabledUpdateEvent {
  type: 'nodeVideoOutputEnabledUpdate';
  nodeId: string;
  videoOutputEnabled: boolean;
}

export interface NodeMouseScopeUpdateEvent {
  type: 'nodeMouseScopeUpdate';
  nodeId: string;
  scope: 'global' | 'local';
}

export interface NodeReplaceEvent {
  type: 'nodeReplace';
  nodeId: string;
  newType: string;
  newData: Record<string, unknown>;

  /** Maps old handle IDs to new handle IDs for edge reconnection */
  handleMapping?: Record<string, string>;
}

export interface IframePostMessageEvent {
  type: 'iframePostMessage';

  /** The source window that sent the postMessage */
  source: Window;

  /** The message data from postMessage */
  data: unknown;

  /** The origin of the message */
  origin: string;
}

export interface FileRelinkedEvent {
  type: 'fileRelinked';

  /** The VFS path that was relinked */
  path: string;
}

export interface VfsPathRenamedEvent {
  type: 'vfsPathRenamed';

  /** The old VFS path */
  oldPath: string;

  /** The new VFS path */
  newPath: string;
}

export interface InsertVfsFileToCanvasEvent {
  type: 'insertVfsFileToCanvas';

  /** The VFS path of the file to insert */
  vfsPath: string;
}

export interface InsertPresetToCanvasEvent {
  type: 'insertPresetToCanvas';

  /** The preset path (e.g., ['built-in', 'basics', 'sine']) */
  path: string[];

  /** The preset data */
  preset: {
    type: string;
    name: string;
    data: unknown;
  };
}

// Worker node events - for JavaScript execution in dedicated Web Workers

export interface WorkerSendMessageEvent {
  type: 'workerSendMessage';
  nodeId: string;
  data: unknown;
  options?: SendMessageOptions;
}

export interface WorkerCallbackRegisteredEvent {
  type: 'workerCallbackRegistered';
  nodeId: string;
  callbackType: 'message' | 'interval' | 'timeout';
}

export interface WorkerFlashEvent {
  type: 'workerFlash';
  nodeId: string;
}

export interface RequestWorkerVideoFramesEvent {
  type: 'requestWorkerVideoFrames';
  nodeId: string;
  sourceNodeIds: (string | null)[];
  resolution?: [number, number];
}

export interface RequestWorkerVideoFramesBatchEvent {
  type: 'requestWorkerVideoFramesBatch';
  requests: Array<{
    targetNodeId: string;
    sourceNodeIds: (string | null)[];
    resolution?: [number, number];
  }>;
}

// MediaBunny Worker events - for video playback in render worker

export interface MediaBunnyMetadataEvent {
  type: 'mediaBunnyMetadata';
  nodeId: string;
  metadata: {
    duration: number;
    width: number;
    height: number;
    frameRate: number;
    codec: string;
    hasAudio: boolean;
  };
}

export interface MediaBunnyFirstFrameEvent {
  type: 'mediaBunnyFirstFrame';
  nodeId: string;
}

export interface MediaBunnyTimeUpdateEvent {
  type: 'mediaBunnyTimeUpdate';
  nodeId: string;
  currentTime: number;
}

export interface MediaBunnyEndedEvent {
  type: 'mediaBunnyEnded';
  nodeId: string;
}

export interface MediaBunnyErrorEvent {
  type: 'mediaBunnyError';
  nodeId: string;
  error: string;
}

// Assembly machine events

export interface AsmMachineStateChangedEvent {
  type: 'asmMachineStateChanged';
  machineId: number;
}

// Object system events

export interface ObjectParamsChangedEvent {
  type: 'objectParamsChanged';
  nodeId: string;
  params: unknown[];
  index: number;
  value: unknown;
}

// Quick Add events - for recording history after Quick Add node is confirmed

export interface QuickAddConfirmedEvent {
  type: 'quickAddConfirmed';

  /**
   * The final node id.
   *
   * Differs from the original if node was
   * transformed during quick add.
   **/
  finalNodeId: string;
}

// Code editor events - for undo/redo tracking

export interface CodeCommitEvent {
  type: 'codeCommit';
  nodeId: string;
  /** The data field being updated (e.g., 'code', 'expr', 'message', 'prompt') */
  dataKey: string;
  oldValue: string;
  newValue: string;
}
