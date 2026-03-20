<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import MediaPipeNodeLayout from './MediaPipeNodeLayout.svelte';
  import { MediaPipeNodeSystem } from '$lib/mediapipe/MediaPipeNodeSystem';
  import type { SegmentTaskOptions } from '$lib/mediapipe/types';
  import type { SettingsSchema } from '$lib/settings/types';
  import type { VisionStatus } from '$lib/mediapipe/MediaPipeNodeSystem';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: SegmentTaskOptions;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const mediaPipeSystem = MediaPipeNodeSystem.getInstance();

  let status = $state<VisionStatus>('idle');
  let error = $state<string | undefined>(undefined);
  let fps = $state<number | undefined>(undefined);

  const SCHEMA: SettingsSchema = [
    {
      key: 'maskType',
      label: 'Mask Type',
      type: 'select',
      default: 'category',
      options: [
        { label: 'Category', value: 'category', description: 'Binary foreground/background mask' },
        { label: 'Confidence', value: 'confidence', description: 'Greyscale confidence values 0–1' }
      ]
    },
    {
      key: 'outputMessage',
      label: 'Output Message',
      type: 'boolean',
      default: false,
      description: 'Also emit raw mask data as a message on outlet 1'
    },
    {
      key: 'delegate',
      label: 'Delegate',
      type: 'select',
      default: 'GPU',
      options: [
        { label: 'GPU', value: 'GPU' },
        { label: 'CPU', value: 'CPU' }
      ]
    },
    {
      key: 'skipFrames',
      label: 'Skip Frames',
      type: 'slider',
      min: 1,
      max: 10,
      step: 1,
      default: 1,
      description: 'Process every Nth frame'
    }
  ];

  function handleSettingChange(key: string, value: unknown) {
    updateNodeData(nodeId, { [key]: value });
    mediaPipeSystem.updateSettings(nodeId, { [key]: value } as Partial<SegmentTaskOptions>);
  }

  function handleRevertSettings() {
    const defaults: SegmentTaskOptions = {
      maskType: 'category',
      outputMessage: false,
      delegate: 'GPU',
      skipFrames: 1
    };
    updateNodeData(nodeId, defaults);
    mediaPipeSystem.updateSettings(nodeId, defaults);
  }

  onMount(() => {
    mediaPipeSystem.onStatusChange(nodeId, (s, e, f) => {
      status = s;
      error = e;
      fps = f;
    });

    mediaPipeSystem.register(nodeId, {
      task: 'segment',
      taskOptions: {
        maskType: data.maskType ?? 'category',
        outputMessage: data.outputMessage ?? false,
        delegate: data.delegate ?? 'GPU',
        skipFrames: data.skipFrames ?? 1
      },
      skipFrames: data.skipFrames ?? 1
    });
  });

  onDestroy(() => {
    mediaPipeSystem.offStatusChange(nodeId);
    mediaPipeSystem.unregister(nodeId);
  });
</script>

<!-- vision.segment has video outlet (outlet 0) + optional message outlet (outlet 1) -->
<MediaPipeNodeLayout
  {nodeId}
  {selected}
  title="vision.segment"
  {status}
  {error}
  {fps}
  schema={SCHEMA}
  settingsData={data}
  onSettingChange={handleSettingChange}
  onRevertSettings={handleRevertSettings}
  messageOutletCount={data.outputMessage ? 1 : 0}
  hasVideoOutlet={true}
/>
