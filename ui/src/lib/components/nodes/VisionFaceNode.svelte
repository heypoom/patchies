<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import MediaPipeNodeLayout from './MediaPipeNodeLayout.svelte';
  import { MediaPipeNodeSystem } from '$lib/mediapipe/MediaPipeNodeSystem';
  import type { FaceTaskOptions } from '$lib/mediapipe/types';
  import type { SettingsSchema } from '$lib/settings/types';
  import type { VisionStatus } from '$lib/mediapipe/MediaPipeNodeSystem';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: FaceTaskOptions;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const mediaPipeSystem = MediaPipeNodeSystem.getInstance();

  let status = $state<VisionStatus>('idle');
  let error = $state<string | undefined>(undefined);
  let fps = $state<number | undefined>(undefined);

  const SCHEMA: SettingsSchema = [
    {
      key: 'numFaces',
      label: 'Max Faces',
      type: 'slider',
      min: 1,
      max: 4,
      step: 1,
      default: 1
    },
    {
      key: 'blendshapes',
      label: 'Blendshapes',
      type: 'boolean',
      default: false,
      description: 'Output 52 ARKit blendshape coefficients'
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
    mediaPipeSystem.updateSettings(nodeId, { [key]: value } as Partial<FaceTaskOptions>);
  }

  function handleRevertSettings() {
    const defaults: FaceTaskOptions = {
      numFaces: 1,
      blendshapes: false,
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
      task: 'face',
      taskOptions: {
        numFaces: data.numFaces ?? 1,
        blendshapes: data.blendshapes ?? false,
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
  title="vision.face"
  {status}
  {error}
  {fps}
  schema={SCHEMA}
  settingsData={data}
  onSettingChange={handleSettingChange}
  onRevertSettings={handleRevertSettings}
/>
