<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import MediaPipeNodeLayout from './MediaPipeNodeLayout.svelte';
  import { MediaPipeNodeSystem } from '$objects/mediapipe/MediaPipeNodeSystem';
  import { useVisionEnable } from '$objects/mediapipe/useVisionEnable';
  import type { HandTaskOptions } from '$objects/mediapipe/types';
  import type { SettingsSchema } from '$lib/settings/types';
  import type { VisionStatus } from '$objects/mediapipe/MediaPipeNodeSystem';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: HandTaskOptions;
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
      key: 'numHands',
      label: 'Max Hands',
      type: 'slider',
      min: 1,
      max: 4,
      step: 1,
      default: 2
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      default: 'lite',
      options: [
        { label: 'Lite', value: 'lite' },
        { label: 'Full', value: 'full' }
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
    mediaPipeSystem.updateSettings(nodeId, { [key]: value } as Partial<HandTaskOptions>);
  }

  function handleRevertSettings() {
    const defaults: HandTaskOptions = {
      numHands: 2,
      model: 'lite',
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
      task: 'hand',
      taskOptions: {
        numHands: data.numHands ?? 2,
        model: data.model ?? 'lite',
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
  title="vision.hand"
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
