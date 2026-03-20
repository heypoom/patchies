<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import MediaPipeNodeLayout from './MediaPipeNodeLayout.svelte';
  import { MediaPipeNodeSystem } from '$objects/mediapipe/MediaPipeNodeSystem';
  import { useVisionEnable } from '$objects/mediapipe/useVisionEnable';
  import type { FaceTaskOptions } from '$objects/mediapipe/types';
  import type { SettingsSchema } from '$lib/settings/types';
  import type { VisionStatus } from '$objects/mediapipe/MediaPipeNodeSystem';

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
  let enabled = $state(true);
  let visionEnable: ReturnType<typeof useVisionEnable> | null = null;

  const SCHEMA: SettingsSchema = [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      default: 'landmarks',
      options: [
        { label: 'Landmarks (478 pts)', value: 'landmarks' },
        { label: 'Bounding Box (fast)', value: 'detect' }
      ]
    },
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
    },
    {
      key: 'blendshapes',
      label: 'Blendshapes',
      type: 'boolean',
      default: false,
      description: 'Output 52 ARKit blendshape coefficients'
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
      skipFrames: 1,
      mode: 'landmarks'
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
      task: 'face',
      taskOptions: {
        numFaces: data.numFaces ?? 1,
        blendshapes: data.blendshapes ?? false,
        delegate: data.delegate ?? 'GPU',
        skipFrames: data.skipFrames ?? 1,
        mode: data.mode ?? 'landmarks'
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
  title="vision.face"
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
