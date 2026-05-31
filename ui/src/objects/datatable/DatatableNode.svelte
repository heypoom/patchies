<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { match, P } from 'ts-pattern';
  import { Plus, Settings, Trash2, X } from '@lucide/svelte/icons';

  import TypedHandle from '$lib/components/TypedHandle.svelte';
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

  const { updateNodeData } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const tracker = useNodeDataTracker(nodeId);

  let messageContext: MessageContext;
  let columnsBeforeEdit: string[] | null = null;
  let rowsBeforeEdit: DatatableCell[][] | null = null;
  let isDraggingCsv = $state(false);
  let showSettings = $state(false);
  let headerValidationError = $state('');

  const columns = $derived(data.columns ?? DEFAULT_DATATABLE_DATA.columns);
  const rows = $derived(data.rows ?? DEFAULT_DATATABLE_DATA.rows);
  const outputObjects = $derived(data.outputObjects ?? false);
  const normalizedData = $derived<DatatableData>({ columns, rows, outputObjects });
  const tableWidth = $derived(Math.min(520, Math.max(280, columns.length * 110 + 44)));
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
    setTimeout(() => updateNodeInternals(nodeId), 0);
  }

  function setData(nextData: DatatableData) {
    commitData(normalizedData, nextData);
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

  function clearTable() {
    setData({ ...createEmptyDatatable(), outputObjects });
  }

  function setOutputObjects(value: boolean) {
    const oldValue = outputObjects;
    updateNodeData(nodeId, { ...normalizedData, outputObjects: value });
    tracker.commit('outputObjects', oldValue, value);
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

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
  });
</script>

<div class="group relative">
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

  <div
    class={[
      'min-w-[280px] overflow-hidden rounded-lg border text-xs text-zinc-200 shadow-lg',
      containerClass,
      isDraggingCsv ? 'border-blue-400 bg-blue-950/40' : ''
    ]}
    ondragover={handleCsvDragOver}
    ondragleave={handleCsvDragLeave}
    ondrop={handleCsvDrop}
    role="group"
    aria-label="Editable data table"
    style:width={`${tableWidth}px`}
  >
    <div class="flex cursor-move items-center justify-between border-b border-zinc-700 px-2 py-1.5">
      <span class="font-mono text-[10px] text-zinc-400">datatable</span>
      <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
        {columns.length}
        {columns.length === 1 ? 'col' : 'cols'}
      </span>
    </div>

    <div class="nodrag nopan nowheel max-h-[240px] max-w-[520px] overflow-auto">
      <table class="w-full min-w-max border-collapse">
        <thead>
          <tr>
            {#each columns as column, columnIndex}
              <th class="border-r border-b border-zinc-700 bg-zinc-800 p-0">
                <div class="flex min-w-[110px] items-center">
                  <input
                    class="w-full bg-transparent px-2 py-1.5 font-mono text-[11px] text-zinc-200 outline-none focus:bg-zinc-700"
                    style:font-family={$editorFontFamily}
                    value={column}
                    aria-label={`Column ${columnIndex + 1} header`}
                    onfocus={beginColumnEdit}
                    onblur={endColumnEdit}
                    oninput={(event) => setColumnName(columnIndex, event.currentTarget.value)}
                  />

                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <button
                        class="cursor-pointer px-1.5 py-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={columns.length <= 1}
                        onclick={() => setData(removeColumn(normalizedData, columnIndex))}
                      >
                        <Trash2 class="h-3 w-3" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Remove Column</Tooltip.Content>
                  </Tooltip.Root>
                </div>
              </th>
            {/each}

            <th class="w-11 border-b border-zinc-700 bg-zinc-800 px-1">
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
            <tr>
              {#each columns as _column, columnIndex}
                <td class="border-r border-b border-zinc-700 p-0">
                  <textarea
                    class="box-border block min-h-7 w-full min-w-[110px] resize-none overflow-hidden bg-transparent px-2 py-1 font-mono text-[11px] leading-5 text-zinc-200 outline-none focus:bg-zinc-800"
                    style:font-family={$editorFontFamily}
                    value={String(row[columnIndex] ?? '')}
                    aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                    rows="1"
                    onfocus={beginCellEdit}
                    onblur={endCellEdit}
                    onkeydown={handleCellKeydown}
                    oninput={(event) => {
                      resizeTextarea(event.currentTarget);
                      setCell(rowIndex, columnIndex, event.currentTarget.value);
                    }}
                  ></textarea>
                </td>
              {/each}

              <td class="w-11 border-b border-zinc-700 px-1">
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <button
                      class="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={rows.length <= 1}
                      onclick={() => setData(removeRow(normalizedData, rowIndex))}
                    >
                      <Trash2 class="h-3 w-3" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Remove Row</Tooltip.Content>
                </Tooltip.Root>
              </td>
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

    <div class="nodrag flex items-center justify-between border-t border-zinc-700 px-2 py-1.5">
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

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
              onclick={clearTable}
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Clear Table</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </div>
  </div>

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
