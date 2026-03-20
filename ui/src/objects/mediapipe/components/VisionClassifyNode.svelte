<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import MediaPipeNodeLayout from './MediaPipeNodeLayout.svelte';
  import { MediaPipeNodeSystem } from '$objects/mediapipe/MediaPipeNodeSystem';
  import { useVisionEnable } from '$objects/mediapipe/useVisionEnable';
  import type { ClassifyTaskOptions } from '$objects/mediapipe/types';
  import type { SettingsSchema } from '$lib/settings/types';
  import type { VisionStatus } from '$objects/mediapipe/MediaPipeNodeSystem';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: ClassifyTaskOptions;
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
      default: 0,
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
    mediaPipeSystem.updateSettings(nodeId, { [key]: value } as Partial<ClassifyTaskOptions>);
  }

  function handleRevertSettings() {
    const defaults: ClassifyTaskOptions = {
      maxResults: 5,
      scoreThreshold: 0.0,
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
      task: 'classify',
      taskOptions: {
        maxResults: data.maxResults ?? 5,
        scoreThreshold: data.scoreThreshold ?? 0.0,
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

<MediaPipeNodeLayout
  {nodeId}
  {selected}
  title="vision.classify"
  {status}
  {error}
  {fps}
  {enabled}
  onToggleEnabled={() => mediaPipeSystem.setEnabled(nodeId, !enabled)}
  schema={SCHEMA}
  settingsData={data}
  onSettingChange={handleSettingChange}
  onRevertSettings={handleRevertSettings}
/>
