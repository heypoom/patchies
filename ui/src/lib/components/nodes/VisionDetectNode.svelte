<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import MediaPipeNodeLayout from './MediaPipeNodeLayout.svelte';
  import { MediaPipeNodeSystem } from '$lib/mediapipe/MediaPipeNodeSystem';
  import type { DetectTaskOptions } from '$lib/mediapipe/types';
  import type { SettingsSchema } from '$lib/settings/types';
  import type { VisionStatus } from '$lib/mediapipe/MediaPipeNodeSystem';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: DetectTaskOptions;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const mediaPipeSystem = MediaPipeNodeSystem.getInstance();

  let status = $state<VisionStatus>('idle');
  let error = $state<string | undefined>(undefined);
  let fps = $state<number | undefined>(undefined);

  const SCHEMA: SettingsSchema = [
    {
      key: 'maxResults',
      label: 'Max Results',
      type: 'slider',
      min: 1,
      max: 20,
      step: 1,
      default: 5
    },
    {
      key: 'scoreThreshold',
      label: 'Threshold',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
      description: 'Minimum confidence score'
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
    mediaPipeSystem.updateSettings(nodeId, { [key]: value } as Partial<DetectTaskOptions>);
  }

  function handleRevertSettings() {
    const defaults: DetectTaskOptions = {
      maxResults: 5,
      scoreThreshold: 0.5,
      delegate: 'GPU',
      skipFrames: 1
    };
    updateNodeData(nodeId, defaults as unknown as Record<string, unknown>);
    mediaPipeSystem.updateSettings(nodeId, defaults);
  }

  onMount(() => {
    mediaPipeSystem.onStatusChange(nodeId, (s, e, f) => {
      status = s;
      error = e;
      fps = f;
    });

    mediaPipeSystem.register(nodeId, {
      task: 'detect',
      taskOptions: {
        maxResults: data.maxResults ?? 5,
        scoreThreshold: data.scoreThreshold ?? 0.5,
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

<MediaPipeNodeLayout
  {nodeId}
  {selected}
  title="vision.detect"
  {status}
  {error}
  {fps}
  schema={SCHEMA}
  settingsData={data}
  onSettingChange={handleSettingChange}
  onRevertSettings={handleRevertSettings}
/>
