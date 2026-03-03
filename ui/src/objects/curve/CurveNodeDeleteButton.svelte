<script lang="ts">
  import {
    CURVE_DELETE_RADIUS as DELETE_RADIUS,
    CURVE_DELETE_DX as DELETE_DX,
    CURVE_DELETE_DY as DELETE_DY
  } from './constants';

  const { sx, sy, index, deletePoint } = $props<{
    sx: number;
    sy: number;
    index: number;
    deletePoint: (index: number) => void;
  }>();

  const s = DELETE_RADIUS * 0.3;

  const bx = $derived(sx + DELETE_DX);
  const by = $derived(sy + DELETE_DY);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<circle
  cx={bx}
  cy={by}
  r={DELETE_RADIUS}
  fill="#18181b"
  stroke="#4ade80"
  stroke-width="1"
  class="cursor-pointer"
  pointer-events="all"
  onpointerdown={(e) => {
    e.stopPropagation();
    deletePoint(index);
  }}
/>

<line
  x1={bx - s}
  y1={by - s}
  x2={bx + s}
  y2={by + s}
  stroke="#4ade80"
  stroke-width="1.5"
  stroke-linecap="round"
  pointer-events="none"
/>

<line
  x1={bx + s}
  y1={by - s}
  x2={bx - s}
  y2={by + s}
  stroke="#4ade80"
  stroke-width="1.5"
  stroke-linecap="round"
  pointer-events="none"
/>
