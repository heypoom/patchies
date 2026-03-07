<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { getPortPosition } from '$lib/utils/node-utils';
  import { match, P } from 'ts-pattern';
  import { ANALYSIS_KEY } from '$lib/audio/v2/constants/fft';
  import {
    isConnectionMode,
    isConnecting,
    connectingFromHandleId,
    audioSourceConnections
  } from '../../stores/ui.store';
  import { shouldDimHandle } from '$lib/utils/handle-dimming';

  interface Props {
    port: 'inlet' | 'outlet';
    type?: 'video' | 'audio' | 'message' | 'analysis';
    id?: string | number;
    title?: string;
    total: number;
    index: number;
    class?: string;
    nodeId: string;
    isAudioParam?: boolean;

    /** When true, this signal inlet also accepts float messages (Pure Data style) */
    acceptsFloat?: boolean;

    /** Hot inlet indicator (Max/Pd style) - shows a ring around the handle */
    isHot?: boolean;
  }

  let {
    port,
    type,
    id,
    title,
    total,
    index,
    class: className = '',
    nodeId,
    isAudioParam = false,
    acceptsFloat = false,
    isHot = false
  }: Props = $props();

  // Construct the handle ID based on the specification
  const handleId = $derived.by(() => {
    const portDir = port === 'inlet' ? 'in' : 'out';

    return match({ type, id })
      .with({ type: P.string, id: P.not(P.nullish) }, ({ type, id }) => `${type}-${portDir}-${id}`)
      .with({ type: P.string, id: P.nullish }, ({ type }) => `${type}-${portDir}`)
      .with({ type: P.nullish, id: P.not(P.nullish) }, ({ id }) => `${portDir}-${id}`)
      .otherwise(() => port);
  });

  // Determine handle type and position using ts-pattern
  const handleType = match(port)
    .with('inlet', () => 'target' as const)
    .with('outlet', () => 'source' as const)
    .exhaustive();

  const handlePosition = match(port)
    .with('inlet', () => Position.Top)
    .with('outlet', () => Position.Bottom)
    .exhaustive();

  // Calculate position using getPortPosition
  const positionStyle = $derived(`left: ${getPortPosition(total, index)}`);

  // Construct the fully qualified handle identifier (nodeId + handleId)
  const qualifiedHandleId = $derived(`${nodeId}/${handleId}`);

  // Determine if this handle is the source of the current connection
  const isSourceHandle = $derived($isConnecting && $connectingFromHandleId === qualifiedHandleId);

  // Check if this AudioParam inlet is connected to an audio source
  const isConnectedToAudioSource = $derived.by(() => {
    if (!isAudioParam || port !== 'inlet') return false;

    return $audioSourceConnections.has(qualifiedHandleId);
  });

  // Determine if this AudioParam inlet should highlight as "audio-compatible"
  // when dragging from an audio outlet OR when already connected to one
  const shouldShowAsAudioCompatible = $derived.by(() => {
    if (!isAudioParam || port !== 'inlet') return false;

    // Show as audio if already connected to an audio source
    if (isConnectedToAudioSource) return true;

    // Show as audio if currently dragging from an audio outlet
    if ($isConnecting && $connectingFromHandleId?.includes('audio-out')) return true;

    return false;
  });

  // Determine if this handle should be dimmed
  const shouldDim = $derived(
    shouldDimHandle({
      isConnecting: $isConnecting,
      connectingFromHandleId: $connectingFromHandleId,
      currentHandleQualifiedId: qualifiedHandleId,
      currentHandlePort: port,
      isAudioParam,
      acceptsFloat
    })
  );

  // Determine handle color based on type using ts-pattern
  const handleClass = $derived.by(() => {
    // Override color to blue when AudioParam inlet is compatible with audio source being dragged
    const effectiveType = shouldShowAsAudioCompatible ? 'audio' : type;

    // Don't apply hover colors when dimmed
    const colorClass = shouldDim
      ? match(effectiveType)
          .with('video', () => '!bg-orange-500')
          .with('audio', () => '!bg-blue-500')
          .with('message', () => '!bg-gray-500')
          .with(ANALYSIS_KEY, () => '!bg-purple-500')
          .with(P.nullish, () => '!bg-gray-500')
          .exhaustive()
      : match(effectiveType)
          .with('video', () => '!bg-orange-500 hover:!bg-orange-400')
          .with('audio', () => '!bg-blue-500 hover:!bg-blue-400')
          .with('message', () => '!bg-gray-500 hover:!bg-gray-400')
          .with(ANALYSIS_KEY, () => '!bg-purple-500 hover:!bg-purple-400')
          .with(P.nullish, () => '!bg-gray-500 hover:!bg-gray-400')
          .exhaustive();

    const connectionModeClass = $isConnectionMode ? 'connection-mode-active' : '';
    const dimClass = shouldDim ? 'handle-dimmed' : '';
    const sourceHighlightClass = isSourceHandle ? 'handle-source' : '';
    const hotClass = isHot ? 'handle-hot' : '';
    const audioParamClass = isAudioParam ? 'handle-audio-param' : '';

    return `!absolute z-1 ${colorClass} ${connectionModeClass} ${dimClass} ${sourceHighlightClass} ${hotClass} ${audioParamClass} ${className}`;
  });
</script>

<Handle
  type={handleType}
  position={handlePosition}
  id={handleId}
  class={handleClass}
  style={positionStyle}
  title={isAudioParam ? `${title} (a-rate)` : title}
/>

<style>
  :global(.svelte-flow__handle) {
    min-width: 6px;
    min-height: 6px;
    width: 7px;
    height: 7px;
    will-change: width, height, opacity, filter;
    transition:
      width 0.2s ease-in,
      height 0.2s ease-in,
      opacity 0.2s ease-in,
      filter 0.2s ease-in;
  }

  :global(.svelte-flow__handle):hover {
    min-width: 10px;
    min-height: 10px;
    width: 11px;
    height: 11px;
  }

  /* Make handles REALLY BIG and touch-friendly in connection mode */
  :global(.svelte-flow__handle.connection-mode-active) {
    min-width: 12px !important;
    min-height: 12px !important;
    width: 14px !important;
    height: 14px !important;
    z-index: 100 !important;
    cursor: pointer !important;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2) !important;
  }

  :global(.svelte-flow__handle.connection-mode-active.connecting) {
    background: red !important;
  }

  /* Dim handles when in connecting state - JavaScript-controlled via handle-dimmed class */
  :global(.svelte-flow__handle.handle-dimmed) {
    opacity: 0.25 !important;
    filter: grayscale(0.7) brightness(0.6) !important;
    pointer-events: none !important;
    cursor: not-allowed !important;
  }

  /* Highlight the source handle during connection */
  :global(.svelte-flow__handle.handle-source) {
    animation: source-pulse 1.2s ease-in-out infinite;
    box-shadow: 0 0 10px 3px rgba(255, 255, 255, 0.7) !important;
  }

  @keyframes source-pulse {
    0%,
    100% {
      box-shadow: 0 0 10px 3px rgba(255, 255, 255, 0.7);
    }
    50% {
      box-shadow: 0 0 16px 5px rgba(255, 255, 255, 0.95);
    }
  }

  /* Hot inlet indicator (Max/Pd style) - subtle hover */
  :global(.svelte-flow__handle.handle-hot:hover) {
    box-shadow: 0 0 0 2px rgba(255, 165, 45, 0.4);
  }

  /* AudioParam inlet indicator - blue ring on hover */
  :global(.svelte-flow__handle.handle-audio-param:hover) {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
  }
</style>
