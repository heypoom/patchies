<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    NodeResizer,
    useSvelteFlow,
    useUpdateNodeInternals,
    type OnResize,
    type OnResizeEnd,
    type OnResizeStart
  } from '@xyflow/svelte';
  import { match, P } from 'ts-pattern';
  import { Expand, Plus, Settings, X } from '@lucide/svelte/icons';

  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { messages } from '$lib/objects/schemas';
  import { schema } from '$lib/objects/schemas/types';
  import { isFullscreenActive } from '$lib/canvas/SurfaceOverlay';
  import { portal } from '$lib/dom/portal';
  import { useNodeDataTracker } from '$lib/history';
  import { VirtualFilesystem } from '$lib/vfs';
  import {
    activeDetachedSheetNodeId,
    closeDetachedSheet,
    openDetachedSheet
  } from '../../stores/detached-sheet.store';
  import { editorFontFamily } from '../../stores/editor.store';
  import { isSidebarOpen } from '../../stores/ui.store';

  import { DEFAULT_SHEET_DATA } from './constants';
  import { SheetClear, SheetLoad, SheetObjects, SheetRows, sheetSchema } from './schema';
  import {
    addColumn,
    addRow,
    buildSheetObjectsOutput,
    buildSheetOutput,
    buildSheetRowsOutput,
    createEmptySheet,
    insertColumn,
    insertRow,
    moveColumn,
    moveRow,
    parseCsvTable,
    removeColumn,
    removeRow,
    tableFromArray,
    tableFromObjects,
    updateCell,
    updateColumnName,
    type SheetCell,
    type SheetData
  } from './sheet-utils';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: Partial<SheetData>;
    selected: boolean;
  } = $props();

  const SHEET_MIN_WIDTH = 280;
  const SHEET_MIN_HEIGHT = 136;
  const SHEET_MAX_WIDTH = 900;
  const SHEET_MAX_HEIGHT = 640;
  const SHEET_DETACHED_WIDTH = 900;
  const SHEET_DETACHED_HEIGHT = 640;
  const SHEET_COLUMN_WIDTH = 110;
  const SHEET_MIN_COLUMN_WIDTH = 64;
  const SHEET_ROW_HEADER_WIDTH = 44;
  const SHEET_ACTION_COLUMN_WIDTH = 44;
  const SHEET_HEADER_ROW = -1;

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const tracker = useNodeDataTracker(nodeId);

  let messageContext: MessageContext;
  let columnsBeforeEdit: string[] | null = null;
  let rowsBeforeEdit: SheetCell[][] | null = null;
  let isDraggingCsv = $state(false);
  let showSettings = $state(false);
  let headerValidationError = $state('');
  let resizingSize = $state<{ width: number; height: number } | null>(null);
  let sizeBeforeResize: { width?: number; height?: number } | null = null;
  type ColumnResizeState = {
    index: number;
    nextIndex: number | null;
    startX: number;
    startWidth: number;
    startNextWidth: number;
    widths: number[];
  };

  type CellPosition = { rowIndex: number; columnIndex: number };
  type ColumnDragState = {
    fromIndex: number;
    targetIndex: number;
    startX: number;
    currentX: number;
    isDragging: boolean;
  };
  type RowDragState = {
    fromIndex: number;
    targetIndex: number;
    startY: number;
    currentY: number;
    isDragging: boolean;
  };
  type CellSelectionRange = {
    anchor: CellPosition;
    focus: CellPosition;
  };

  let resizingColumn = $state<ColumnResizeState | null>(null);
  let columnWidthsBeforeResize: number[] | null = null;
  let contextTarget = $state<
    | { type: 'column'; index: number }
    | { type: 'row'; index: number }
    | { type: 'cell'; rowIndex: number; columnIndex: number }
    | null
  >(null);
  let selectedCell = $state<CellPosition | null>(null);
  let selectedRange = $state<CellSelectionRange | null>(null);
  let editingCell = $state<CellPosition | null>(null);
  let editingHeaderColumn = $state<number | null>(null);
  let isSelectingCells = $state(false);
  let detachedViewportSize = $state({
    width: SHEET_DETACHED_WIDTH,
    height: SHEET_DETACHED_HEIGHT
  });
  let draggingColumn = $state<ColumnDragState | null>(null);
  let draggingRow = $state<RowDragState | null>(null);
  let columnsBeforeDrag: string[] | null = null;
  let rowsBeforeDrag: SheetCell[][] | null = null;
  let columnWidthsBeforeDrag: number[] | null = null;
  let rowsBeforeRowDrag: SheetCell[][] | null = null;

  const columns = $derived(data.columns ?? DEFAULT_SHEET_DATA.columns);
  const rows = $derived(data.rows ?? DEFAULT_SHEET_DATA.rows);
  const outputObjects = $derived(data.outputObjects ?? false);
  const width = $derived(data.width);
  const height = $derived(data.height);
  const isDetached = $derived($activeDetachedSheetNodeId === nodeId);
  const columnWidths = $derived(normalizeColumnWidths(data.columnWidths, columns.length));
  const activeColumnWidths = $derived(resizingColumn?.widths ?? columnWidths);
  const baseTableContentWidth = $derived(
    activeColumnWidths.reduce((sum: number, columnWidth: number) => sum + columnWidth, 0) +
      SHEET_ROW_HEADER_WIDTH +
      SHEET_ACTION_COLUMN_WIDTH
  );
  const normalizedData = $derived<SheetData>({
    columns,
    rows,
    outputObjects,
    width,
    height,
    columnWidths
  });
  const autoTableWidth = $derived(Math.min(520, Math.max(SHEET_MIN_WIDTH, baseTableContentWidth)));
  const displayWidth = $derived(resizingSize?.width ?? width ?? autoTableWidth);
  const displayHeight = $derived(resizingSize?.height ?? height);
  const sheetViewportWidth = $derived(
    isDetached ? Math.max(displayWidth, detachedViewportSize.width) : displayWidth
  );
  const sheetViewportHeight = $derived(
    isDetached
      ? Math.max(displayHeight ?? SHEET_MIN_HEIGHT, detachedViewportSize.height)
      : displayHeight
  );
  const renderedColumnWidths = $derived(
    fillColumnWidths(
      activeColumnWidths,
      Math.max(0, sheetViewportWidth - SHEET_ROW_HEADER_WIDTH - SHEET_ACTION_COLUMN_WIDTH)
    )
  );
  const draggingColumnWidth = $derived(
    draggingColumn ? (renderedColumnWidths[draggingColumn.fromIndex] ?? SHEET_COLUMN_WIDTH) : 0
  );
  const selectedRangeRect = $derived(getSelectedRangeRect());
  const tableContentWidth = $derived(
    renderedColumnWidths.reduce((sum: number, columnWidth: number) => sum + columnWidth, 0) +
      SHEET_ROW_HEADER_WIDTH +
      SHEET_ACTION_COLUMN_WIDTH
  );
  const containerClass = $derived(
    selected ? 'object-container-selected !bg-zinc-900' : 'object-container-light'
  );
  const detachedPortalTarget = $derived(
    isDetached && typeof document !== 'undefined' ? document.body : null
  );

  const sheetMessages = {
    clear: schema(SheetClear),
    load: schema(SheetLoad),
    rows: schema(SheetRows),
    objects: schema(SheetObjects)
  };

  function commitData(oldData: SheetData, newData: SheetData) {
    updateNodeData(nodeId, newData);
    tracker.commit('columns', oldData.columns, newData.columns);
    tracker.commit('rows', oldData.rows, newData.rows);
    tracker.commit('outputObjects', oldData.outputObjects, newData.outputObjects);
    tracker.commit('columnWidths', oldData.columnWidths, newData.columnWidths);
    setTimeout(() => updateNodeInternals(nodeId), 0);
  }

  function setData(nextData: SheetData) {
    commitData(normalizedData, {
      ...nextData,
      width,
      height,
      columnWidths: reconcileColumnWidths(
        nextData.columnWidths ?? columnWidths,
        nextData.columns.length
      )
    });
  }

  function normalizeColumnWidths(widths: number[] | undefined, count: number) {
    return Array.from({ length: count }, (_, index) =>
      Math.max(SHEET_MIN_COLUMN_WIDTH, widths?.[index] ?? SHEET_COLUMN_WIDTH)
    );
  }

  function reconcileColumnWidths(widths: number[], count: number) {
    return normalizeColumnWidths(widths, count);
  }

  function fillColumnWidths(widths: number[], targetWidth: number) {
    const currentWidth = widths.reduce((sum, columnWidth) => sum + columnWidth, 0);
    if (widths.length === 0 || currentWidth >= targetWidth) return widths;

    const extraWidth = (targetWidth - currentWidth) / widths.length;
    return widths.map((columnWidth) => columnWidth + extraWidth);
  }

  function beginColumnEdit() {
    columnsBeforeEdit = [...columns];
  }

  function endColumnEdit() {
    if (columnsBeforeEdit) {
      tracker.commit('columns', columnsBeforeEdit, columns);
      columnsBeforeEdit = null;
    }
  }

  function beginCellEdit() {
    rowsBeforeEdit = rows.map((row) => [...row]);
  }

  function endCellEdit() {
    if (rowsBeforeEdit) {
      tracker.commit('rows', rowsBeforeEdit, rows);
      rowsBeforeEdit = null;
    }
  }

  function setColumnName(columnIndex: number, value: string) {
    const trimmed = value.trim();

    const isDuplicate = normalizedData.columns.some(
      (column, index) => index !== columnIndex && column.trim() === trimmed
    );

    if (!trimmed || isDuplicate) {
      headerValidationError = !trimmed
        ? 'Column headers cannot be blank'
        : 'Column headers must be unique';
      return;
    }

    headerValidationError = '';
    updateNodeData(nodeId, updateColumnName(normalizedData, columnIndex, value));
    setTimeout(() => updateNodeInternals(nodeId), 0);
  }

  function setCell(rowIndex: number, columnIndex: number, value: string) {
    updateNodeData(nodeId, updateCell(normalizedData, rowIndex, columnIndex, value));
  }

  function isSelectedCell(rowIndex: number, columnIndex: number) {
    return selectedCell?.rowIndex === rowIndex && selectedCell.columnIndex === columnIndex;
  }

  function isCellInSelectedRange(rowIndex: number, columnIndex: number) {
    if (!selectedRange) return isSelectedCell(rowIndex, columnIndex);

    const bounds = getSelectedRangeBounds();
    if (!bounds) return false;

    return (
      rowIndex >= bounds.minRow &&
      rowIndex <= bounds.maxRow &&
      columnIndex >= bounds.minColumn &&
      columnIndex <= bounds.maxColumn
    );
  }

  function getSelectedRangeBounds() {
    if (!selectedRange) return null;

    return {
      minRow: Math.min(selectedRange.anchor.rowIndex, selectedRange.focus.rowIndex),
      maxRow: Math.max(selectedRange.anchor.rowIndex, selectedRange.focus.rowIndex),
      minColumn: Math.min(selectedRange.anchor.columnIndex, selectedRange.focus.columnIndex),
      maxColumn: Math.max(selectedRange.anchor.columnIndex, selectedRange.focus.columnIndex)
    };
  }

  function isEditingCell(rowIndex: number, columnIndex: number) {
    return editingCell?.rowIndex === rowIndex && editingCell.columnIndex === columnIndex;
  }

  function getSelectedRangeRect() {
    const bounds = getSelectedRangeBounds();
    if (!bounds || bounds.minRow < 0) return null;

    const startCell = document.querySelector<HTMLElement>(
      `[data-sheet-node="${nodeId}"] [data-cell-display="${bounds.minRow}-${bounds.minColumn}"]`
    );
    const endCell = document.querySelector<HTMLElement>(
      `[data-sheet-node="${nodeId}"] [data-cell-display="${bounds.maxRow}-${bounds.maxColumn}"]`
    );
    const table = document.querySelector<HTMLElement>(`[data-sheet-table="${nodeId}"]`);

    if (!startCell || !endCell || !table) return null;

    const tableRect = table.getBoundingClientRect();
    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();
    const scaleX = tableRect.width / table.offsetWidth || 1;
    const scaleY = tableRect.height / table.offsetHeight || scaleX;

    return {
      left: (startRect.left - tableRect.left) / scaleX,
      top: (startRect.top - tableRect.top) / scaleY,
      width: (endRect.right - startRect.left) / scaleX,
      height: (endRect.bottom - startRect.top) / scaleY
    };
  }

  function isSelectedHeader(columnIndex: number) {
    return isSelectedCell(SHEET_HEADER_ROW, columnIndex);
  }

  async function selectCell(rowIndex: number, columnIndex: number, target?: HTMLElement) {
    selectedCell = { rowIndex, columnIndex };
    selectedRange =
      rowIndex >= 0
        ? { anchor: { rowIndex, columnIndex }, focus: { rowIndex, columnIndex } }
        : null;
    editingCell = null;
    editingHeaderColumn = null;
    await tick();
    target?.focus();
  }

  async function selectHeader(columnIndex: number, target?: HTMLElement) {
    await selectCell(SHEET_HEADER_ROW, columnIndex, target);
  }

  function beginCellSelection(event: PointerEvent, rowIndex: number, columnIndex: number) {
    if (event.button !== 0) return;

    event.preventDefault();
    selectedCell = { rowIndex, columnIndex };
    selectedRange = {
      anchor: { rowIndex, columnIndex },
      focus: { rowIndex, columnIndex }
    };
    editingCell = null;
    editingHeaderColumn = null;
    isSelectingCells = true;
    (event.currentTarget as HTMLElement | null)?.focus();
    window.addEventListener('pointerup', endCellSelection, { once: true });
  }

  function extendCellSelection(rowIndex: number, columnIndex: number) {
    if (!isSelectingCells || !selectedRange) return;

    selectedRange = {
      ...selectedRange,
      focus: { rowIndex, columnIndex }
    };
  }

  function endCellSelection() {
    isSelectingCells = false;
  }

  async function enterCellEdit(rowIndex: number, columnIndex: number, initialValue?: string) {
    selectedCell = { rowIndex, columnIndex };
    selectedRange = {
      anchor: { rowIndex, columnIndex },
      focus: { rowIndex, columnIndex }
    };
    editingCell = { rowIndex, columnIndex };
    editingHeaderColumn = null;

    beginCellEdit();
    if (initialValue !== undefined) {
      setCell(rowIndex, columnIndex, initialValue);
    }

    await tick();

    const textarea = document.querySelector<HTMLTextAreaElement>(
      `[data-sheet-node="${nodeId}"] textarea[data-cell="${rowIndex}-${columnIndex}"]`
    );

    if (!textarea) return;

    resizeTextarea(textarea);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  async function enterHeaderEdit(columnIndex: number, initialValue?: string) {
    selectedCell = { rowIndex: SHEET_HEADER_ROW, columnIndex };
    editingCell = null;
    editingHeaderColumn = columnIndex;

    beginColumnEdit();
    if (initialValue !== undefined) {
      setColumnName(columnIndex, initialValue);
    }

    await tick();

    const input = document.querySelector<HTMLInputElement>(
      `[data-sheet-table="${nodeId}"] input[data-header="${columnIndex}"]`
    );

    if (!input) return;

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function finishCellEdit() {
    editingCell = null;
    endCellEdit();
  }

  function finishHeaderEdit() {
    editingHeaderColumn = null;
    endColumnEdit();
  }

  function handleCellEditKeydown(event: KeyboardEvent, rowIndex: number, columnIndex: number) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finishCellEdit();
      focusCell({ rowIndex, columnIndex });
      return;
    }

    handleCellKeydown(event);
  }

  function handleHeaderEditKeydown(event: KeyboardEvent, columnIndex: number) {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    event.stopPropagation();
    finishHeaderEdit();
    focusHeader(columnIndex);
  }

  function isPrintableKey(event: KeyboardEvent) {
    return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
  }

  function handleSelectedCellKeydown(event: KeyboardEvent, rowIndex: number, columnIndex: number) {
    if (!isSelectedCell(rowIndex, columnIndex)) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      clearSelectedCells();
      return;
    }

    const nextCell = getCellForArrowKey(event.key, rowIndex, columnIndex);

    if (nextCell) {
      event.preventDefault();
      event.stopPropagation();
      selectedCell = nextCell;
      selectedRange = { anchor: nextCell, focus: nextCell };
      focusCell(nextCell);
      return;
    }

    if (isPrintableKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      enterCellEdit(rowIndex, columnIndex, event.key);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      enterCellEdit(rowIndex, columnIndex);
    }
  }

  function getCellForArrowKey(key: string, rowIndex: number, columnIndex: number) {
    const nextCell = match(key)
      .with('ArrowLeft', () => ({ rowIndex, columnIndex: columnIndex - 1 }))
      .with('ArrowRight', () => ({ rowIndex, columnIndex: columnIndex + 1 }))
      .with('ArrowUp', () => ({ rowIndex: rowIndex - 1, columnIndex }))
      .with('ArrowDown', () => ({ rowIndex: rowIndex + 1, columnIndex }))
      .otherwise(() => null);

    if (!nextCell) return null;

    return {
      rowIndex: Math.max(0, Math.min(rows.length - 1, nextCell.rowIndex)),
      columnIndex: Math.max(0, Math.min(columns.length - 1, nextCell.columnIndex))
    };
  }

  async function focusCell(cell: CellPosition) {
    await tick();

    document
      .querySelector<HTMLElement>(
        `[data-sheet-node="${nodeId}"] [data-cell-display="${cell.rowIndex}-${cell.columnIndex}"]`
      )
      ?.focus();
  }

  async function focusHeader(columnIndex: number) {
    await tick();

    document
      .querySelector<HTMLElement>(
        `[data-sheet-table="${nodeId}"] [data-header-display="${columnIndex}"]`
      )
      ?.focus();
  }

  function clearSelectedCells() {
    if (!selectedRange) return;

    const minRow = Math.max(
      0,
      Math.min(selectedRange.anchor.rowIndex, selectedRange.focus.rowIndex)
    );
    const maxRow = Math.min(
      rows.length - 1,
      Math.max(selectedRange.anchor.rowIndex, selectedRange.focus.rowIndex)
    );
    const minColumn = Math.max(
      0,
      Math.min(selectedRange.anchor.columnIndex, selectedRange.focus.columnIndex)
    );
    const maxColumn = Math.min(
      columns.length - 1,
      Math.max(selectedRange.anchor.columnIndex, selectedRange.focus.columnIndex)
    );
    const oldRows = rows.map((row) => [...row]);
    const nextRows = rows.map((row, rowIndex) =>
      row.map((cell, columnIndex) =>
        rowIndex >= minRow &&
        rowIndex <= maxRow &&
        columnIndex >= minColumn &&
        columnIndex <= maxColumn
          ? ''
          : cell
      )
    );

    updateNodeData(nodeId, { ...normalizedData, rows: nextRows });
    tracker.commit('rows', oldRows, nextRows);
  }

  function handleSelectedHeaderKeydown(event: KeyboardEvent, columnIndex: number) {
    if (!isSelectedHeader(columnIndex)) return;

    if (isPrintableKey(event)) {
      event.preventDefault();
      enterHeaderEdit(columnIndex, event.key);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      enterHeaderEdit(columnIndex);
    }
  }

  function clearTable() {
    setData({ ...createEmptySheet(), outputObjects });
  }

  function setOutputObjects(value: boolean) {
    const oldValue = outputObjects;
    updateNodeData(nodeId, { ...normalizedData, outputObjects: value });
    tracker.commit('outputObjects', oldValue, value);
  }

  function openExpandedSheet() {
    showSettings = false;
    openDetachedSheet(nodeId);
  }

  function closeExpandedSheet() {
    showSettings = false;
    closeDetachedSheet();
  }

  function setColumnContext(columnIndex: number) {
    contextTarget = { type: 'column', index: columnIndex };
  }

  function setRowContext(rowIndex: number) {
    if (contextTarget?.type === 'cell') return;

    contextTarget = { type: 'row', index: rowIndex };
  }

  function setCellContext(rowIndex: number, columnIndex: number) {
    contextTarget = { type: 'cell', rowIndex, columnIndex };
  }

  function getContextRowIndex() {
    if (contextTarget?.type === 'row') return contextTarget.index;
    if (contextTarget?.type === 'cell') return contextTarget.rowIndex;
    return null;
  }

  function addContextRowAbove() {
    const rowIndex = getContextRowIndex();
    if (rowIndex === null) return;
    setData(insertRow(normalizedData, rowIndex));
  }

  function addContextRowBelow() {
    const rowIndex = getContextRowIndex();
    if (rowIndex === null) return;
    setData(insertRow(normalizedData, rowIndex + 1));
  }

  function moveContextRow(delta: -1 | 1) {
    const rowIndex = getContextRowIndex();
    if (rowIndex === null) return;
    setData(moveRow(normalizedData, rowIndex, rowIndex + delta));
  }

  function removeContextRow() {
    const rowIndex = getContextRowIndex();
    if (rowIndex === null) return;
    setData(removeRow(normalizedData, rowIndex));
  }

  function moveContextColumn(delta: -1 | 1) {
    if (contextTarget?.type !== 'column') return;
    setData(moveColumn(normalizedData, contextTarget.index, contextTarget.index + delta));
  }

  function addContextColumnLeft() {
    if (contextTarget?.type !== 'column') return;
    setData(insertColumn(normalizedData, contextTarget.index));
  }

  function addContextColumnRight() {
    if (contextTarget?.type !== 'column') return;
    setData(insertColumn(normalizedData, contextTarget.index + 1));
  }

  function removeContextColumn() {
    if (contextTarget?.type !== 'column') return;
    setData(removeColumn(normalizedData, contextTarget.index));
  }

  const handleResizeStart: OnResizeStart = () => {
    sizeBeforeResize = { width, height };
  };

  const handleResize: OnResize = (_event, params) => {
    resizingSize = { width: params.width, height: params.height };
  };

  const handleResizeEnd: OnResizeEnd = (_event, params) => {
    const nextWidth = params.width;
    const nextHeight = params.height;

    resizingSize = { width: nextWidth, height: nextHeight };
    updateNodeData(nodeId, {
      ...normalizedData,
      width: nextWidth,
      height: nextHeight
    });
    tracker.commit('width', sizeBeforeResize?.width, nextWidth);
    tracker.commit('height', sizeBeforeResize?.height, nextHeight);
    sizeBeforeResize = null;
    setTimeout(() => updateNodeInternals(nodeId), 0);
  };

  function beginColumnResize(event: PointerEvent, columnIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    const visibleWidths = [...renderedColumnWidths];
    const nextIndex = columnIndex < columns.length - 1 ? columnIndex + 1 : null;

    columnWidthsBeforeResize = visibleWidths;
    resizingColumn = {
      index: columnIndex,
      nextIndex,
      startX: event.clientX,
      startWidth: visibleWidths[columnIndex] ?? SHEET_COLUMN_WIDTH,
      startNextWidth: nextIndex === null ? 0 : (visibleWidths[nextIndex] ?? SHEET_COLUMN_WIDTH),
      widths: visibleWidths
    };

    window.addEventListener('pointermove', handleColumnResizeMove);
    window.addEventListener('pointerup', endColumnResize, { once: true });
  }

  function handleColumnResizeMove(event: PointerEvent) {
    if (!resizingColumn) return;

    const rawDelta = event.clientX - resizingColumn.startX;
    const nextWidths = [...resizingColumn.widths];

    if (resizingColumn.nextIndex === null) {
      nextWidths[resizingColumn.index] = Math.max(
        SHEET_MIN_COLUMN_WIDTH,
        resizingColumn.startWidth + rawDelta
      );
    } else {
      const minDelta = SHEET_MIN_COLUMN_WIDTH - resizingColumn.startWidth;
      const maxDelta = resizingColumn.startNextWidth - SHEET_MIN_COLUMN_WIDTH;
      const delta = Math.max(minDelta, Math.min(maxDelta, rawDelta));

      nextWidths[resizingColumn.index] = resizingColumn.startWidth + delta;
      nextWidths[resizingColumn.nextIndex] = resizingColumn.startNextWidth - delta;
    }

    resizingColumn = { ...resizingColumn, widths: nextWidths };
  }

  function endColumnResize() {
    if (!resizingColumn) return;

    const nextWidths = resizingColumn.widths;
    resizingColumn = null;

    updateNodeData(nodeId, {
      ...normalizedData,
      columnWidths: nextWidths
    });
    tracker.commit('columnWidths', columnWidthsBeforeResize, nextWidths);
    columnWidthsBeforeResize = null;
    window.removeEventListener('pointermove', handleColumnResizeMove);
    setTimeout(() => updateNodeInternals(nodeId), 0);
  }

  function beginColumnDrag(event: PointerEvent, columnIndex: number) {
    if (event.button !== 0 || resizingColumn) return;

    draggingColumn = {
      fromIndex: columnIndex,
      targetIndex: columnIndex,
      startX: event.clientX,
      currentX: event.clientX,
      isDragging: false
    };
    columnsBeforeDrag = [...columns];
    rowsBeforeDrag = rows.map((row) => [...row]);
    columnWidthsBeforeDrag = [...columnWidths];

    window.addEventListener('pointermove', handleColumnDragMove);
    window.addEventListener('pointerup', endColumnDrag, { once: true });
  }

  function handleColumnDragMove(event: PointerEvent) {
    if (!draggingColumn) return;

    const hasPassedThreshold =
      draggingColumn.isDragging || Math.abs(event.clientX - draggingColumn.startX) > 6;

    if (!hasPassedThreshold) return;

    event.preventDefault();

    draggingColumn = {
      ...draggingColumn,
      currentX: event.clientX,
      isDragging: true,
      targetIndex: getColumnIndexAtX(event.clientX)
    };
  }

  function getColumnIndexAtX(clientX: number) {
    const table = document.querySelector<HTMLTableElement>(`[data-sheet-table="${nodeId}"]`);
    const tableRect = table?.getBoundingClientRect();
    const scaleX = table && tableRect ? tableRect.width / table.offsetWidth || 1 : 1;
    const x = (clientX - (tableRect?.left ?? 0)) / scaleX - SHEET_ROW_HEADER_WIDTH;
    let left = 0;
    let closestIndex = 0;

    for (let index = 0; index < renderedColumnWidths.length; index++) {
      const width = renderedColumnWidths[index];
      const center = left + width / 2;

      if (x >= center) {
        closestIndex = index;
      }

      left += width;
    }

    return Math.max(0, Math.min(columns.length - 1, closestIndex));
  }

  function getColumnLeft(index: number) {
    return (
      SHEET_ROW_HEADER_WIDTH +
      renderedColumnWidths
        .slice(0, Math.max(0, index))
        .reduce((sum: number, columnWidth: number) => sum + columnWidth, 0)
    );
  }

  function getColumnInsertLeft(index: number) {
    const targetLeft = getColumnLeft(index);
    const targetWidth = renderedColumnWidths[index] ?? SHEET_COLUMN_WIDTH;

    if (!draggingColumn) return targetLeft;

    return draggingColumn.fromIndex < index ? targetLeft + targetWidth : targetLeft;
  }

  function endColumnDrag() {
    if (!draggingColumn) return;

    const { fromIndex, targetIndex, isDragging } = draggingColumn;
    draggingColumn = null;
    window.removeEventListener('pointermove', handleColumnDragMove);

    if (!isDragging || fromIndex === targetIndex) {
      columnsBeforeDrag = null;
      rowsBeforeDrag = null;
      columnWidthsBeforeDrag = null;
      return;
    }

    updateNodeData(nodeId, moveColumn(normalizedData, fromIndex, targetIndex));
    tracker.commit('columns', columnsBeforeDrag, moveItem(columns, fromIndex, targetIndex));
    tracker.commit(
      'rows',
      rowsBeforeDrag,
      rows.map((row) => moveItem(row, fromIndex, targetIndex))
    );
    tracker.commit(
      'columnWidths',
      columnWidthsBeforeDrag,
      moveItem(columnWidths, fromIndex, targetIndex)
    );

    columnsBeforeDrag = null;
    rowsBeforeDrag = null;
    columnWidthsBeforeDrag = null;
    setTimeout(() => updateNodeInternals(nodeId), 0);
  }

  function beginRowDrag(event: PointerEvent, rowIndex: number) {
    if (event.button !== 0 || draggingColumn || resizingColumn) return;

    draggingRow = {
      fromIndex: rowIndex,
      targetIndex: rowIndex,
      startY: event.clientY,
      currentY: event.clientY,
      isDragging: false
    };
    rowsBeforeRowDrag = rows.map((row) => [...row]);

    window.addEventListener('pointermove', handleRowDragMove);
    window.addEventListener('pointerup', endRowDrag, { once: true });
  }

  function handleRowDragMove(event: PointerEvent) {
    if (!draggingRow) return;

    const hasPassedThreshold =
      draggingRow.isDragging || Math.abs(event.clientY - draggingRow.startY) > 6;

    if (!hasPassedThreshold) return;

    event.preventDefault();

    draggingRow = {
      ...draggingRow,
      currentY: event.clientY,
      isDragging: true,
      targetIndex: getRowIndexAtY(event.clientY)
    };
  }

  function getRowIndexAtY(clientY: number) {
    const rowElements = Array.from(
      document.querySelectorAll<HTMLTableRowElement>(`[data-sheet-table="${nodeId}"] tbody tr`)
    );
    let closestIndex = 0;

    rowElements.forEach((rowElement, index) => {
      const rect = rowElement.getBoundingClientRect();
      const center = rect.top + rect.height / 2;

      if (clientY >= center) {
        closestIndex = index;
      }
    });

    return Math.max(0, Math.min(rows.length - 1, closestIndex));
  }

  function getRowInsertTop(index: number) {
    const rowElement = document.querySelector<HTMLTableRowElement>(
      `[data-sheet-table="${nodeId}"] tbody tr[data-row-index="${index}"]`
    );
    const table = document.querySelector<HTMLElement>(`[data-sheet-table="${nodeId}"]`);

    if (!rowElement || !table) return 0;

    const tableRect = table.getBoundingClientRect();
    const rowRect = rowElement.getBoundingClientRect();
    const scaleY = tableRect.height / table.offsetHeight || 1;

    if (!draggingRow) return (rowRect.top - tableRect.top) / scaleY;

    const isAfterTarget = draggingRow.fromIndex < index;
    return ((isAfterTarget ? rowRect.bottom : rowRect.top) - tableRect.top) / scaleY;
  }

  function endRowDrag() {
    if (!draggingRow) return;

    const { fromIndex, targetIndex, isDragging } = draggingRow;
    draggingRow = null;
    window.removeEventListener('pointermove', handleRowDragMove);

    if (!isDragging || fromIndex === targetIndex) {
      rowsBeforeRowDrag = null;
      return;
    }

    updateNodeData(nodeId, moveRow(normalizedData, fromIndex, targetIndex));
    tracker.commit('rows', rowsBeforeRowDrag, moveItem(rows, fromIndex, targetIndex));
    rowsBeforeRowDrag = null;
    setTimeout(() => updateNodeInternals(nodeId), 0);
  }

  function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
    const next = [...items];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
  }

  function sendTableOutput(format: 'setting' | 'rows' | 'objects' = 'setting') {
    const output = match(format)
      .with('rows', () => buildSheetRowsOutput(normalizedData))
      .with('objects', () => buildSheetObjectsOutput(normalizedData))
      .with('setting', () => buildSheetOutput(normalizedData))
      .exhaustive();

    messageContext.send(output);
  }

  function resizeTextarea(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(28, textarea.scrollHeight)}px`;
  }

  async function resizeRenderedTextareas() {
    await tick();

    document
      .querySelectorAll<HTMLTextAreaElement>(`[data-sheet-node="${nodeId}"] textarea`)
      .forEach(resizeTextarea);
  }

  function handleCellKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || !event.shiftKey) return;

    event.preventDefault();
    sendTableOutput();
  }

  async function loadCsvFromSrc(src: string) {
    let csv: string;

    if (src.startsWith('http://') || src.startsWith('https://')) {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`Failed to load CSV: ${response.status}`);
      csv = await response.text();
    } else {
      const file = await VirtualFilesystem.getInstance().resolve(src);
      csv = await file.text();
    }

    setData({ ...parseCsvTable(csv), outputObjects });
  }

  function setFromUnknownArray(value: unknown[][]) {
    setData({ ...tableFromArray(value), outputObjects });
  }

  function setFromObjectRows(value: Record<string, unknown>[]) {
    setData({ ...tableFromObjects(value), outputObjects });
  }

  const handleMessage: MessageCallbackFn = (message) => {
    if (Array.isArray(message) && message.every((row) => Array.isArray(row))) {
      setFromUnknownArray(message as unknown[][]);
      return;
    }

    if (
      Array.isArray(message) &&
      message.every((row) => typeof row === 'object' && row !== null && !Array.isArray(row))
    ) {
      setFromObjectRows(message as Record<string, unknown>[]);
      return;
    }

    match(message)
      .with(messages.bang, () => {
        sendTableOutput();
      })
      .with(sheetMessages.rows, () => {
        sendTableOutput('rows');
      })
      .with(sheetMessages.objects, () => {
        sendTableOutput('objects');
      })
      .with(sheetMessages.clear, () => {
        clearTable();
      })
      .with(sheetMessages.load, ({ src }) => {
        loadCsvFromSrc(src).catch((error) => {
          console.error('sheet load failed:', error);
        });
      })
      .with(messages.expand, openExpandedSheet)
      .with(messages.collapse, closeExpandedSheet)
      .with(P.string, (csv) => {
        setData({ ...parseCsvTable(csv), outputObjects });
      })
      .otherwise(() => {});
  };

  function handleCsvDragOver(event: DragEvent) {
    const hasCsv = Array.from(event.dataTransfer?.items ?? []).some((item) => {
      const file = item.getAsFile();
      return file?.name.toLowerCase().endsWith('.csv') || item.type === 'text/csv';
    });

    if (!hasCsv) return;

    event.preventDefault();
    event.stopPropagation();
    isDraggingCsv = true;
  }

  function handleCsvDragLeave() {
    isDraggingCsv = false;
  }

  async function handleCsvDrop(event: DragEvent) {
    const file = Array.from(event.dataTransfer?.files ?? []).find(
      (candidate) => candidate.name.toLowerCase().endsWith('.csv') || candidate.type === 'text/csv'
    );

    if (!file) return;

    event.preventDefault();
    event.stopPropagation();
    isDraggingCsv = false;
    setData({ ...parseCsvTable(await file.text()), outputObjects });
  }

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
    resizeRenderedTextareas();
  });

  $effect(() => {
    if (!isDetached) return;

    isSidebarOpen.set(false);
    isFullscreenActive.set(true);

    const updateDetachedViewportSize = () => {
      detachedViewportSize = {
        width: window.innerWidth,
        height: window.innerHeight
      };
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !event.shiftKey) return;

      event.preventDefault();
      event.stopPropagation();
      closeExpandedSheet();
    };

    updateDetachedViewportSize();
    window.addEventListener('resize', updateDetachedViewportSize);
    window.addEventListener('keydown', handleKeydown, { capture: true });

    return () => {
      window.removeEventListener('resize', updateDetachedViewportSize);
      window.removeEventListener('keydown', handleKeydown, { capture: true });
      isFullscreenActive.set(false);
    };
  });

  $effect(() => {
    columns;
    rows;
    resizeRenderedTextareas();
    setTimeout(() => updateNodeInternals(nodeId), 0);
  });

  $effect(() => {
    if (resizingSize && width === resizingSize.width && height === resizingSize.height) {
      resizingSize = null;
    }
  });

  onDestroy(() => {
    if (isDetached) {
      closeDetachedSheet();
    }

    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    window.removeEventListener('pointermove', handleColumnResizeMove);
    window.removeEventListener('pointerup', endColumnResize);
    window.removeEventListener('pointermove', handleColumnDragMove);
    window.removeEventListener('pointerup', endColumnDrag);
    window.removeEventListener('pointermove', handleRowDragMove);
    window.removeEventListener('pointerup', endRowDrag);
    window.removeEventListener('pointerup', endCellSelection);
  });
</script>

<div class="group relative">
  <NodeResizer
    class="z-1"
    isVisible={selected && !isDetached}
    minWidth={SHEET_MIN_WIDTH}
    minHeight={SHEET_MIN_HEIGHT}
    maxWidth={SHEET_MAX_WIDTH}
    maxHeight={SHEET_MAX_HEIGHT}
    onResizeStart={handleResizeStart}
    onResize={handleResize}
    onResizeEnd={handleResizeEnd}
  />

  <div class="absolute -top-7 right-0 z-10">
    <div class="node-floating-controls flex gap-1">
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class="node-floating-button"
            onclick={openExpandedSheet}
            type="button"
            aria-label="Expand sheet"
          >
            <Expand class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Expand Sheet</Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class="node-floating-button"
            onclick={() => (showSettings = !showSettings)}
            type="button"
            aria-label={showSettings ? 'Close settings' : 'Open settings'}
            aria-pressed={showSettings}
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>Settings</Tooltip.Content>
      </Tooltip.Root>
    </div>
  </div>

  <TypedHandle
    port="inlet"
    spec={sheetSchema.inlets[0].handle!}
    title="Commands (bang, clear, load, array)"
    total={1}
    index={0}
    {nodeId}
  />

  <div
    use:portal={detachedPortalTarget}
    class={isDetached
      ? 'nodrag nopan nowheel fixed inset-0 z-[60] flex items-stretch justify-stretch bg-zinc-900'
      : 'contents'}
  >
    <div
      class={[
        'flex min-w-[280px] flex-col overflow-hidden rounded-lg border text-xs text-zinc-200 shadow-lg',
        containerClass,
        isDetached ? '!rounded-none !border-0 !shadow-none' : '',
        isDraggingCsv ? 'border-blue-400 bg-blue-950/40' : ''
      ]}
      ondragover={handleCsvDragOver}
      ondragleave={handleCsvDragLeave}
      ondrop={handleCsvDrop}
      role="group"
      aria-label="Editable data table"
      style:width={`${sheetViewportWidth}px`}
      style:height={sheetViewportHeight ? `${sheetViewportHeight}px` : undefined}
    >
      <div
        class="flex shrink-0 cursor-move items-center justify-between border-b border-zinc-700 px-2 py-1.5"
      >
        <span class="font-mono text-[10px] text-zinc-400">sheet</span>
        <div class="flex items-center gap-1">
          <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {columns.length}
            {columns.length === 1 ? 'col' : 'cols'}
          </span>

          {#if isDetached}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  class="nodrag nopan cursor-pointer rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  onclick={closeExpandedSheet}
                  type="button"
                  aria-label="Close expanded sheet"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>Close Expanded Sheet (Shift+Esc)</Tooltip.Content>
            </Tooltip.Root>
          {/if}
        </div>
      </div>

      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div class="flex min-h-0 flex-1 flex-col overflow-hidden" role="presentation">
            <div
              class="nodrag nopan nowheel relative min-h-0 flex-1 overflow-auto"
              style:max-height={isDetached || displayHeight ? undefined : '240px'}
              role="presentation"
              oncontextmenu={(event) => {
                if (event.target === event.currentTarget) contextTarget = null;
              }}
            >
              {#if draggingColumn?.isDragging}
                <div
                  class="pointer-events-none absolute top-0 bottom-0 z-30 border-2 border-blue-300 bg-blue-300/10 shadow-[0_0_10px_rgba(147,197,253,0.35)]"
                  style:left={`${draggingColumn.currentX - draggingColumn.startX + getColumnLeft(draggingColumn.fromIndex)}px`}
                  style:width={`${draggingColumnWidth}px`}
                ></div>

                <div
                  class="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.8)]"
                  style:left={`${getColumnInsertLeft(draggingColumn.targetIndex)}px`}
                ></div>
              {/if}

              {#if draggingRow?.isDragging}
                <div
                  class="pointer-events-none absolute right-0 left-0 z-30 h-0.5 bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.8)]"
                  style:top={`${getRowInsertTop(draggingRow.targetIndex)}px`}
                ></div>
              {/if}

              {#if selectedRangeRect}
                <div
                  class="pointer-events-none absolute z-20 border-2 border-blue-400"
                  style:left={`${selectedRangeRect.left}px`}
                  style:top={`${selectedRangeRect.top}px`}
                  style:width={`${selectedRangeRect.width}px`}
                  style:height={`${selectedRangeRect.height}px`}
                ></div>
              {/if}

              <table
                class="table-fixed border-collapse"
                style:width={`${tableContentWidth}px`}
                data-sheet-table={nodeId}
              >
                <colgroup>
                  <col style:width={`${SHEET_ROW_HEADER_WIDTH}px`} />
                  {#each renderedColumnWidths as columnWidth}
                    <col style:width={`${columnWidth}px`} />
                  {/each}
                  <col style:width={`${SHEET_ACTION_COLUMN_WIDTH}px`} />
                </colgroup>

                <thead>
                  <tr>
                    <th
                      class="border-r border-b border-zinc-700 bg-zinc-800 px-2 py-1.5 text-left font-mono text-[11px] text-zinc-500"
                      aria-label="Row numbers"
                    >
                      #
                    </th>

                    {#each columns as column, columnIndex}
                      <th
                        class={[
                          'relative border-r border-b border-zinc-700 bg-zinc-800 p-0',
                          draggingColumn?.fromIndex === columnIndex ? 'opacity-60' : '',
                          draggingColumn?.targetIndex === columnIndex && draggingColumn.isDragging
                            ? 'bg-zinc-700'
                            : '',
                          isSelectedHeader(columnIndex) ? 'ring-1 ring-blue-400 ring-inset' : '',
                          isSelectedHeader(columnIndex) && editingHeaderColumn !== columnIndex
                            ? 'bg-blue-500/20'
                            : ''
                        ]}
                        oncontextmenu={() => setColumnContext(columnIndex)}
                        onpointerdown={(event) => beginColumnDrag(event, columnIndex)}
                      >
                        <div class="flex min-w-0 items-center">
                          {#if editingHeaderColumn === columnIndex}
                            <input
                              class="w-full bg-transparent px-2 py-1.5 font-mono text-[11px] text-zinc-200 outline-none focus:bg-zinc-700"
                              style:font-family={$editorFontFamily}
                              value={column}
                              aria-label={`Column ${columnIndex + 1} header`}
                              data-header={columnIndex}
                              onpointerdown={(event) => event.stopPropagation()}
                              onblur={finishHeaderEdit}
                              onkeydown={(event) => handleHeaderEditKeydown(event, columnIndex)}
                              oninput={(event) =>
                                setColumnName(columnIndex, event.currentTarget.value)}
                            />
                          {:else}
                            <div
                              class="box-border min-h-7 w-full px-2 py-1.5 text-left font-mono text-[11px] text-zinc-200 outline-none"
                              style:font-family={$editorFontFamily}
                              role="columnheader"
                              tabindex="0"
                              aria-label={`Column ${columnIndex + 1} header`}
                              data-header-display={columnIndex}
                              onclick={(event) => selectHeader(columnIndex, event.currentTarget)}
                              ondblclick={() => enterHeaderEdit(columnIndex)}
                              onkeydown={(event) => handleSelectedHeaderKeydown(event, columnIndex)}
                            >
                              {column}
                            </div>
                          {/if}
                        </div>

                        <button
                          class="nodrag nopan absolute top-0 right-[-4px] bottom-0 z-10 w-2 cursor-col-resize bg-transparent hover:bg-zinc-400/20"
                          type="button"
                          aria-label={`Resize column ${columnIndex + 1}`}
                          onpointerdown={(event) => beginColumnResize(event, columnIndex)}
                        ></button>
                      </th>
                    {/each}

                    <th class="border-b border-zinc-700 bg-zinc-800 px-1">
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          <button
                            class="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                            onclick={() => setData(addColumn(normalizedData))}
                          >
                            <Plus class="h-3.5 w-3.5" />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Add Column</Tooltip.Content>
                      </Tooltip.Root>
                    </th>
                  </tr>
                </thead>

                <tbody data-sheet-node={nodeId}>
                  {#each rows as row, rowIndex}
                    <tr
                      data-row-index={rowIndex}
                      class={draggingRow?.fromIndex === rowIndex ? 'opacity-60' : ''}
                    >
                      <th
                        class={[
                          'cursor-grab border-r border-b border-zinc-700 bg-zinc-900 px-2 py-1 text-left font-mono text-[11px] text-zinc-500 active:cursor-grabbing',
                          draggingRow?.targetIndex === rowIndex && draggingRow.isDragging
                            ? 'bg-zinc-800 text-zinc-300'
                            : ''
                        ]}
                        scope="row"
                        aria-label={`Row ${rowIndex + 1}`}
                        oncontextmenu={() => setRowContext(rowIndex)}
                        onpointerdown={(event) => beginRowDrag(event, rowIndex)}
                      >
                        {rowIndex + 1}
                      </th>

                      {#each columns as _column, columnIndex}
                        <td
                          class={[
                            'border-r border-b p-0',
                            isCellInSelectedRange(rowIndex, columnIndex)
                              ? 'border-blue-500/20 bg-blue-500/20'
                              : 'border-zinc-700'
                          ]}
                          oncontextmenu={() => setCellContext(rowIndex, columnIndex)}
                        >
                          {#if isEditingCell(rowIndex, columnIndex)}
                            <textarea
                              class="box-border block min-h-7 w-full resize-none overflow-hidden bg-transparent px-2 py-1 font-mono text-[11px] leading-5 text-zinc-200 outline-none focus:bg-zinc-800"
                              style:font-family={$editorFontFamily}
                              value={String(row[columnIndex] ?? '')}
                              aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                              data-cell={`${rowIndex}-${columnIndex}`}
                              rows="1"
                              onblur={finishCellEdit}
                              onkeydown={(event) =>
                                handleCellEditKeydown(event, rowIndex, columnIndex)}
                              oninput={(event) => {
                                resizeTextarea(event.currentTarget);
                                setCell(rowIndex, columnIndex, event.currentTarget.value);
                              }}
                            ></textarea>
                          {:else}
                            <div
                              class={[
                                'box-border min-h-7 w-full border border-transparent px-2 py-1 font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-zinc-200 outline-none select-none'
                              ]}
                              style:font-family={$editorFontFamily}
                              role="gridcell"
                              tabindex="0"
                              aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                              data-cell-display={`${rowIndex}-${columnIndex}`}
                              onpointerdown={(event) =>
                                beginCellSelection(event, rowIndex, columnIndex)}
                              onpointerenter={() => extendCellSelection(rowIndex, columnIndex)}
                              ondblclick={() => enterCellEdit(rowIndex, columnIndex)}
                              onkeydown={(event) =>
                                handleSelectedCellKeydown(event, rowIndex, columnIndex)}
                            >
                              {String(row[columnIndex] ?? '')}
                            </div>
                          {/if}
                        </td>
                      {/each}

                      <td class="border-b border-zinc-700 px-1"></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            {#if headerValidationError}
              <div class="border-t border-zinc-700 px-2 py-1 font-mono text-[10px] text-red-300">
                {headerValidationError}
              </div>
            {/if}

            <div
              class="nodrag flex shrink-0 items-center justify-between border-t border-zinc-700 px-2 py-1.5"
              role="presentation"
              oncontextmenu={() => (contextTarget = null)}
            >
              <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                {rows.length} rows
              </span>

              <div class="flex items-center gap-1">
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      class="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                      onclick={() => setData(addRow(normalizedData))}
                    >
                      <Plus class="h-3.5 w-3.5" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Add Row</Tooltip.Content>
                </Tooltip.Root>
              </div>
            </div>
          </div>
        </ContextMenu.Trigger>

        <ContextMenu.Content class="z-[70] w-44">
          {#if contextTarget?.type === 'column'}
            <ContextMenu.Item onclick={addContextColumnLeft}>Insert Column Left</ContextMenu.Item>
            <ContextMenu.Item onclick={addContextColumnRight}>Insert Column Right</ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              disabled={contextTarget.index <= 0}
              onclick={() => moveContextColumn(-1)}
            >
              Move Column Left
            </ContextMenu.Item>
            <ContextMenu.Item
              disabled={contextTarget.index >= columns.length - 1}
              onclick={() => moveContextColumn(1)}
            >
              Move Column Right
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              variant="destructive"
              disabled={columns.length <= 1}
              onclick={removeContextColumn}
            >
              Delete Column
            </ContextMenu.Item>
          {:else if contextTarget?.type === 'cell'}
            <ContextMenu.Item onclick={addContextRowAbove}>Add Row Above</ContextMenu.Item>
            <ContextMenu.Item onclick={addContextRowBelow}>Add Row Below</ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              disabled={contextTarget.rowIndex <= 0}
              onclick={() => moveContextRow(-1)}
            >
              Move Row Up
            </ContextMenu.Item>
            <ContextMenu.Item
              disabled={contextTarget.rowIndex >= rows.length - 1}
              onclick={() => moveContextRow(1)}
            >
              Move Row Down
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              variant="destructive"
              disabled={rows.length <= 1}
              onclick={removeContextRow}
            >
              Delete Row
            </ContextMenu.Item>
          {:else if contextTarget?.type === 'row'}
            <ContextMenu.Item onclick={addContextRowAbove}>Add Row Above</ContextMenu.Item>
            <ContextMenu.Item onclick={addContextRowBelow}>Add Row Below</ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              disabled={contextTarget.index <= 0}
              onclick={() => moveContextRow(-1)}
            >
              Move Row Up
            </ContextMenu.Item>
            <ContextMenu.Item
              disabled={contextTarget.index >= rows.length - 1}
              onclick={() => moveContextRow(1)}
            >
              Move Row Down
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              variant="destructive"
              disabled={rows.length <= 1}
              onclick={removeContextRow}
            >
              Delete Row
            </ContextMenu.Item>
          {:else}
            <ContextMenu.Item onclick={clearTable}>Clear Table</ContextMenu.Item>
          {/if}
        </ContextMenu.Content>
      </ContextMenu.Root>
    </div>
  </div>

  <TypedHandle
    port="outlet"
    spec={sheetSchema.outlets[0].handle!}
    title="Table data output"
    total={1}
    index={0}
    {nodeId}
  />

  {#if showSettings && !isDetached}
    <div class="absolute top-0 left-full z-20 ml-2">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
          aria-label="Close sheet settings"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="nodrag w-52 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <div class="space-y-3">
          <div>
            <div class="text-xs font-medium text-zinc-300">Output</div>
            <div class="mt-1 text-[11px] leading-snug text-zinc-500">
              Bang sends a 2D array unless row objects are enabled.
            </div>
          </div>

          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={outputObjects}
              onchange={(event) => setOutputObjects(event.currentTarget.checked)}
              class="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-800 text-blue-500"
            />
            <span class="text-xs text-zinc-300">Send row objects</span>
          </label>
        </div>
      </div>
    </div>
  {/if}
</div>
