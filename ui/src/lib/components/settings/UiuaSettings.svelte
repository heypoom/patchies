<script lang="ts">
  import { X, Volume2, Video, Eye } from '@lucide/svelte/icons';

  interface UiuaSettingsData {
    enableAudioOutlet?: boolean;
    enableVideoOutlet?: boolean;
    showPreview?: boolean;
  }

  let {
    data,
    onClose,
    onToggleAudio,
    onToggleVideo,
    onTogglePreview
  }: {
    data: UiuaSettingsData;
    onClose: () => void;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onTogglePreview: () => void;
  } = $props();
</script>

<div class="absolute top-0 left-full z-20 ml-2">
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
    <button
      onclick={onClose}
      class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
      title="Close"
    >
      <X class="h-4 w-4" />
    </button>
  </div>

  <div
    class="nodrag flex flex-col gap-4 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl"
  >
    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-zinc-400">Outlets</span>
      <div class="flex gap-1">
        <button
          onclick={onToggleAudio}
          class={[
            'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
            data.enableAudioOutlet
              ? 'bg-zinc-600 text-white'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          ]}
          title="Audio outlet"
        >
          <Volume2 class="h-3.5 w-3.5" />
          Audio
        </button>

        <button
          onclick={onToggleVideo}
          class={[
            'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
            data.enableVideoOutlet
              ? 'bg-zinc-600 text-white'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          ]}
          title="Video outlet"
        >
          <Video class="h-3.5 w-3.5" />
          Video
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-zinc-400">Display</span>
      <div class="flex gap-1">
        <button
          onclick={onTogglePreview}
          class={[
            'flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
            (data.showPreview ?? true)
              ? 'bg-zinc-600 text-white'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          ]}
          title="Show media preview"
        >
          <Eye class="h-3.5 w-3.5" />
          Preview
        </button>
      </div>
    </div>
  </div>
</div>
