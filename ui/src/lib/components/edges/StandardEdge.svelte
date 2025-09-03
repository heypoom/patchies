<script lang="ts">
	import { getEdgeTypes } from '$lib/utils/get-edge-types';
	import {
		getBezierPath,
		BaseEdge,
		type EdgeProps,
		useEdges,
		EdgeLabel,
		useNodesData
	} from '@xyflow/svelte';
	import { match } from 'ts-pattern';

	let {
		id,
		source,
		target,
		sourceHandleId,
		targetHandleId,
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		markerEnd,
		style,
		selectable,
		selected
	}: EdgeProps = $props();

	const type = $derived.by(() => {
		const [sourceData, targetData] = nodesData.current;

		return getEdgeTypes(sourceData, targetData, sourceHandleId ?? null, targetHandleId ?? null);
	});

	const edgeClass = $derived.by(() => {
		const baseClass = match(type)
			.with('audio', () => '!stroke-blue-500')
			.with('video', () => '!stroke-orange-500')
			.with('message', () => '!stroke-zinc-400')
			.exhaustive();

		return [baseClass, !selected && 'opacity-60'];
	});

	const nodesData = useNodesData([source, target]);

	let [edgePath] = $derived(
		getBezierPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition
		})
	);
</script>

<BaseEdge path={edgePath} {markerEnd} class={edgeClass} />
