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
  import { Plus, Settings, X } from '@lucide/svelte/icons';

  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import * as ContextMenu from '$lib/components/ui/context-menu';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { messages } from '$lib/objects/schemas';
  import { schema } from '$lib/objects/schemas/types';
  import { useNodeDataTracker } from '$lib/history';
  import { VirtualFilesystem } from '$lib/vfs';
  import { editorFontFamily } from '../../stores/editor.store';

  import { DEFAULT_DATATABLE_DATA } from './constants';
  import {
    DatatableClear,
    DatatableLoad,
    DatatableObjects,
    DatatableRows,
    datatableSchema
  } from './schema';
  import {
    addColumn,
    addRow,
    buildDatatableObjectsOutput,
    buildDatatableOutput,
    buildDatatableRowsOutput,
    createEmptyDatatable,
    moveColumn,
    moveRow,
    parseCsvTable,
    removeColumn,
    removeRow,
    tableFromArray,
    tableFromObjects,
    updateCell,
    updateColumnName,
    type DatatableCell,
    type DatatableData
  } from './datatable-utils';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: Partial<DatatableData>;
    selected: boolean;
  } = $props();

  const DATATABLE_MIN_WIDTH = 280;
  const DATATABLE_MIN_HEIGHT = 136;
  const DATATABLE_MAX_WIDTH = 900;
  const DATATABLE_MAX_HEIGHT = 640;
  const DATATABLE_COLUMN_WIDTH = 110;
  const DATATABLE_MIN_COLUMN_WIDTH = 64;
  const DATATABLE_ACTION_COLUMN_WIDTH = 44;
  const DATATABLE_HEADER_ROW = -1;

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const tracker = useNodeDataTracker(nodeId);

  let messageContext: MessageContext;
  let columnsBeforeEdit: string[] | null = null;
  let rowsBeforeEdit: DatatableCell[][] | null = null;
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
  type CellSelectionRange = {
    anchor: CellPosition;
    focus: CellPosition;
  };

  let resizingColumn = $state<ColumnResizeState | null>(null);
  let columnWidthsBeforeResize: number[] | null = null;
  let contextTarget = $state<
    { type: 'column'; index: number } | { type: 'row'; index: number } | null
  >(null);
  let selectedCell = $state<CellPosition | null>(null);
  let selectedRange = $state<CellSelectionRange | null>(null);
  let editingCell = $state<CellPosition | null>(null);
  let editingHeaderColumn = $state<number | null>(null);
  let isSelectingCells = $state(false);
  let draggingColumn = $state<ColumnDragState | null>(null);
  let columnsBeforeDrag: string[] | null = null;
  let rowsBeforeDrag: DatatableCell[][] | null = null;
  let columnWidthsBeforeDrag: number[] | null = null;

  const columns = $derived(data.columns ?? DEFAULT_DATATABLE_DATA.columns);
  const rows = $derived(data.rows ?? DEFAULT_DATATABLE_DATA.rows);
  const outputObjects = $derived(data.outputObjects ?? false);
  const width = $derived(data.width);
  const height = $derived(data.height);
  const columnWidths = $derived(normalizeColumnWidths(data.columnWidths, columns.length));
  const activeColumnWidths = $derived(resizingColumn?.widths ?? columnWidths);
  const baseTableContentWidth = $derived(
    activeColumnWidths.reduce((sum: number, columnWidth: number) => sum + columnWidth, 0) +
      DATATABLE_ACTION_COLUMN_WIDTH
  );
  const normalizedData = $derived<DatatableData>({
    columns,
    rows,
    outputObjects,
    width,
    height,
    columnWidths
  });
  const autoTableWidth = $derived(
    Math.min(520, Math.max(DATATABLE_MIN_WIDTH, baseTableContentWidth))
  );
  const displayWidth = $derived(resizingSize?.width ?? width ?? autoTableWidth);
  const displayHeight = $derived(resizingSize?.height ?? height);
  const renderedColumnWidths = $derived(
    fillColumnWidths(activeColumnWidths, Math.max(0, displayWidth - DATATABLE_ACTION_COLUMN_WIDTH))
  );
  const draggingColumnWidth = $derived(
    draggingColumn ? (renderedColumnWidths[draggingColumn.fromIndex] ?? DATATABLE_COLUMN_WIDTH) : 0
  );
  const selectedRangeRect = $derived(getSelectedRangeRect());
  const tableContentWidth = $derived(
    renderedColumnWidths.reduce((sum: number, columnWidth: number) => sum + columnWidth, 0) +
      DATATABLE_ACTION_COLUMN_WIDTH
  );
  const containerClass = $derived(
    selected ? 'object-container-selected !bg-zinc-900' : 'object-container-light'
  );

  const datatableMessages = {
    clear: schema(DatatableClear),
    load: schema(DatatableLoad),
    rows: schema(DatatableRows),
    objects: schema(DatatableObjects)
  };

  function commitData(oldData: DatatableData, newData: DatatableData) {
    updateNodeData(nodeId, newData);
    tracker.commit('columns', oldData.columns, newData.columns);
    tracker.commit('rows', oldData.rows, newData.rows);
    tracker.commit('outputObjects', oldData.outputObjects, newData.outputObjects);
    tracker.commit('columnWidths', oldData.columnWidths, newData.columnWidths);
    setTimeout(() => updateNodeInternals(nodeId), 0);
  }

  function setData(nextData: DatatableData) {
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
      Math.max(DATATABLE_MIN_COLUMN_WIDTH, widths?.[index] ?? DATATABLE_COLUMN_WIDTH)
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
      `[data-datatable-node="${nodeId}"] [data-cell-display="${bounds.minRow}-${bounds.minColumn}"]`
    );
    const endCell = document.querySelector<HTMLElement>(
      `[data-datatable-node="${nodeId}"] [data-cell-display="${bounds.maxRow}-${bounds.maxColumn}"]`
    );
    const table = document.querySelector<HTMLElement>(`[data-datatable-table="${nodeId}"]`);

    if (!startCell || !endCell || !table) return null;

    const tableRect = table.getBoundingClientRect();
    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();

    return {
      left: startRect.left - tableRect.left,
      top: startRect.top - tableRect.top,
      width: endRect.right - startRect.left,
      height: endRect.bottom - startRect.top
    };
  }

  function isSelectedHeader(columnIndex: number) {
    return isSelectedCell(DATATABLE_HEADER_ROW, columnIndex);
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
    await selectCell(DATATABLE_HEADER_ROW, columnIndex, target);
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
      `[data-datatable-node="${nodeId}"] textarea[data-cell="${rowIndex}-${columnIndex}"]`
    );

    if (!textarea) return;

    resizeTextarea(textarea);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  async function enterHeaderEdit(columnIndex: number, initialValue?: string) {
    selectedCell = { rowIndex: DATATABLE_HEADER_ROW, columnIndex };
    editingCell = null;
    editingHeaderColumn = columnIndex;

    beginColumnEdit();
    if (initialValue !== undefined) {
      setColumnName(columnIndex, initialValue);
    }

    await tick();

    const input = document.querySelector<HTMLInputElement>(
      `[data-datatable-table="${nodeId}"] input[data-header="${columnIndex}"]`
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
        `[data-datatable-node="${nodeId}"] [data-cell-display="${cell.rowIndex}-${cell.columnIndex}"]`
      )
      ?.focus();
  }

  async function focusHeader(columnIndex: number) {
    await tick();

    document
      .querySelector<HTMLElement>(
        `[data-datatable-table="${nodeId}"] [data-header-display="${columnIndex}"]`
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
    setData({ ...createEmptyDatatable(), outputObjects });
  }

  function setOutputObjects(value: boolean) {
    const oldValue = outputObjects;
    updateNodeData(nodeId, { ...normalizedData, outputObjects: value });
    tracker.commit('outputObjects', oldValue, value);
  }

  function setColumnContext(columnIndex: number) {
    queueMicrotask(() => {
      contextTarget = { type: 'column', index: columnIndex };
    });
  }

  function setRowContext(rowIndex: number) {
    queueMicrotask(() => {
      contextTarget = { type: 'row', index: rowIndex };
    });
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
      startWidth: visibleWidths[columnIndex] ?? DATATABLE_COLUMN_WIDTH,
      startNextWidth: nextIndex === null ? 0 : (visibleWidths[nextIndex] ?? DATATABLE_COLUMN_WIDTH),
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
        DATATABLE_MIN_COLUMN_WIDTH,
        resizingColumn.startWidth + rawDelta
      );
    } else {
      const minDelta = DATATABLE_MIN_COLUMN_WIDTH - resizingColumn.startWidth;
      const maxDelta = resizingColumn.startNextWidth - DATATABLE_MIN_COLUMN_WIDTH;
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
    const table = document.querySelector<HTMLTableElement>(`[data-datatable-table="${nodeId}"]`);
    const x = clientX - (table?.getBoundingClientRect().left ?? 0);
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
    return renderedColumnWidths
      .slice(0, Math.max(0, index))
      .reduce((sum: number, columnWidth: number) => sum + columnWidth, 0);
  }

  function getColumnInsertLeft(index: number) {
    const targetLeft = getColumnLeft(index);
    const targetWidth = renderedColumnWidths[index] ?? DATATABLE_COLUMN_WIDTH;

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

  function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
    const next = [...items];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
  }

  function sendTableOutput(format: 'setting' | 'rows' | 'objects' = 'setting') {
    const output = match(format)
      .with('rows', () => buildDatatableRowsOutput(normalizedData))
      .with('objects', () => buildDatatableObjectsOutput(normalizedData))
      .with('setting', () => buildDatatableOutput(normalizedData))
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
      .querySelectorAll<HTMLTextAreaElement>(`[data-datatable-node="${nodeId}"] textarea`)
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
      .with(datatableMessages.rows, () => {
        sendTableOutput('rows');
      })
      .with(datatableMessages.objects, () => {
        sendTableOutput('objects');
      })
      .with(datatableMessages.clear, () => {
        clearTable();
      })
      .with(datatableMessages.load, ({ src }) => {
        loadCsvFromSrc(src).catch((error) => {
          console.error('datatable load failed:', error);
        });
      })
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
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    window.removeEventListener('pointermove', handleColumnResizeMove);
    window.removeEventListener('pointerup', endColumnResize);
    window.removeEventListener('pointermove', handleColumnDragMove);
    window.removeEventListener('pointerup', endColumnDrag);
    window.removeEventListener('pointerup', endCellSelection);
  });
