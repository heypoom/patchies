<script lang="ts">
  import { VirtualFilesystem, guessMimeType, VFS_FOLDERS } from '$lib/vfs';
  import type { PadConfig } from './constants';

  type Props = {
    padIndex: number;
    padConfig: PadConfig;
    gmName: string;
    /** 0 = inactive, 1–127 = velocity of current hit */
    velocity: number;
    showGmLabels: boolean;
    onAssign: (padIndex: number, vfsPath: string) => void;
    onClear: (padIndex: number) => void;
    onTrigger: (padIndex: number) => void;
  };

  let { padIndex, padConfig, gmName, velocity, showGmLabels, onAssign, onClear, onTrigger }: Props =
    $props();

  const isActive = $derived(velocity > 0);
  /** Normalized 0–1 intensity from velocity */
  const intensity = $derived(velocity / 127);

  let isDragging = $state(false);

  const label = $derived(
    padConfig.label ??
      padConfig.vfsPath
        ?.split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') ??
      null
  );

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
  {#if label}
    <span
      class="w-full truncate text-center font-mono text-[10px] leading-tight font-medium text-zinc-100"
    >
      {label}
    </span>
  {:else if showGmLabels}
    <span class="w-full truncate text-center font-mono text-[9px] leading-tight text-zinc-600">
      {gmName}
    </span>
  {/if}

  <!-- Pad number badge -->
  <span class="absolute right-1 bottom-0.5 font-mono text-[8px] text-zinc-500">
    {padIndex + 1}
  </span>
</div>
