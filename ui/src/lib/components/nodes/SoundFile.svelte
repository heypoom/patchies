<script lang="ts">
  import { Mic, Play, Square, Upload, Volume2 } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { MessageSystem } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import type { SoundfileNode as SoundfileNodeV2 } from '$lib/audio/v2/nodes/SoundfileNode';
  import { logger } from '$lib/utils/logger';
  import { getObjectType } from '$lib/objects/get-type';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import { useVfsMedia } from '$lib/vfs';
  import { VfsRelinkOverlay } from '$lib/vfs/components';

  let node: {
    id: string;
    data: {
      vfsPath?: string;
      fileName?: string;
    };
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  let messageContext: MessageContext;
  let audioService = AudioService.getInstance();
  let messageSystem = MessageSystem.getInstance();
  let v2Node: SoundfileNodeV2 | null = null;

  // Use VFS media composable for file handling
  const vfsMedia = useVfsMedia({
    nodeId: node.id,
    acceptMimePrefix: 'audio/',
    onFileLoaded: handleFileLoaded,
    updateNodeData: (data) => updateNodeData(node.id, { ...node.data, ...data }),
    getVfsPath: () => node.data.vfsPath,
    filePickerAccept: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
    filePickerDescription: 'Audio Files'
  });

  const fileName = $derived(node.data.fileName || 'No file selected');

  const handleMessage: MessageCallbackFn = async (message) => {
    match(message)
      .with(P.string, (url) => vfsMedia.loadFromUrl(url))
      .with({ type: 'load', url: P.string }, ({ url }) => vfsMedia.loadFromUrl(url))
      .with({ type: 'load', path: P.string }, ({ path }) => vfsMedia.loadFromPath(path))
      .with({ type: 'read' }, () => readAudioBuffer())
      .otherwise(() => audioService.send(node.id, 'message', message));
  };

  /**
   * Called when VFS successfully loads a file.
   * Sets up the audio system and updates node data.
   */
  async function handleFileLoaded(file: File) {
    // Update filename in node data
    updateNodeData(node.id, { ...node.data, fileName: file.name });

    // Send the file to the audio system
    audioService.send(node.id, 'file', file);

    vfsMedia.markLoaded();
    autoReadIfConnectedToConvolver();
  }

  /**
   * Check if this soundfile~ is already connected to a convolver~'s buffer inlet,
   * and if so, automatically read and send the audio buffer.
   */
  function autoReadIfConnectedToConvolver() {
    if (!vfsMedia.hasVfsPath) return;

    // Get all edges where this node is the source
    const connectedEdges = messageSystem.getConnectedEdgesToTargetInlet(node.id);

    // Check if any edge connects to a convolver~'s buffer inlet
    for (const { targetNodeId, inletKey } of connectedEdges) {
      const target = audioService.getNodeById(targetNodeId);
      if (!target || getObjectType(target) !== 'convolver~') continue;

      const inlet = audioService.getInletByHandle(targetNodeId, inletKey ?? null);

      if (inlet?.name === 'buffer') {
        readAudioBuffer();
        logger.debug('reading soundfile~ into buffer of convolver~');
      }
    }
  }

  async function readAudioBuffer() {
    if (!vfsMedia.hasVfsPath) return;

    try {
      const vfsPath = node.data.vfsPath;
      if (!vfsPath) return;

      const { VirtualFilesystem } = await import('$lib/vfs');
      const vfs = VirtualFilesystem.getInstance();
      const fileOrBlob = await vfs.resolve(vfsPath);

      const buffer = await fileOrBlob.arrayBuffer();
      const audioBuffer = await audioService.getAudioContext().decodeAudioData(buffer);
      messageContext.send(audioBuffer);
    } catch (err) {
      logger.error('Failed to read audio buffer:', err);
    }
  }

  function playFile() {
    if (!vfsMedia.hasVfsPath) return;
    audioService.send(node.id, 'message', { type: 'bang' });
  }

  function stopFile() {
    if (vfsMedia.hasVfsPath) {
      audioService.send(node.id, 'message', { type: 'stop' });
    }
  }

  onMount(async () => {
    messageContext = new MessageContext(node.id);
    messageContext.queue.addCallback(handleMessage);

    audioService.createNode(node.id, 'soundfile~', []);

    // Get the V2 node reference from AudioService
    v2Node = audioService.getNodeById(node.id) as SoundfileNodeV2;

    // If we have a VFS path, try to load from it
    if (node.data.vfsPath) {
      await vfsMedia.loadFromVfsPath(node.data.vfsPath);
    }
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    audioService.removeNodeById(node.id);
  });

  const containerClass = $derived.by(() => {
    if (vfsMedia.isDragging) return 'border-blue-400 bg-blue-50/10';
    if (node.selected) return 'border-zinc-400 bg-zinc-800';
    if (vfsMedia.hasVfsPath) return 'border-zinc-700 bg-zinc-900';

    return 'border-dashed border-zinc-600 bg-zinc-900';
  });

  /**
   * Convert this soundfile~ node to a sampler~ node, preserving the audio file.
   */
  async function convertToSampler() {
    if (!vfsMedia.hasVfsPath || !node.data.vfsPath) return;

    const eventBus = PatchiesEventBus.getInstance();

    try {
      const { VirtualFilesystem } = await import('$lib/vfs');
      const vfs = VirtualFilesystem.getInstance();
      const fileOrBlob = await vfs.resolve(node.data.vfsPath);

      const buffer = await fileOrBlob.arrayBuffer();
      const audioBuffer = await audioService.getAudioContext().decodeAudioData(buffer);

      // Dispatch node replace event with sampler data
      eventBus.dispatch({
        type: 'nodeReplace',
        nodeId: node.id,
        newType: 'sampler~',
        newData: {
          hasRecording: true,
          duration: audioBuffer.duration,
          loopStart: 0,
          loopEnd: audioBuffer.duration,
          loop: false,
          playbackRate: 1,
          detune: 0,
          // Store the VFS path so sampler can load it
          vfsPath: node.data.vfsPath
        },
        handleMapping: {
          'audio-out-0': 'audio-out-audio-out',
          'message-in': 'message-in-message-in'
        }
      });
    } catch (err) {
      logger.error('Failed to decode audio for sampler conversion:', err);
    }
  }
</script>

<ContextMenu.Root>
  <ContextMenu.Trigger>
    <div class="relative flex gap-x-3">
      <div class="group relative">
        <div class="flex flex-col gap-2">
          <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
            <div></div>

            {#if vfsMedia.hasVfsPath}
              <div class="flex gap-1">
                <button
                  title="Play"
                  class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
                  onclick={playFile}
                >
                  <Play class="h-4 w-4 text-zinc-300" />
                </button>

                <button
                  title="Stop"
                  class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
                  onclick={stopFile}
                >
                  <Square class="h-4 w-4 text-zinc-300" />
                </button>
              </div>
            {/if}
          </div>

          <div class="relative">
            <StandardHandle port="inlet" type="message" total={1} index={0} nodeId={node.id} />

            {#if vfsMedia.needsFolderRelink || vfsMedia.needsReselect}
              <VfsRelinkOverlay
                needsReselect={vfsMedia.needsReselect}
                needsFolderRelink={vfsMedia.needsFolderRelink}
                linkedFolderName={vfsMedia.linkedFolderName}
                vfsPath={node.data.vfsPath}
                width={200}
                height={50}
                isDragging={vfsMedia.isDragging}
                onRequestPermission={vfsMedia.requestFilePermission}
                onDragOver={vfsMedia.handleDragOver}
                onDragLeave={vfsMedia.handleDragLeave}
                onDrop={vfsMedia.handleDrop}
              />
            {:else}
              <div
                class={[
                  'flex flex-col items-center justify-center gap-3 rounded-lg border-1',
                  containerClass
                ]}
                ondragover={vfsMedia.handleDragOver}
                ondragleave={vfsMedia.handleDragLeave}
                ondrop={vfsMedia.handleDrop}
                role="figure"
              >
                {#if vfsMedia.hasVfsPath}
                  <div
                    class="flex items-center justify-center gap-2 px-3 py-[7px]"
                    ondblclick={vfsMedia.openFileDialog}
                    role="figure"
                  >
                    <Volume2 class="h-4 w-4 text-zinc-500" />

                    <div class="text-center font-mono">
                      <div class="max-w-[150px] truncate text-[12px] text-zinc-300">
                        {fileName}
                      </div>
                    </div>
                  </div>
                {:else}
                  <div
                    class="flex items-center justify-center gap-2 px-3 py-[7px]"
                    ondblclick={vfsMedia.openFileDialog}
                    role="figure"
                  >
                    <Upload class="h-3 w-3 text-zinc-400" />

                    <div class="font-mono text-[12px] text-zinc-400">
                      <span class="text-zinc-300">double click</span> or
                      <span class="text-zinc-300">drop</span>
                      sound file
                    </div>
                  </div>
                {/if}
              </div>
            {/if}

            <StandardHandle
              port="outlet"
              type="audio"
              id="0"
              title="Audio output"
              total={1}
              index={0}
              nodeId={node.id}
            />
          </div>
        </div>
      </div>
    </div>
  </ContextMenu.Trigger>

  <ContextMenu.Content>
    {#if vfsMedia.hasVfsPath}
      <ContextMenu.Item onclick={convertToSampler}>
        <Mic class="mr-2 h-4 w-4" />
        Convert to Sampler
      </ContextMenu.Item>
    {/if}
  </ContextMenu.Content>
</ContextMenu.Root>

<!-- Hidden file input -->
<input
  bind:this={vfsMedia.fileInputRef}
  type="file"
  accept="audio/*"
  onchange={vfsMedia.handleFileSelect}
  class="hidden"
/>
