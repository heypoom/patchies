<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import MediaPipeNodeLayout from './MediaPipeNodeLayout.svelte';
  import { MediaPipeNodeSystem } from '$objects/mediapipe/MediaPipeNodeSystem';
  import { useVisionEnable } from '$objects/mediapipe/useVisionEnable';
  import type { SegmentTaskOptions } from '$objects/mediapipe/types';
  import type { SettingsSchema } from '$lib/settings/types';
  import type { VisionStatus } from '$objects/mediapipe/MediaPipeNodeSystem';

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
  let enabled = $state(true);
  let visionEnable: ReturnType<typeof useVisionEnable> | null = null;

  const SCHEMA: SettingsSchema = [
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      default: 'general',
      options: [
        { label: 'General', value: 'general' },
        {
          label: 'Landscape (fast)',
          value: 'landscape',
          description: 'Optimised for landscape orientation, lower latency'
        }
      ]
    },
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
      model: 'general',
      maskType: 'category',
      outputMessage: false,
      delegate: 'GPU',
      skipFrames: 1
    };
    updateNodeData(nodeId, defaults as unknown as Record<string, unknown>);
    mediaPipeSystem.updateSettings(nodeId, defaults);
  }

  onMount(() => {
    mediaPipeSystem.onStatusChange(nodeId, (s, e, f, en) => {
      status = s;
      error = e;
      fps = f;
      enabled = en ?? true;
    });

    mediaPipeSystem.register(nodeId, {
      task: 'segment',
      taskOptions: {
        model: data.model ?? 'general',
        maskType: data.maskType ?? 'category',
        outputMessage: data.outputMessage ?? false,
        delegate: data.delegate ?? 'GPU',
        skipFrames: data.skipFrames ?? 1
      },
      skipFrames: data.skipFrames ?? 1
    });

    visionEnable = useVisionEnable(nodeId, () => enabled);
  });

  onDestroy(() => {
    mediaPipeSystem.offStatusChange(nodeId);
    mediaPipeSystem.unregister(nodeId);
    visionEnable?.destroy();
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
  {enabled}
  onToggleEnabled={() => mediaPipeSystem.setEnabled(nodeId, !enabled)}
  schema={SCHEMA}
  settingsData={data}
  onSettingChange={handleSettingChange}
  onRevertSettings={handleRevertSettings}
  messageOutletCount={data.outputMessage ? 1 : 0}
  hasVideoOutlet={true}
/>
