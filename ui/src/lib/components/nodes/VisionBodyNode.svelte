<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import MediaPipeNodeLayout from './MediaPipeNodeLayout.svelte';
  import { MediaPipeNodeSystem } from '$lib/mediapipe/MediaPipeNodeSystem';
  import type { BodyTaskOptions } from '$lib/mediapipe/types';
  import type { SettingsSchema } from '$lib/settings/types';
  import type { VisionStatus } from '$lib/mediapipe/MediaPipeNodeSystem';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: BodyTaskOptions;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const mediaPipeSystem = MediaPipeNodeSystem.getInstance();

  let status = $state<VisionStatus>('idle');
  let error = $state<string | undefined>(undefined);
  let fps = $state<number | undefined>(undefined);

  const SCHEMA: SettingsSchema = [
    {
      key: 'numPoses',
      label: 'Max Poses',
      type: 'slider',
      min: 1,
      max: 4,
      step: 1,
      default: 1
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      default: 'lite',
      options: [
        { label: 'Lite', value: 'lite' },
        { label: 'Full', value: 'full' },
        { label: 'Heavy', value: 'heavy' }
      ]
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

    mediaPipeSystem.updateSettings(nodeId, { [key]: value } as Partial<BodyTaskOptions>);
  }

  function handleRevertSettings() {
    const defaults: BodyTaskOptions = {
      numPoses: 1,
      model: 'lite',
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
      task: 'body',
      taskOptions: {
        numPoses: data.numPoses ?? 1,
        model: data.model ?? 'lite',
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
  title="vision.body"
  {status}
  {error}
  {fps}
  schema={SCHEMA}
  settingsData={data}
  onSettingChange={handleSettingChange}
  onRevertSettings={handleRevertSettings}
/>
