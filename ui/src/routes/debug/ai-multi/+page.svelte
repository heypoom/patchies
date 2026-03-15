<script lang="ts">
  import { resolveMultipleObjectsFromPrompt } from '$lib/ai/multi-object-resolver';
  import { handleMultiObjectInsert } from '$lib/ai/handle-multi-object-insert';
  import type { AiObjectNode, SimplifiedEdge, MultiObjectResult } from '$lib/ai/types';
  import type { MultiObjectInsertResult } from '$lib/ai/handle-multi-object-insert';
  import { validateHandle, NODE_HANDLE_SPECS } from '$lib/ai/debug/handle-specs';
  import {
    EVAL_CASES,
    loadResults,
    saveResults,
    clearResults,
    type EvalCase,
    type EvalResult,
    type EvalEdgeResult,
    type EvalStatus
  } from '$lib/ai/debug/eval-cases';
  import { onMount } from 'svelte';
  import { match } from 'ts-pattern';

  // === View mode ===
  type ViewMode = 'eval' | 'single';
  let viewMode = $state<ViewMode>('eval');

  // === Eval runner state ===
  let evalResults = $state<EvalResult[]>([]);
  let evalRunning = $state(false);
  let evalProgress = $state({ completed: 0, total: 0, running: [] as string[] });
  let evalAbortController = $state<AbortController | null>(null);
  let expandedCaseId = $state<string | null>(null);
  let filterCategory = $state<string>('all');
  let maxConcurrency = $state(3);

  // === Single prompt state (manual testing) ===
  let prompt = $state('slider controlling oscillator frequency');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let thinkingLog = $state<string[]>([]);
  let routerObjectTypes = $state<string[]>([]);
  let rawResult = $state<MultiObjectResult | null>(null);
  let insertResult = $state<MultiObjectInsertResult | null>(null);
  let singleAbortController = $state<AbortController | null>(null);
  let selectedEdgeIndex = $state<number | null>(null);
  let elapsedMs = $state<number | null>(null);

  onMount(() => {
    evalResults = loadResults();
  });

  // === Eval runner ===
  const categories = $derived(['all', ...new Set(EVAL_CASES.map((c) => c.category))]);

  const filteredCases = $derived(
    filterCategory === 'all' ? EVAL_CASES : EVAL_CASES.filter((c) => c.category === filterCategory)
  );

  const evalSummary = $derived.by(() => {
    const pass = evalResults.filter((r) => r.status === 'pass').length;
    const fail = evalResults.filter((r) => r.status === 'fail').length;
    const err = evalResults.filter((r) => r.status === 'error').length;
    const total = evalResults.length;
    return { pass, fail, err, total };
  });

  const failedCases = $derived(
    filteredCases.filter((c) => {
      const r = getResultForCase(c.id);
      return r && (r.status === 'fail' || r.status === 'error');
    })
  );

  function getResultForCase(caseId: string): EvalResult | undefined {
    // Return most recent result for this case
    return evalResults.findLast((r) => r.caseId === caseId);
  }

  async function runEval(cases: EvalCase[]) {
    evalRunning = true;
    const controller = new AbortController();
    evalAbortController = controller;
    evalProgress = { completed: 0, total: cases.length, running: [] };

    const queue = [...cases];
    let completed = 0;

    async function worker() {
      while (queue.length > 0 && !controller.signal.aborted) {
        const evalCase = queue.shift()!;
        evalProgress = {
          ...evalProgress,
          running: [...evalProgress.running, evalCase.id]
        };

        const result = await runSingleEval(evalCase, controller.signal);
        completed++;
        evalResults = [...evalResults.filter((r) => r.caseId !== evalCase.id), result];
        saveResults(evalResults);
        evalProgress = {
          completed,
          total: cases.length,
          running: evalProgress.running.filter((id) => id !== evalCase.id)
        };
      }
    }

    const workers = Array.from({ length: Math.min(maxConcurrency, cases.length) }, () => worker());
    await Promise.all(workers);

    evalRunning = false;
    evalAbortController = null;
  }

  async function runSingleEval(evalCase: EvalCase, signal: AbortSignal): Promise<EvalResult> {
    const start = performance.now();

    try {
      const result = await resolveMultipleObjectsFromPrompt(
        evalCase.prompt,
        () => {},
        signal,
        () => {}
      );

      const elapsed = Math.round(performance.now() - start);

      if (!result) {
        return {
          caseId: evalCase.id,
          status: 'error',
          timestamp: Date.now(),
          elapsedMs: elapsed,
          nodeTypes: [],
          edges: [],
          errorCount: 0,
          warnCount: 0,
          errorMessage: 'AI returned null'
        };
      }

      // Validate each edge
      const edgeResults: EvalEdgeResult[] = result.edges.map((edge) => {
        const sourceNode = result.nodes[edge.source];
        const targetNode = result.nodes[edge.target];

        const sourceError =
          edge.sourceHandle && sourceNode
            ? validateHandle(sourceNode.type, edge.sourceHandle, 'out')
            : !edge.sourceHandle
              ? 'missing sourceHandle'
              : `source index ${edge.source} out of bounds`;

        const targetError =
          edge.targetHandle && targetNode
            ? validateHandle(targetNode.type, edge.targetHandle, 'in')
            : null; // missing targetHandle is OK (GLSL auto-fill etc)

        return {
          sourceType: sourceNode?.type ?? '?',
          targetType: targetNode?.type ?? '?',
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          sourceError,
          targetError
        };
      });

      const errorCount = edgeResults.filter((e) => e.sourceError || e.targetError).length;

      return {
        caseId: evalCase.id,
        status: errorCount > 0 ? 'fail' : 'pass',
        timestamp: Date.now(),
        elapsedMs: elapsed,
        nodeTypes: result.nodes.map((n) => n.type),
        edges: edgeResults,
        errorCount,
        warnCount: 0
      };
    } catch (e) {
      return {
        caseId: evalCase.id,
        status: 'error',
        timestamp: Date.now(),
        elapsedMs: Math.round(performance.now() - start),
        nodeTypes: [],
        edges: [],
        errorCount: 0,
        warnCount: 0,
        errorMessage: e instanceof Error ? e.message : String(e)
      };
    }
  }

  function cancelEval() {
    evalAbortController?.abort();
  }

  function handleClearResults() {
    clearResults();
    evalResults = [];
  }

  let copyButtonText = $state('Copy Results');

  function copyResultsToClipboard() {
    const lines: string[] = [];
    const s = evalSummary;
    lines.push(
      `## Eval Results: ${s.pass}/${s.total} pass (${s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0}%)`
    );
    lines.push(`Pass: ${s.pass} | Fail: ${s.fail} | Error: ${s.err}`);
    lines.push('');

    for (const evalCase of filteredCases) {
      const result = getResultForCase(evalCase.id);
      if (!result) {
        lines.push(`- [ ] **${evalCase.id}** — not run`);
        continue;
      }

      const icon = match(result.status)
        .with('pass', () => '- [x]')
        .with('fail', () => '- [ ] FAIL')
        .with('error', () => '- [ ] ERR')
        .otherwise(() => '- [ ]');

      lines.push(`${icon} **${evalCase.id}** (${result.elapsedMs}ms) — ${evalCase.prompt}`);

      if (result.status === 'error' && result.errorMessage) {
        lines.push(`  - Error: ${result.errorMessage}`);
      }

      if (result.status === 'fail') {
        lines.push(`  - Nodes: ${result.nodeTypes.join(', ')}`);
        for (const edge of result.edges) {
          if (edge.sourceError || edge.targetError) {
            lines.push(
              `  - ${edge.sourceType} → ${edge.targetType}: src=${edge.sourceHandle ?? '(none)'} tgt=${edge.targetHandle ?? '(none)'}`
            );
            if (edge.sourceError) lines.push(`    - src: ${edge.sourceError}`);
            if (edge.targetError) lines.push(`    - tgt: ${edge.targetError}`);
          }
        }
      }
    }

    navigator.clipboard.writeText(lines.join('\n'));
    copyButtonText = 'Copied!';
    setTimeout(() => (copyButtonText = 'Copy Results'), 1500);
  }

  function statusColor(status: EvalStatus): string {
    return match(status)
      .with('pass', () => 'text-emerald-400')
      .with('fail', () => 'text-red-400')
      .with('error', () => 'text-yellow-400')
      .with('running', () => 'text-blue-400')
      .otherwise(() => 'text-zinc-500');
  }

  function statusBg(status: EvalStatus): string {
    return match(status)
      .with('pass', () => 'border-emerald-800')
      .with('fail', () => 'border-red-800 bg-red-900/10')
      .with('error', () => 'border-yellow-800 bg-yellow-900/10')
      .otherwise(() => 'border-zinc-700');
  }

  // === Single prompt runner ===
  async function runGeneration() {
    error = null;
    thinkingLog = [];
    routerObjectTypes = [];
    rawResult = null;
    insertResult = null;
    selectedEdgeIndex = null;
    elapsedMs = null;
    loading = true;

    const controller = new AbortController();
    singleAbortController = controller;
    const start = performance.now();

    try {
      const result = await resolveMultipleObjectsFromPrompt(
        prompt,
        (objectTypes) => {
          routerObjectTypes = objectTypes;
        },
        controller.signal,
        (thought) => {
          thinkingLog = [...thinkingLog, thought];
        }
      );

      elapsedMs = Math.round(performance.now() - start);

      if (result) {
        rawResult = result;
        const inserted = await handleMultiObjectInsert({
          objectNodes: result.nodes,
          simplifiedEdges: result.edges,
          basePosition: { x: 0, y: 0 },
          nodeIdCounter: 1,
          edgeIdCounter: 1
        });
        insertResult = inserted;
      } else {
        error = 'AI returned null (no plan generated)';
      }
    } catch (e) {
      elapsedMs = Math.round(performance.now() - start);
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
      singleAbortController = null;
    }
  }

  function cancelSingle() {
    singleAbortController?.abort();
  }

  // === Shared validation helpers ===
  function getHandleValidationIssues(
    edges: SimplifiedEdge[],
    nodes: AiObjectNode[]
  ): { edgeIndex: number; issue: string; severity: 'error' | 'warn' }[] {
    const issues: { edgeIndex: number; issue: string; severity: 'error' | 'warn' }[] = [];

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];

      if (edge.source < 0 || edge.source >= nodes.length) {
        issues.push({
          edgeIndex: i,
          issue: `source index ${edge.source} out of bounds (max: ${nodes.length - 1})`,
          severity: 'error'
        });
        continue;
      }
      if (edge.target < 0 || edge.target >= nodes.length) {
        issues.push({
          edgeIndex: i,
          issue: `target index ${edge.target} out of bounds (max: ${nodes.length - 1})`,
          severity: 'error'
        });
        continue;
      }

      const sourceNode = nodes[edge.source];
      const targetNode = nodes[edge.target];

      if (edge.sourceHandle) {
        const srcErr = validateHandle(sourceNode.type, edge.sourceHandle, 'out');
        if (srcErr) {
          issues.push({ edgeIndex: i, issue: `sourceHandle: ${srcErr}`, severity: 'error' });
        }
      } else {
        issues.push({ edgeIndex: i, issue: 'missing sourceHandle', severity: 'error' });
      }

      if (edge.targetHandle) {
        const tgtErr = validateHandle(targetNode.type, edge.targetHandle, 'in');
        if (tgtErr) {
          issues.push({ edgeIndex: i, issue: `targetHandle: ${tgtErr}`, severity: 'error' });
        }
      } else if (targetNode.type === 'glsl') {
        issues.push({
          edgeIndex: i,
          issue: 'missing targetHandle (will be auto-filled for GLSL)',
          severity: 'warn'
        });
      }

      if (edge.source === edge.target) {
        issues.push({
          edgeIndex: i,
          issue: 'self-connection (source === target)',
          severity: 'error'
        });
      }

      if (edge.sourceHandle && edge.targetHandle) {
        const srcType = extractHandleType(edge.sourceHandle);
        const tgtType = extractHandleType(edge.targetHandle);
        if (
          srcType &&
          tgtType &&
          srcType !== tgtType &&
          srcType !== 'message' &&
          tgtType !== 'message'
        ) {
          issues.push({
            edgeIndex: i,
            issue: `type mismatch: source=${srcType}, target=${tgtType}`,
            severity: 'error'
          });
        }
      }
    }

    return issues;
  }

  function handleIsValid(nodeType: string, handle: string, direction: 'in' | 'out'): boolean {
    return validateHandle(nodeType, handle, direction) === null;
  }

  function getExpectedHandles(nodeType: string): { inlets: string; outlets: string } | null {
    if (nodeType === 'object') {
      return { inlets: '{audio|message}-in-{N}', outlets: '{audio|message}-out-{N}' };
    }
    const spec = NODE_HANDLE_SPECS[nodeType];
    if (!spec) return null;

    const fmt = (p: (typeof spec)['inlets']) =>
      match(p)
        .with({ kind: 'fixed' }, (s) => (s.handles.length > 0 ? s.handles.join(', ') : '(none)'))
        .with({ kind: 'indexed' }, (s) => `${s.prefix}{N}`)
        .with({ kind: 'dynamic' }, (s) => s.patterns.join(' | '))
        .exhaustive();

    return { inlets: fmt(spec.inlets), outlets: fmt(spec.outlets) };
  }

  function extractHandleType(handle: string): string | null {
    const m = handle.match(/^(audio|video|message|analysis)-/);
    return m ? m[1] : null;
  }

  function edgeHasIssue(
    edgeIndex: number,
    issues: { edgeIndex: number; issue: string; severity: 'error' | 'warn' }[]
  ): boolean {
    return issues.some((i) => i.edgeIndex === edgeIndex && i.severity === 'error');
  }
