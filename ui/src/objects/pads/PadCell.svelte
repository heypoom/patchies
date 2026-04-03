<script lang="ts">
  import { VirtualFilesystem, guessMimeType, VFS_FOLDERS } from '$lib/vfs';
  import { setupDprCanvas } from '$lib/canvas/waveform-renderer';
  import type { PadConfig } from './constants';

  type Props = {
    padIndex: number;
    padConfig: PadConfig;
    gmName: string;
    /** 0 = inactive, 1–127 = velocity of current hit */
    velocity: number;
    audioBuffer?: AudioBuffer | null;
    showGmLabels: boolean;
    showPadNumbers: boolean;
    onAssign: (padIndex: number, vfsPath: string) => void;
    onClear: (padIndex: number) => void;
    onTrigger: (padIndex: number) => void;
  };

  let {
    padIndex,
    padConfig,
    gmName,
    velocity,
    audioBuffer,
    showGmLabels,
    showPadNumbers,
    onAssign,
    onClear,
    onTrigger
  }: Props = $props();

  const isActive = $derived(velocity > 0);
  /** Normalized 0–1 intensity from velocity */
  const intensity = $derived(velocity / 127);

  let isDragging = $state(false);
  let canvasEl = $state<HTMLCanvasElement>();
  let padEl = $state<HTMLDivElement>();

  const label = $derived(
    padConfig.label ??
      padConfig.vfsPath
        ?.split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') ??
      null
  );

  function drawPadWaveform(canvas: HTMLCanvasElement, data: Float32Array) {
    const ctx = canvas.getContext('2d');
    if (!ctx || !data.length) return;

    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;
    const margin = 2;

    ctx.clearRect(0, 0, w, h);

    const maxEnv = new Float32Array(w);
    const minEnv = new Float32Array(w);

    for (let px = 0; px < w; px++) {
      const start = Math.floor((px / w) * data.length);
      const end = Math.max(start + 1, Math.floor(((px + 1) / w) * data.length));
      let min = 0,
        max = 0;
      for (let i = start; i < end; i++) {
        const v = data[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      maxEnv[px] = mid - max * (mid - margin);
      minEnv[px] = mid - min * (mid - margin);
    }

    ctx.beginPath();
    ctx.moveTo(0, maxEnv[0]);
    for (let px = 1; px < w; px++) ctx.lineTo(px, maxEnv[px]);
    for (let px = w - 1; px >= 0; px--) ctx.lineTo(px, minEnv[px]);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(74,222,128,0.6)');
    grad.addColorStop(0.5, 'rgba(34,197,94,0.85)');
    grad.addColorStop(1, 'rgba(74,222,128,0.6)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Draw waveform when buffer or canvas element changes
  $effect(() => {
    if (!canvasEl || !padEl) return;
    const w = padEl.clientWidth - 8;
    const h = padEl.clientHeight - 8;
    if (w <= 0 || h <= 0) return;

    setupDprCanvas(canvasEl, w, h);

    if (audioBuffer) {
      drawPadWaveform(canvasEl, audioBuffer.getChannelData(0));
    } else {
      const ctx = canvasEl.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
  });

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;

    const vfs = VirtualFilesystem.getInstance();

    // VFS path drop (from VFS browser or file tree)
    const vfsPathData = event.dataTransfer?.getData('application/x-vfs-path');
    if (vfsPathData) {
      const entry = vfs.getEntryOrLinkedFile(vfsPathData);
      const mime = entry?.mimeType?.startsWith('audio/')
        ? entry.mimeType
        : guessMimeType(entry?.filename ?? vfsPathData);
      if (mime?.startsWith('audio/')) {
        onAssign(padIndex, vfsPathData);
      }
      return;
    }

    // Sample URL drop (from Samples sidebar)
    const sampleData = event.dataTransfer?.getData('application/x-sample-url');
    if (sampleData) {
      try {
        const { url } = JSON.parse(sampleData) as { url: string };
        if (url) {
          const vfsPath = await vfs.registerUrl(url, VFS_FOLDERS.SAMPLES);
          onAssign(padIndex, vfsPath);
        }
      } catch {
        // malformed payload
      }
      return;
    }

    // File drop from OS
    const items = event.dataTransfer?.items;
    let file: File | null = null;
    let handle: FileSystemFileHandle | undefined;

    if (items && items.length > 0) {
      const item = items[0];
      file = item.getAsFile();
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
          // not supported
        }
      }
    }

    if (!file && event.dataTransfer?.files?.length) {
      file = event.dataTransfer.files[0];
    }

    if (!file) return;

    const mimeType = file.type?.startsWith('audio/')
      ? file.type
      : (guessMimeType(file.name) ?? file.type);

    if (!mimeType?.startsWith('audio/')) return;

    const vfsPath = await vfs.storeFile(file, handle);
    onAssign(padIndex, vfsPath);
  }

  function handleClick() {
    onTrigger(padIndex);
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (padConfig.vfsPath) {
      onClear(padIndex);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  bind:this={padEl}
  class={[
    'relative flex h-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded p-1 transition-colors select-none',
    'border',
    isActive
      ? 'border-green-400'
      : isDragging
        ? 'border-blue-400 bg-blue-500/20'
        : padConfig.vfsPath
          ? 'border-zinc-500 bg-zinc-700 hover:border-zinc-400 hover:bg-zinc-600'
          : 'border-zinc-600 bg-zinc-800 hover:border-zinc-500 hover:bg-zinc-700'
  ]}
  style={isActive
    ? `background: rgba(34,197,94,${0.15 + intensity * 0.45}); box-shadow: inset 0 0 ${4 + intensity * 12}px rgba(74,222,128,${0.1 + intensity * 0.4})`
    : ''}
  onclick={handleClick}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  oncontextmenu={handleContextMenu}
  role="button"
  tabindex="-1"
>
  {#if audioBuffer}
    <canvas bind:this={canvasEl} class="absolute inset-1 rounded"></canvas>
  {:else if showGmLabels}
    <span class="w-full truncate text-center font-mono text-[9px] leading-tight text-zinc-600">
      {gmName}
    </span>
  {/if}

  <!-- Pad number badge -->
  {#if showPadNumbers}
    <span class="absolute right-1 bottom-0.5 font-mono text-[8px] text-zinc-500">
      {padIndex + 1}
    </span>
  {/if}
</div>
