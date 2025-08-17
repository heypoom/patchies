<script lang="ts">
	import { getBezierPath, BaseEdge, type EdgeProps, useEdges, EdgeLabel } from '@xyflow/svelte';

	let {
		id,
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		markerEnd,
		style
	}: EdgeProps = $props();

	let [edgePath, labelX, labelY] = $derived(
		getBezierPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition
		})
	);

	const edges = useEdges();

	const onEdgeClick = () => edges.update((eds) => eds.filter((edge) => edge.id !== id));
</script>

<BaseEdge path={edgePath} {markerEnd} {style} />
<EdgeLabel x={labelX} y={labelY} class="button-edge__label">
	<button class="button-edge__button" onclick={onEdgeClick}> × </button>
</EdgeLabel>
