<script lang="ts">
  import { Play, X } from '@lucide/svelte/icons';
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { UxnEmulator, type UxnEmulatorOptions } from '$lib/uxn/UxnEmulator';
  import CodeEditor from '../CodeEditor.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { uxnMessages } from '$lib/objects/schemas/uxn';
  import * as Tooltip from '../ui/tooltip';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import UxnCompactLayout from './uxn/UxnCompactLayout.svelte';
  import UxnFullLayout from './uxn/UxnFullLayout.svelte';
  import { VirtualFilesystem } from '$lib/vfs';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      fileName?: string;
      code?: string;
      showConsole?: boolean;
      showEditor?: boolean;
      consoleOutput?: string;
      /** Compact mode hides the screen and disables screen/input devices */
      compact?: boolean;
      /** VFS path to the ROM file for persistence */
      vfsPath?: string;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  let canvas: HTMLCanvasElement | undefined = $state();
  let previewContainer: HTMLDivElement | null = $state(null);
  let emulator: UxnEmulator | null = $state(null);
  let consoleOutput = $state(data.consoleOutput || '');
  let showConsole = $state(data.showConsole ?? false);
  let showEditor = $state(data.showEditor ?? false);
  let isPaused = $state(false);
  let isCompact = $state(data.compact ?? false);
  let errorMessage = $state<string | null>(null);
  let cleanupEventHandlers: (() => void) | null | undefined = null;
  let messageContext: MessageContext;
  let fileInputRef: HTMLInputElement;
  let isDragging = $state(false);
  let glSystem = GLSystem.getInstance();
  let bitmapFrameId: number | null = null;
  const fileName = $derived(data.fileName || 'No ROM loaded');
  const code = $derived(data.code || '');

  const editorGap = 10;
  let previewContainerWidth = $state(0);

  function measureContainerWidth() {
    if (previewContainer) {
      previewContainerWidth = previewContainer.clientWidth;
    }
  }

  // Compact mode button width matches CodeBlockBase: 100px
  const compactWidth = 100;

  let editorLeftPos = $derived.by(() => {
    if (isCompact) {
      return compactWidth + editorGap;
    }

    return (previewContainerWidth || 512) + editorGap;
  });

  const handleConsoleOutput = (output: string, isError: boolean) => {
    consoleOutput += output;
    updateNodeData(nodeId, { consoleOutput, showConsole });

    // Send console output as message
    if (messageContext) {
      messageContext.send(output);
    }
  };

  const handleMessage: MessageCallbackFn = async (message) => {
    match(message)
      .with(uxnMessages.string, async (input) => {
        // Check if input is a URL
        if (input.startsWith('http://') || input.startsWith('https://')) {
          await loadFromUrl(input);
        } else if (input.startsWith('user://') || input.startsWith('obj://')) {
          // VFS path
          await loadFromVfsPath(input);
        } else {
          // Treat as Uxntal code to assemble
          await assembleAndLoadCode(input);
        }
      })
      .with(uxnMessages.bang, async () => {
        // On BANG: prioritize code, fallback to vfsPath
        if (code && !data.vfsPath) {
          await assembleAndLoadCode(code);
        } else if (data.vfsPath) {
          await loadFromVfsPath(data.vfsPath);
        }
      })
      .with(uxnMessages.loadUrl, ({ url }) => loadFromUrl(url))
      .with(uxnMessages.loadCode, ({ code }) => assembleAndLoadCode(code))
      .with(uxnMessages.uint8Array, (rom) => loadROM(rom))
      .with(uxnMessages.file, async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        loadROM(new Uint8Array(arrayBuffer));
      })
      .otherwise(() => {
        console.warn('UxnNode: Unsupported message type', message);
      });
  };

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    measureContainerWidth();
    if (!isCompact) {
      glSystem.upsertNode(nodeId, 'img', {});
      startBitmapUpload();
    }

    (async () => {
      try {
        const options: UxnEmulatorOptions = {
          nodeId,
          canvasElement: isCompact ? undefined : canvas,
          onConsoleOutput: handleConsoleOutput,
          headless: isCompact
        };

        emulator = new UxnEmulator(options);
        await emulator.init(options);

        // Load ROM based on priority: CODE > VFS
        if (data.code && !data.vfsPath) {
          // If code exists and no vfsPath, assemble and load the code
          await assembleAndLoadCode(data.code);
        } else if (data.vfsPath) {
          // If vfsPath exists, load from VFS (persisted ROM or URL)
          await loadFromVfsPath(data.vfsPath);
        }

        // Set up event handlers
        const cleanup = setupEventHandlers();

        if (cleanup) {
          cleanupEventHandlers = cleanup;
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
    })();

    return () => {
      messageContext.queue.removeCallback(handleMessage);
    };
  });

  onDestroy(() => {
    stopBitmapUpload();
    cleanupEventHandlers?.();
    emulator?.destroy();
    glSystem.removeNode(nodeId);
    messageContext?.destroy();
  });

  function shouldTrapKey(event: KeyboardEvent): boolean {
    // Keys handled by ControllerDevice.on_keybutton:
    // - Modifiers: Control, Alt, Shift, Meta (cmd)
    // - Navigation: Home, Arrow keys
    // - Escape
    // - Printable characters (event.key.length == 1)
    // - Special keys
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return true;
    }
    const key = event.key;
    if (key === 'Escape' || key === 'Home') {
      return true;
    }
    if (key.startsWith('Arrow')) {
      return true; // ArrowUp, ArrowDown, ArrowLeft, ArrowRight
    }
    if (key.length === 1) {
      return true; // Printable character
    }
    // Special keys like Tab, Enter, Backspace, etc.
    const specialKeys = [
      'Tab',
      'Enter',
      'Backspace',
      'Delete',
      'Insert',
      'PageUp',
      'PageDown',
      'End'
    ];
    if (specialKeys.includes(key)) {
      return true;
    }
    return false;
  }

  function setupEventHandlers() {
    if (!canvas || !emulator) return;

    // Keyboard events
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldTrapKey(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (emulator) {
        emulator.controller.on_keybutton(event);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (shouldTrapKey(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (emulator) {
        emulator.controller.on_keybutton(event);
      }
    };

    // Mouse events
    const handlePointerMove = (event: PointerEvent) => {
      if (emulator && canvas) {
        emulator.mouse.on_move(event, canvas);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (emulator) {
        emulator.mouse.on_down(event);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (emulator) {
        emulator.mouse.on_up(event);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (emulator) {
        emulator.mouse.on_scroll(event);
      }
    };

    // Drag and drop events
    const handleCanvasDragOver = (event: DragEvent) => {
      event.preventDefault();
      isDragging = true;
    };

    const handleCanvasDragLeave = (event: DragEvent) => {
      event.preventDefault();
      isDragging = false;
    };

    const handleCanvasDrop = async (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      isDragging = false;

      // Check for VFS path drop first
      const vfsPath = event.dataTransfer?.getData('application/x-vfs-path');
      if (vfsPath) {
        // Verify it's a ROM file
        const vfs = VirtualFilesystem.getInstance();
        const entry = vfs.getEntryOrLinkedFile(vfsPath);

        if (entry?.mimeType === 'application/x-uxn-rom') {
          await loadFromVfsPath(vfsPath);
          return;
        } else {
          console.warn('Only .rom files are supported for UXN, got:', entry?.mimeType);
          return;
        }
      }

      // Handle regular file drops
      const items = event.dataTransfer?.items;
      let file: File | null = null;
      let handle: FileSystemFileHandle | undefined;

      if (items && items.length > 0) {
        const item = items[0];
        file = item.getAsFile();

        // Try to get FileSystemFileHandle for persistence
        if ('getAsFileSystemHandle' in item) {
          try {
            const fsHandle = await (
              item as DataTransferItem & {
                getAsFileSystemHandle(): Promise<FileSystemHandle | null>;
              }
            ).getAsFileSystemHandle();
            if (fsHandle?.kind === 'file') {
              handle = fsHandle as FileSystemFileHandle;
            }
          } catch {
            // Not supported - continue without handle
          }
        }
      }

      // Fall back to files API
      if (!file) {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          file = files[0];
        }
      }

      if (file) {
        loadFile(file, handle);
      }
    };

    // Attach to canvas
    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('dragover', handleCanvasDragOver);
    canvas.addEventListener('dragleave', handleCanvasDragLeave);
    canvas.addEventListener('drop', handleCanvasDrop);

    // Make canvas focusable for keyboard events
    canvas.tabIndex = 0;

    return () => {
      canvas?.removeEventListener('keydown', handleKeyDown);
      canvas?.removeEventListener('keyup', handleKeyUp);
      canvas?.removeEventListener('pointermove', handlePointerMove);
      canvas?.removeEventListener('pointerdown', handlePointerDown);
      canvas?.removeEventListener('pointerup', handlePointerUp);
      canvas?.removeEventListener('wheel', handleWheel);
      canvas?.removeEventListener('dragover', handleCanvasDragOver);
      canvas?.removeEventListener('dragleave', handleCanvasDragLeave);
      canvas?.removeEventListener('drop', handleCanvasDrop);
    };
  }

  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      emulator?.stopRenderLoop();
      stopBitmapUpload();
    } else {
      emulator?.startRenderLoop();
      startBitmapUpload();
    }
  }

  async function loadFromUrl(url: string) {
    try {
      // Register URL in VFS, then load from vfsPath
      const vfs = VirtualFilesystem.getInstance();
      const vfsPath = await vfs.registerUrl(url);
      await loadFromVfsPath(vfsPath);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function loadFromVfsPath(vfsPath: string) {
    try {
      const vfs = VirtualFilesystem.getInstance();
      const fileOrBlob = await vfs.resolve(vfsPath);
      const arrayBuffer = await fileOrBlob.arrayBuffer();
      const rom = new Uint8Array(arrayBuffer);

      const fileName =
        fileOrBlob instanceof File ? fileOrBlob.name : vfsPath.split('/').pop() || 'rom.rom';

      loadROM(rom, { vfsPath, fileName });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function loadROM(rom: Uint8Array, options?: { fileName?: string; vfsPath?: string }) {
    if (emulator) {
      emulator.load(rom);

      const name = options?.fileName || 'rom.rom';

      // Don't persist `rom` bytes to avoid localStorage size limits
      // ROM will be loaded from vfsPath on next mount
      updateNodeData(nodeId, {
        fileName: name,
        vfsPath: options?.vfsPath
      });

      errorMessage = null;
    }
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    loadFile(file);
  }

  async function loadFile(file: File, handle?: FileSystemFileHandle) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const rom = new Uint8Array(arrayBuffer);

      // Store in VFS for persistence
      const vfs = VirtualFilesystem.getInstance();
      const vfsPath = await vfs.storeFile(file, handle);

      loadROM(rom, { fileName: file.name, vfsPath });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  function openFileDialog() {
    fileInputRef?.click();
  }

  async function assembleAndLoadCode(codeToAssemble: string) {
    if (!emulator) return;

    try {
      // Clear previous errors and console output
      errorMessage = null;
      consoleOutput = '';
      updateNodeData(nodeId, { consoleOutput: '', errorMessage: null });

      // Lazy-load uxn.wasm/util module
      const { asm } = await import('uxn.wasm/util');

      // Assemble the code
      const rom = asm(codeToAssemble);

      // Load the assembled ROM (no vfsPath for assembled code)
      // Don't persist rom bytes - code will be re-assembled on mount
      loadROM(rom, { fileName: 'assembled.rom' });
      updateNodeData(nodeId, {
        code: codeToAssemble,
        fileName: 'assembled.rom',
        vfsPath: undefined
      });

      measureContainerWidth();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errorMessage = errorMsg;
      updateNodeData(nodeId, { errorMessage: errorMsg });
    }
  }

  async function uploadBitmap() {
    if (!canvas || !emulator || isPaused) return;

    if (glSystem.hasOutgoingVideoConnections(nodeId)) {
      await glSystem.setBitmapSource(nodeId, canvas);
    }

    bitmapFrameId = requestAnimationFrame(uploadBitmap);
  }

  function startBitmapUpload() {
    if (bitmapFrameId !== null) return;
    bitmapFrameId = requestAnimationFrame(uploadBitmap);
  }

  function stopBitmapUpload() {
    if (bitmapFrameId !== null) {
      cancelAnimationFrame(bitmapFrameId);
      bitmapFrameId = null;
    }
  }

  async function assembleAndLoad() {
    await assembleAndLoadCode(code);
  }

  function handleToggleConsole() {
    showConsole = !showConsole;
    updateNodeData(nodeId, { showConsole });
  }

  function handleToggleEditor() {
    showEditor = !showEditor;
    updateNodeData(nodeId, { showEditor });
  }

  function toggleCompact() {
    isCompact = !isCompact;
    updateNodeData(nodeId, { compact: isCompact });

    if (emulator) {
      if (isCompact) {
        // Switching to compact mode - disable screen rendering
        emulator.setHeadless(true);
        stopBitmapUpload();
        glSystem.removeNode(nodeId);
      } else if (canvas) {
        emulator.initScreen(canvas);
        glSystem.upsertNode(nodeId, 'img', {});
        startBitmapUpload();
      }
    }
  }
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      {#if isCompact}
        <UxnCompactLayout
          {nodeId}
          {selected}
          {isPaused}
          hasError={!!errorMessage}
          {showConsole}
          {showEditor}
          onTogglePause={togglePause}
          onOpenFileDialog={openFileDialog}
          onToggleConsole={handleToggleConsole}
          onToggleEditor={handleToggleEditor}
          onShowScreen={toggleCompact}
        />
      {:else}
        <UxnFullLayout
          {nodeId}
          {selected}
          {isPaused}
          bind:canvas
          bind:previewContainer
          onTogglePause={togglePause}
          onOpenFileDialog={openFileDialog}
          onToggleConsole={handleToggleConsole}
          onToggleEditor={handleToggleEditor}
          onHideScreen={toggleCompact}
          onMeasureContainerWidth={measureContainerWidth}
        />
      {/if}

      {#if errorMessage}
        <div class="rounded border border-red-700 bg-red-900/50 p-2 font-mono text-xs text-red-300">
          {errorMessage}
        </div>
      {/if}

      {#if showConsole}
        <div
          class="max-h-32 w-full max-w-[512px] overflow-y-auto rounded bg-zinc-900 p-2 font-mono text-xs break-words whitespace-pre-wrap text-white"
          style="word-wrap: break-word; overflow-wrap: break-word;"
        >
          {consoleOutput || '(no output)'}
        </div>
      {/if}
    </div>
  </div>

  <input
    type="file"
    bind:this={fileInputRef}
    accept=".rom"
    onchange={handleFileSelect}
    class="hidden"
  />

  {#if showEditor}
    <div class="absolute" style="left: {editorLeftPos}px;">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        {#if assembleAndLoad}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button onclick={assembleAndLoad} class="rounded p-1 hover:bg-zinc-700">
                <Play class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>
              <p>Assemble & Load (shift+enter)</p>
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}

        <button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
        <CodeEditor
          value={code}
          onchange={(newCode) => {
            updateNodeData(nodeId, { code: newCode });
          }}
          language="assembly"
          placeholder="Write your Uxntal code here..."
          class="nodrag h-64 w-[500px] resize-none"
          onrun={assembleAndLoad}
        />
      </div>
    </div>
  {/if}
</div>