</script>

<div class="debug-page min-h-screen bg-zinc-950 p-6 font-mono text-zinc-200">
  <div class="mx-auto max-w-6xl space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-zinc-100">Multi-Object AI Debug</h1>
        <p class="mt-1 text-sm text-zinc-500">
          Test handle ID correctness for multi-object generation
        </p>
      </div>
      <div class="flex gap-2">
        <button
          class="cursor-pointer rounded px-3 py-1.5 text-xs {viewMode === 'eval'
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}"
          onclick={() => (viewMode = 'eval')}
        >
          Eval Suite
        </button>
        <button
          class="cursor-pointer rounded px-3 py-1.5 text-xs {viewMode === 'single'
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}"
          onclick={() => (viewMode = 'single')}
        >
          Single Prompt
        </button>
      </div>
    </header>

    {#if viewMode === 'eval'}
      <!-- ==================== EVAL SUITE ==================== -->

      <!-- Controls -->
      <div class="flex flex-wrap items-center gap-3">
        {#if evalRunning}
          <button
            class="cursor-pointer rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            onclick={cancelEval}
          >
            Cancel
          </button>
          <div class="text-sm text-blue-400">
            {evalProgress.completed}/{evalProgress.total} done ({evalProgress.running.length} in flight)
          </div>
        {:else}
          <button
            class="cursor-pointer rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            onclick={() => runEval(filteredCases)}
          >
            Run {filterCategory === 'all' ? 'All' : filterCategory} ({filteredCases.length})
          </button>
          <button
            class="cursor-pointer rounded bg-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
            onclick={handleClearResults}
          >
            Clear Results
          </button>
          {#if failedCases.length > 0}
            <button
              class="cursor-pointer rounded bg-red-800 px-3 py-2 text-sm text-red-200 hover:bg-red-700"
              onclick={() => runEval(failedCases)}
            >
              Re-run Failed ({failedCases.length})
            </button>
          {/if}
          {#if evalResults.length > 0}
            <button
              class="cursor-pointer rounded bg-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-600"
              onclick={copyResultsToClipboard}
            >
              {copyButtonText}
            </button>
          {/if}
        {/if}

        <!-- Concurrency control -->
        <div class="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>concurrency:</span>
          {#each [1, 3, 5, 8] as n}
            <button
              class="cursor-pointer rounded px-1.5 py-0.5 {maxConcurrency === n
                ? 'bg-zinc-600 text-zinc-100'
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}"
              onclick={() => (maxConcurrency = n)}
              disabled={evalRunning}
            >
              {n}
            </button>
          {/each}
        </div>

        <!-- Category filter -->
        <div class="ml-auto flex gap-1">
          {#each categories as cat}
            <button
              class="cursor-pointer rounded px-2 py-1 text-xs {filterCategory === cat
                ? 'bg-zinc-600 text-zinc-100'
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}"
              onclick={() => (filterCategory = cat)}
            >
              {cat}
            </button>
          {/each}
        </div>
      </div>

      <!-- Progress bar -->
      {#if evalRunning}
        {@const pct =
          evalProgress.total > 0 ? (evalProgress.completed / evalProgress.total) * 100 : 0}
        <div class="space-y-1">
          <div class="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              class="h-full rounded-full bg-blue-500 transition-all duration-300"
              style="width: {pct}%"
            ></div>
          </div>
          {#if evalProgress.running.length > 0}
            <div class="flex flex-wrap gap-1 text-xs text-zinc-500">
              {#each evalProgress.running as id}
                <span class="animate-pulse rounded bg-zinc-800 px-1.5 py-0.5 text-blue-400"
                  >{id}</span
                >
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Summary bar -->
      {#if evalResults.length > 0}
        {@const s = evalSummary}
        <div class="flex gap-4 text-sm">
          <span class="text-zinc-500">{s.total} tested</span>
          <span class="text-emerald-400">{s.pass} pass</span>
          <span class="text-red-400">{s.fail} fail</span>
          {#if s.err > 0}
            <span class="text-yellow-400">{s.err} error</span>
          {/if}
          <span class="text-zinc-600">
            {s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0}% pass rate
          </span>
        </div>
      {/if}

      <!-- Results table -->
      <div class="space-y-1">
        {#each filteredCases as evalCase (evalCase.id)}
          {@const result = getResultForCase(evalCase.id)}
          {@const isExpanded = expandedCaseId === evalCase.id}

          <div class="rounded border {result ? statusBg(result.status) : 'border-zinc-800'}">
            <!-- Row -->
            <div
              role="button"
              tabindex="0"
              class="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-800/50"
              onclick={() => (expandedCaseId = isExpanded ? null : evalCase.id)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  expandedCaseId = isExpanded ? null : evalCase.id;
              }}
            >
              <!-- Status indicator -->
              <span
                class="w-12 text-xs font-semibold {evalProgress.running.includes(evalCase.id)
                  ? 'animate-pulse text-blue-400'
                  : result
                    ? statusColor(result.status)
                    : 'text-zinc-600'}"
              >
                {evalProgress.running.includes(evalCase.id)
                  ? 'RUN'
                  : result
                    ? result.status.toUpperCase()
                    : '—'}
              </span>

              <!-- Case info -->
              <span class="min-w-0 flex-1 truncate text-zinc-300">{evalCase.prompt}</span>

              <!-- Category badge -->
              <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
                {evalCase.category}
              </span>

              <!-- Edge stats -->
              {#if result && result.status !== 'error'}
                <span class="text-xs text-zinc-500">
                  {result.edges.length} edge{result.edges.length !== 1 ? 's' : ''}
                </span>
                {#if result.errorCount > 0}
                  <span class="text-xs text-red-400">{result.errorCount} bad</span>
                {/if}
              {/if}

              <!-- Timing -->
              {#if result}
                <span class="w-16 text-right text-xs text-zinc-600">{result.elapsedMs}ms</span>
              {/if}

              <!-- Re-run single -->
              {#if !evalRunning}
                <button
                  class="cursor-pointer rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                  onclick={(e) => {
                    e.stopPropagation();
                    runEval([evalCase]);
                  }}
                >
                  run
                </button>
              {/if}
            </div>

            <!-- Expanded detail -->
            {#if isExpanded && result}
              <div class="border-t border-zinc-800 px-3 py-3 text-xs">
                {#if result.errorMessage}
                  <div class="mb-2 text-yellow-400">Error: {result.errorMessage}</div>
                {/if}

                {#if result.nodeTypes.length > 0}
                  <div class="mb-2 text-zinc-400">
                    <span class="text-zinc-500">Nodes:</span>
                    {#each result.nodeTypes as t, i}
                      <span class="ml-1 rounded bg-zinc-800 px-1.5 py-0.5">{t}</span>
                    {/each}
                  </div>
                {/if}

                {#if result.edges.length > 0}
                  <div class="space-y-1">
                    {#each result.edges as edge, i}
                      {@const hasError = !!(edge.sourceError || edge.targetError)}
                      <div
                        class="flex items-start gap-2 rounded p-1.5 {hasError
                          ? 'bg-red-900/20'
                          : 'bg-zinc-900/50'}"
                      >
                        <span class="text-zinc-500">E{i}</span>
                        <span class="text-zinc-300">{edge.sourceType}</span>
                        <span class="text-zinc-600">&rarr;</span>
                        <span class="text-zinc-300">{edge.targetType}</span>

                        <code
                          class="rounded px-1 py-0.5 {edge.sourceError
                            ? 'bg-red-900/40 text-red-300'
                            : 'bg-emerald-900/40 text-emerald-300'}"
                        >
                          {edge.sourceHandle ?? '(none)'}
                        </code>
                        <span class="text-zinc-600">&rarr;</span>
                        <code
                          class="rounded px-1 py-0.5 {edge.targetError
                            ? 'bg-red-900/40 text-red-300'
                            : 'bg-blue-900/40 text-blue-300'}"
                        >
                          {edge.targetHandle ?? '(none)'}
                        </code>
                      </div>
                      {#if edge.sourceError}
                        <div class="ml-6 text-red-400">src: {edge.sourceError}</div>
                      {/if}
                      {#if edge.targetError}
                        <div class="ml-6 text-red-400">tgt: {edge.targetError}</div>
                      {/if}
                    {/each}
                  </div>
                {/if}

                <div class="mt-2 text-zinc-600">
                  {new Date(result.timestamp).toLocaleString()}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <!-- ==================== SINGLE PROMPT ==================== -->

      <!-- Prompt Input -->
      <div class="flex items-end gap-3">
        <div class="flex-1">
          <label for="prompt" class="mb-1 block text-xs text-zinc-500">Prompt</label>
          <input
            id="prompt"
            type="text"
            class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
            bind:value={prompt}
            onkeydown={(e) => {
              if (e.key === 'Enter' && !loading) runGeneration();
            }}
            disabled={loading}
          />
        </div>
        {#if loading}
          <button
            class="cursor-pointer rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            onclick={cancelSingle}
          >
            Cancel
          </button>
        {:else}
          <button
            class="cursor-pointer rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            onclick={runGeneration}
          >
            Generate
          </button>
        {/if}
      </div>

      {#if loading}
        <div class="animate-pulse text-sm text-blue-400">
          {routerObjectTypes.length > 0
            ? `Generating: ${routerObjectTypes.join(', ')}`
            : 'Planning...'}
        </div>
      {/if}

      {#if error}
        <div class="rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      {/if}

      {#if elapsedMs !== null}
        <div class="text-xs text-zinc-600">Completed in {elapsedMs}ms</div>
      {/if}

      {#if thinkingLog.length > 0}
        <details class="group">
          <summary class="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
            AI Thinking ({thinkingLog.length} entries)
          </summary>
          <div
            class="mt-2 max-h-60 overflow-y-auto rounded border border-zinc-800 bg-zinc-900/50 p-3 text-xs whitespace-pre-wrap text-zinc-400"
          >
            {thinkingLog.join('\n\n---\n\n')}
          </div>
        </details>
      {/if}

      {#if rawResult}
        {@const issues = getHandleValidationIssues(rawResult.edges, rawResult.nodes)}

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <!-- Left Column: Nodes -->
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-zinc-300">
              Nodes ({rawResult.nodes.length})
            </h2>

            {#each rawResult.nodes as node, i (i)}
              <div class="space-y-2 rounded border border-zinc-700 bg-zinc-900 p-3">
                <div class="flex items-center gap-2">
                  <span class="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">#{i}</span>
                  <span class="font-semibold text-zinc-100">{node.type}</span>
                  {#if node.position}
                    <span class="text-xs text-zinc-600">({node.position.x}, {node.position.y})</span
                    >
                  {/if}
                </div>

                {#if getExpectedHandles(node.type)}
                  {@const expected = getExpectedHandles(node.type)}
                  {#if expected}
                    <div class="text-xs text-zinc-600">
                      <span class="text-zinc-500">Expected:</span>
                      in=[{expected.inlets}] out=[{expected.outlets}]
                    </div>
                  {/if}
                {:else}
                  <div class="text-xs text-yellow-600">Unknown node type (no handle spec)</div>
                {/if}

                <details>
                  <summary class="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300"
                    >Node Data</summary
                  >
                  <pre
                    class="mt-1 overflow-x-auto rounded bg-zinc-950 p-2 text-xs text-zinc-400">{JSON.stringify(
                      node.data,
                      null,
                      2
                    )}</pre>
                </details>

                {#if rawResult.edges.filter((e) => e.source === i).length > 0}
                  <div class="text-xs">
                    <span class="text-zinc-500">Outlets used:</span>
                    {#each rawResult.edges.filter((e) => e.source === i) as edge}
                      <span
                        class="ml-1 rounded px-1.5 py-0.5 {handleIsValid(
                          node.type,
                          edge.sourceHandle ?? '',
                          'out'
                        )
                          ? 'bg-emerald-900/50 text-emerald-300'
                          : 'bg-red-900/50 text-red-300'}"
                      >
                        {edge.sourceHandle ?? '(none)'}
                      </span>
                    {/each}
                  </div>
                {/if}

                {#if rawResult.edges.filter((e) => e.target === i).length > 0}
                  <div class="text-xs">
                    <span class="text-zinc-500">Inlets used:</span>
                    {#each rawResult.edges.filter((e) => e.target === i) as edge}
                      <span
                        class="ml-1 rounded px-1.5 py-0.5 {handleIsValid(
                          node.type,
                          edge.targetHandle ?? '',
                          'in'
                        )
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-red-900/50 text-red-300'}"
                      >
                        {edge.targetHandle ?? '(none)'}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          <!-- Right Column: Edges -->
          <div class="space-y-4">
            <h2 class="text-lg font-semibold text-zinc-300">
              Edges ({rawResult.edges.length})
              {#if issues.length > 0}
                <span class="ml-2 text-sm text-red-400"
                  >{issues.length} issue{issues.length !== 1 ? 's' : ''}</span
                >
              {:else}
                <span class="ml-2 text-sm text-emerald-400">all valid</span>
              {/if}
            </h2>

            {#if issues.length > 0}
              <div class="space-y-1 rounded border border-red-800 bg-red-900/20 p-3">
                <div class="text-xs font-semibold text-red-300">Validation Issues</div>
                {#each issues as issue}
                  <div
                    class="text-xs {issue.severity === 'error'
                      ? 'text-red-400'
                      : 'text-yellow-400'}"
                  >
                    <span class="font-semibold">{issue.severity === 'error' ? 'ERR' : 'WARN'}</span>
                    Edge #{issue.edgeIndex}: {issue.issue}
                  </div>
                {/each}
              </div>
            {/if}

            {#each rawResult.edges as edge, i (i)}
              {@const hasIssue = edgeHasIssue(i, issues)}
              <button
                class="w-full cursor-pointer space-y-1 rounded border bg-zinc-900 p-3 text-left transition-colors {hasIssue
                  ? 'border-red-700 bg-red-900/10'
                  : 'border-zinc-700'} {selectedEdgeIndex === i ? 'ring-2 ring-blue-500' : ''}"
                onclick={() => {
                  selectedEdgeIndex = selectedEdgeIndex === i ? null : i;
                }}
              >
                <div class="flex items-center gap-2 text-sm">
                  <span class="rounded bg-zinc-700 px-1.5 py-0.5 text-xs">E{i}</span>
                  <span class="text-zinc-400">
                    <span class="text-zinc-100">#{edge.source}</span>
                    <span class="text-zinc-600"> ({rawResult.nodes[edge.source]?.type})</span>
                    <span class="mx-1">&rarr;</span>
                    <span class="text-zinc-100">#{edge.target}</span>
                    <span class="text-zinc-600"> ({rawResult.nodes[edge.target]?.type})</span>
                  </span>
                </div>

                <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span class="text-zinc-500">sourceHandle: </span>
                    <code
                      class="rounded px-1 py-0.5 {edge.sourceHandle
                        ? handleIsValid(
                            rawResult.nodes[edge.source]?.type,
                            edge.sourceHandle,
                            'out'
                          )
                          ? 'bg-emerald-900/40 text-emerald-300'
                          : 'bg-red-900/40 text-red-300'
                        : 'bg-yellow-900/40 text-yellow-300'}"
                    >
                      {edge.sourceHandle ?? 'undefined'}
                    </code>
                  </div>
                  <div>
                    <span class="text-zinc-500">targetHandle: </span>
                    <code
                      class="rounded px-1 py-0.5 {edge.targetHandle
                        ? handleIsValid(rawResult.nodes[edge.target]?.type, edge.targetHandle, 'in')
                          ? 'bg-blue-900/40 text-blue-300'
                          : 'bg-red-900/40 text-red-300'
                        : 'bg-yellow-900/40 text-yellow-300'}"
                    >
                      {edge.targetHandle ?? 'undefined'}
                    </code>
                  </div>
                </div>
              </button>
            {/each}

            {#if insertResult}
              <h2 class="mt-6 border-t border-zinc-800 pt-4 text-lg font-semibold text-zinc-300">
                After Insertion
              </h2>
              <p class="text-xs text-zinc-500">
                Result of handleMultiObjectInsert() — final node IDs and edge connections
              </p>

              <div class="space-y-2">
                <div class="text-xs text-zinc-400">
                  <span class="text-zinc-500">Nodes:</span>
                  {#each insertResult.newNodes as node}
                    <span class="ml-1 rounded bg-zinc-800 px-1.5 py-0.5">{node.id}</span>
                  {/each}
                </div>

                {#each insertResult.newEdges as edge}
                  <div class="space-y-1 rounded border border-zinc-800 bg-zinc-900 p-2 text-xs">
                    <div class="text-zinc-300">
                      {edge.id}: {edge.source} &rarr; {edge.target}
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <span class="text-zinc-500">src: </span>
                        <code class="text-emerald-300">{edge.sourceHandle ?? 'undefined'}</code>
                      </div>
                      <div>
                        <span class="text-zinc-500">tgt: </span>
                        <code class="text-blue-300">{edge.targetHandle ?? 'undefined'}</code>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <details class="mt-6">
          <summary class="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300"
            >Raw JSON Output</summary
          >
          <pre
            class="mt-2 max-h-96 overflow-x-auto overflow-y-auto rounded border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-400">{JSON.stringify(
              rawResult,
              null,
              2
            )}</pre>
        </details>
      {/if}
    {/if}
  </div>
</div>
