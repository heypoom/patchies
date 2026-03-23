<script lang="ts">
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import { match, P } from 'ts-pattern';
  import { MessageContext } from '$lib/messages/MessageContext';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import {
    DEFAULT_COL_WIDTH,
    DEFAULT_SHEET_COLS,
    DEFAULT_SHEET_ROWS,
    MIN_COL_WIDTH,
    type SheetNodeData
  } from './constants';

  let {
    id: nodeId,
    data,
    selected,
    width: nodeWidth,
    height: nodeHeight
  }: {
    id: string;
    data: SheetNodeData;
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  let messageContext: MessageContext | null = null;

  const rows = $derived(data.rows ?? DEFAULT_SHEET_ROWS);
  const cols = $derived(data.cols ?? DEFAULT_SHEET_COLS);
  const cells = $derived(data.cells ?? []);
  const colWidths = $derived(data.colWidths ?? []);

  function getCell(r: number, c: number): string {
    return cells[r]?.[c] ?? '';
  }

  function getColWidth(c: number): number {
    return colWidths[c] ?? DEFAULT_COL_WIDTH;
  }

  function buildCells(newCells: string[][], r: number, c: number, value: string): string[][] {
    const result = Array.from({ length: Math.max(newCells.length, r + 1) }, (_, i) =>
      newCells[i] ? [...newCells[i]] : []
    );
    while (result[r].length <= c) result[r].push('');
    result[r][c] = value;
    return result;
  }

  function setCell(r: number, c: number, value: string) {
    updateNodeData(nodeId, { ...data, cells: buildCells(cells, r, c, value) });
  }

  function outputData() {
    if (!messageContext) return;
    const result: string[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => getCell(r, c))
    );
    messageContext.send(result);
  }

  function handleMessage(raw: unknown) {
    match(raw)
      .with(
        { type: 'set', row: P.number, col: P.number, value: P.string },
        ({ row, col, value }) => {
          setCell(row, col, value);
        }
      )
      .with({ type: 'clear' }, () => {
        updateNodeData(nodeId, { ...data, cells: [] });
      })
      .otherwise(() => outputData());
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    return () => {
      messageContext?.queue.removeCallback(handleMessage);
      messageContext?.destroy();
    };
  });

  // --- Cell selection & editing ---
  let selectedCell: { r: number; c: number } | null = $state(null);
  let editingCell: { r: number; c: number } | null = $state(null);
  let editValue = $state('');
  let editInput: HTMLInputElement | null = $state(null);

  function selectCell(r: number, c: number) {
    if (editingCell && (editingCell.r !== r || editingCell.c !== c)) commitEdit();
    selectedCell = { r, c };
    focusContainer();
  }

  function clearSelection() {
    if (editingCell) commitEdit();
    selectedCell = null;
    editingCell = null;
  }

  function startEdit(r: number, c: number) {
    selectedCell = { r, c };
    editingCell = { r, c };
    editValue = getCell(r, c);
    setTimeout(() => editInput?.focus(), 0);
  }

  function commitEdit() {
    if (!editingCell) return;
    setCell(editingCell.r, editingCell.c, editValue);
    editingCell = null;
    selectedCell = null;
  }

  function cancelEdit() {
    editingCell = null;
    selectedCell = null;
  }

  function handleEditKeydown(e: KeyboardEvent) {
    e.stopPropagation();

    match(e.key)
      .with('Enter', () => {
        e.preventDefault();
        commitEdit();
      })
      .with('Escape', () => cancelEdit())
      .with('Tab', () => {
        e.preventDefault();
        if (!editingCell) return;
        const { r, c } = editingCell;
        commitEdit();
        const nextC = c + 1 < cols ? c + 1 : 0;
        const nextR = c + 1 < cols ? r : r + 1;
        if (nextR < rows) startEdit(nextR, nextC);
      })
      .otherwise(() => {});
  }

  function handleSelectedKeydown(e: KeyboardEvent) {
    if (!selectedCell || editingCell) return;
    e.stopPropagation();
    match(e.key)
      .with('Enter', 'F2', () => {
        e.preventDefault();
        startEdit(selectedCell!.r, selectedCell!.c);
      })
      .with('Escape', () => {
        selectedCell = null;
      })
      .with('Tab', () => {
        e.preventDefault();
        const { r, c } = selectedCell!;
        const nextC = c + 1 < cols ? c + 1 : 0;
        const nextR = c + 1 < cols ? r : r + 1;
        if (nextR < rows) selectCell(nextR, nextC);
      })
      .with('ArrowRight', () => {
        e.preventDefault();
        const { r, c } = selectedCell!;
        if (c + 1 < cols) selectCell(r, c + 1);
      })
      .with('ArrowLeft', () => {
        e.preventDefault();
        const { r, c } = selectedCell!;
        if (c - 1 >= 0) selectCell(r, c - 1);
      })
      .with('ArrowDown', () => {
        e.preventDefault();
        const { r, c } = selectedCell!;
        if (r + 1 < rows) selectCell(r + 1, c);
      })
      .with('ArrowUp', () => {
        e.preventDefault();
        const { r, c } = selectedCell!;
        if (r - 1 >= 0) selectCell(r - 1, c);
      })
      .with('Delete', 'Backspace', () => {
        e.preventDefault();
        e.stopPropagation();
        setCell(selectedCell!.r, selectedCell!.c, '');
      })
      .otherwise(() => {});
  }

  function cellState(r: number, c: number): 'editing' | 'selected' | 'normal' {
    if (editingCell?.r === r && editingCell?.c === c) return 'editing';
    if (!editingCell && selectedCell?.r === r && selectedCell?.c === c) return 'selected';
    return 'normal';
  }

  // --- Column resizing ---
  let resizingCol: number | null = $state(null);
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  function startColResize(e: MouseEvent, c: number) {
    e.preventDefault();
    e.stopPropagation();
    resizingCol = c;
    resizeStartX = e.clientX;
    resizeStartWidth = getColWidth(c);
  }

  function handleMouseMove(e: MouseEvent) {
    if (resizingCol === null) return;
    const delta = e.clientX - resizeStartX;
    const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth + delta);
    const newColWidths = Array.from(
      { length: Math.max(colWidths.length, resizingCol + 1) },
      (_, i) => (i === resizingCol ? newWidth : (colWidths[i] ?? DEFAULT_COL_WIDTH))
    );
    updateNodeData(nodeId, { ...data, colWidths: newColWidths });
  }

  function handleMouseUp() {
    resizingCol = null;
  }

  // --- Context menu ---
  interface ContextMenuState {
    x: number;
    y: number;
    r: number;
    c: number;
  }

  let contextMenu: ContextMenuState | null = $state(null);

  function handleContextMenu(e: MouseEvent, r: number, c: number) {
    e.preventDefault();
    e.stopPropagation();
    selectCell(r, c);
    contextMenu = { x: e.clientX, y: e.clientY, r, c };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function addRowBelow() {
    updateNodeData(nodeId, { ...data, rows: rows + 1 });
    closeContextMenu();
  }

  function removeRow(r: number) {
    if (rows <= 1) {
      closeContextMenu();
      return;
    }
    const newCells = cells.filter((_, i) => i !== r);
    updateNodeData(nodeId, { ...data, rows: rows - 1, cells: newCells });
    closeContextMenu();
  }

  function addColRight() {
    updateNodeData(nodeId, { ...data, cols: cols + 1 });
    closeContextMenu();
  }

  function removeCol(c: number) {
    if (cols <= 1) {
      closeContextMenu();
      return;
    }
    const newCells = cells.map((row) => row.filter((_, i) => i !== c));
    const newColWidths = colWidths.filter((_, i) => i !== c);
    updateNodeData(nodeId, { ...data, cols: cols - 1, cells: newCells, colWidths: newColWidths });
    closeContextMenu();
  }

  function clearCellAt(r: number, c: number) {
    setCell(r, c, '');
    closeContextMenu();
  }

  function clearAll() {
    updateNodeData(nodeId, { ...data, cells: [] });
    closeContextMenu();
  }

  const containerWidth = $derived(nodeWidth ?? 340);
  const containerHeight = $derived(nodeHeight ?? 180);

  let sheetContainer: HTMLDivElement | null = $state(null);

  function focusContainer() {
    sheetContainer?.focus({ preventScroll: true });
  }
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} onclick={closeContextMenu} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="relative"
  style={resizingCol !== null ? 'cursor: col-resize;' : ''}
  onclick={(e) => {
    if (e.target === e.currentTarget) clearSelection();
  }}