</script>

<div class="group relative">
  <NodeResizer
    class="z-1"
    isVisible={selected}
    minWidth={DATATABLE_MIN_WIDTH}
    minHeight={DATATABLE_MIN_HEIGHT}
    maxWidth={DATATABLE_MAX_WIDTH}
    maxHeight={DATATABLE_MAX_HEIGHT}
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
    spec={datatableSchema.inlets[0].handle!}
    title="Commands (bang, clear, load, array)"
    total={1}
    index={0}
    {nodeId}
  />

  <ContextMenu.Root>
    <ContextMenu.Trigger>
      <div
        class={[
          'flex min-w-[280px] flex-col overflow-hidden rounded-lg border text-xs text-zinc-200 shadow-lg',
          containerClass,
          isDraggingCsv ? 'border-blue-400 bg-blue-950/40' : ''
        ]}
        ondragover={handleCsvDragOver}
        ondragleave={handleCsvDragLeave}
        ondrop={handleCsvDrop}
        oncontextmenu={() => (contextTarget = null)}
        role="group"
        aria-label="Editable data table"
        style:width={`${displayWidth}px`}
        style:height={displayHeight ? `${displayHeight}px` : undefined}
      >
        <div
          class="flex shrink-0 cursor-move items-center justify-between border-b border-zinc-700 px-2 py-1.5"
        >
          <span class="font-mono text-[10px] text-zinc-400">datatable</span>
          <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {columns.length}
            {columns.length === 1 ? 'col' : 'cols'}
          </span>
        </div>

        <div
          class="nodrag nopan nowheel relative min-h-0 flex-1 overflow-auto"
          style:max-height={displayHeight ? undefined : '240px'}
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
            data-datatable-table={nodeId}
          >
            <colgroup>
              {#each renderedColumnWidths as columnWidth}
                <col style:width={`${columnWidth}px`} />
              {/each}
              <col style:width={`${DATATABLE_ACTION_COLUMN_WIDTH}px`} />
            </colgroup>

            <thead>
              <tr>
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
                          oninput={(event) => setColumnName(columnIndex, event.currentTarget.value)}
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

            <tbody data-datatable-node={nodeId}>
              {#each rows as row, rowIndex}
                <tr oncontextmenu={() => setRowContext(rowIndex)}>
                  {#each columns as _column, columnIndex}
                    <td
                      class={[
                        'border-r border-b p-0',
                        isCellInSelectedRange(rowIndex, columnIndex)
                          ? 'border-blue-500/20 bg-blue-500/20'
                          : 'border-zinc-700'
                      ]}
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
                          onkeydown={(event) => handleCellEditKeydown(event, rowIndex, columnIndex)}
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

    <ContextMenu.Content class="w-44">
      {#if contextTarget?.type === 'column'}
        <ContextMenu.Item
          disabled={contextTarget.index <= 0}
          onclick={() =>
            setData(moveColumn(normalizedData, contextTarget!.index, contextTarget!.index - 1))}
        >
          Move Column Left
        </ContextMenu.Item>
        <ContextMenu.Item
          disabled={contextTarget.index >= columns.length - 1}
          onclick={() =>
            setData(moveColumn(normalizedData, contextTarget!.index, contextTarget!.index + 1))}
        >
          Move Column Right
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item
          variant="destructive"
          disabled={columns.length <= 1}
          onclick={() => setData(removeColumn(normalizedData, contextTarget!.index))}
        >
          Delete Column
        </ContextMenu.Item>
      {:else if contextTarget?.type === 'row'}
        <ContextMenu.Item
          disabled={contextTarget.index <= 0}
          onclick={() =>
            setData(moveRow(normalizedData, contextTarget!.index, contextTarget!.index - 1))}
        >
          Move Row Up
        </ContextMenu.Item>
        <ContextMenu.Item
          disabled={contextTarget.index >= rows.length - 1}
          onclick={() =>
            setData(moveRow(normalizedData, contextTarget!.index, contextTarget!.index + 1))}
        >
          Move Row Down
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item
          variant="destructive"
          disabled={rows.length <= 1}
          onclick={() => setData(removeRow(normalizedData, contextTarget!.index))}
        >
          Delete Row
        </ContextMenu.Item>
      {:else}
        <ContextMenu.Item onclick={clearTable}>Clear Table</ContextMenu.Item>
      {/if}
    </ContextMenu.Content>
  </ContextMenu.Root>

  <TypedHandle
    port="outlet"
    spec={datatableSchema.outlets[0].handle!}
    title="Table data output"
    total={1}
    index={0}
    {nodeId}
  />

  {#if showSettings}
    <div class="absolute top-0 left-full z-20 ml-2">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button
          onclick={() => (showSettings = false)}
          class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
          aria-label="Close datatable settings"
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