>
  <NodeResizer isVisible={selected} minWidth={150} minHeight={100} />

  <div class="group relative">
    <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
      <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
        <div class="font-mono text-xs font-medium text-zinc-400">sheet</div>
      </div>
    </div>

    <StandardHandle
      port="inlet"
      {nodeId}
      title="bang / set (row, col, value) / clear — trigger output or edit cells"
      total={1}
      index={0}
    />

    <!-- Sheet container -->
    <div
      bind:this={sheetContainer}
      class="nodrag overflow-auto rounded border border-zinc-700 bg-zinc-950 font-mono text-xs outline-none"
      style="width: {containerWidth}px; height: {containerHeight}px;"
      tabindex="-1"
      onkeydown={handleSelectedKeydown}
    >
      <table class="border-collapse" style="min-width: 100%;">
        <thead>
          <tr>
            <!-- Row number gutter header -->
            <th
              class="sticky left-0 z-10 w-6 border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-center text-zinc-500 select-none"
            >
              #
            </th>
            {#each Array(cols) as _, c (c)}
              <th
                class="relative border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-center font-normal text-zinc-400 select-none"
                style="width: {getColWidth(c)}px; min-width: {getColWidth(c)}px;"
              >
                {String.fromCharCode(65 + c)}
                <!-- Column resize handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/40"
                  onmousedown={(e) => startColResize(e, c)}
                ></div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each Array(rows) as _, r (r)}
            <tr>
              <!-- Row number -->
              <td
                class="sticky left-0 z-10 border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-center text-zinc-500 select-none"
              >
                {r + 1}
              </td>
              {#each Array(cols) as _, c (c)}
                {@const state = cellState(r, c)}
                <td
                  class={[
                    'relative border p-0',
                    state === 'editing' && 'z-20 border-blue-400',
                    state === 'selected' && 'z-10 border-blue-500',
                    state === 'normal' && 'border-zinc-700'
                  ]}
                  style="width: {getColWidth(c)}px; min-width: {getColWidth(c)}px;"
                  oncontextmenu={(e) => handleContextMenu(e, r, c)}
                  role="gridcell"
                >
                  {#if state === 'editing'}
                    <input
                      bind:this={editInput}
                      class="w-full bg-zinc-900 px-1 py-0.5 text-zinc-100 outline-none"
                      bind:value={editValue}
                      onblur={commitEdit}
                      onkeydown={handleEditKeydown}
                    />
                  {:else}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                      class={[
                        'min-h-5 cursor-default truncate px-1 py-0.5',
                        state === 'selected'
                          ? 'bg-blue-500/10 text-zinc-100'
                          : 'text-zinc-300 hover:bg-zinc-800/60'
                      ]}
                      onclick={(e) => {
                        e.stopPropagation();
                        selectCell(r, c);
                      }}
                      ondblclick={() => startEdit(r, c)}
                    >
                      {getCell(r, c)}
                    </div>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <StandardHandle
      port="outlet"
      {nodeId}
      title="data — 2D array of cell values (string[][])"
      total={1}
      index={0}
    />
  </div>
</div>

<!-- Context menu (fixed to viewport) -->
{#if contextMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed z-[9999] min-w-36 rounded border border-zinc-600 bg-zinc-900 py-1 shadow-xl"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    onclick={(e) => e.stopPropagation()}
  >
    <button
      class="w-full cursor-pointer px-3 py-1 text-left text-xs text-zinc-200 hover:bg-zinc-700"
      onclick={() => clearCellAt(contextMenu!.r, contextMenu!.c)}
    >
      Clear cell
    </button>
    <button
      class="w-full cursor-pointer px-3 py-1 text-left text-xs text-zinc-400 hover:bg-zinc-700"
      onclick={clearAll}
    >
      Clear all cells
    </button>
    <hr class="my-1 border-zinc-700" />
    <button
      class="w-full cursor-pointer px-3 py-1 text-left text-xs text-zinc-200 hover:bg-zinc-700"
      onclick={addRowBelow}
    >
      Add row
    </button>
    <button
      class={[
        'w-full cursor-pointer px-3 py-1 text-left text-xs hover:bg-zinc-700',
        rows <= 1 ? 'cursor-not-allowed text-zinc-600' : 'text-zinc-200'
      ]}
      onclick={() => removeRow(contextMenu!.r)}
      disabled={rows <= 1}
    >
      Remove this row
    </button>
    <hr class="my-1 border-zinc-700" />
    <button
      class="w-full cursor-pointer px-3 py-1 text-left text-xs text-zinc-200 hover:bg-zinc-700"
      onclick={addColRight}
    >
      Add column
    </button>
    <button
      class={[
        'w-full cursor-pointer px-3 py-1 text-left text-xs hover:bg-zinc-700',
        cols <= 1 ? 'cursor-not-allowed text-zinc-600' : 'text-zinc-200'
      ]}
      onclick={() => removeCol(contextMenu!.c)}
      disabled={cols <= 1}
    >
      Remove this column
    </button>
  </div>
{/if}
