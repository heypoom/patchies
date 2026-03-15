<script lang="ts">
  import { resolveMultipleObjectsFromPrompt } from '$lib/ai/multi-object-resolver';
  import { handleMultiObjectInsert } from '$lib/ai/handle-multi-object-insert';
  import type { AiObjectNode, SimplifiedEdge, MultiObjectResult } from '$lib/ai/types';
  import type { MultiObjectInsertResult } from '$lib/ai/handle-multi-object-insert';

  let prompt = $state('slider controlling oscillator frequency');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let thinkingLog = $state<string[]>([]);
  let routerObjectTypes = $state<string[]>([]);
  let rawResult = $state<MultiObjectResult | null>(null);
  let insertResult = $state<MultiObjectInsertResult | null>(null);
  let abortController = $state<AbortController | null>(null);
  let selectedEdgeIndex = $state<number | null>(null);
  let elapsedMs = $state<number | null>(null);

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
    abortController = controller;
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
        // Run through insertion logic to see final nodes/edges
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
      abortController = null;
    }
  }

  function cancel() {
    abortController?.abort();
  }

  function getHandleValidationIssues(
    edges: SimplifiedEdge[],
    nodes: AiObjectNode[]
  ): { edgeIndex: number; issue: string }[] {
    const issues: { edgeIndex: number; issue: string }[] = [];

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];

      // Check index bounds
      if (edge.source < 0 || edge.source >= nodes.length) {
        issues.push({
          edgeIndex: i,
          issue: `source index ${edge.source} out of bounds (max: ${nodes.length - 1})`
        });
      }
      if (edge.target < 0 || edge.target >= nodes.length) {
        issues.push({
          edgeIndex: i,
          issue: `target index ${edge.target} out of bounds (max: ${nodes.length - 1})`
        });
      }

      // Check handle ID patterns
      if (edge.sourceHandle) {
        if (!isValidHandleId(edge.sourceHandle, 'out')) {
          issues.push({ edgeIndex: i, issue: `suspicious sourceHandle: "${edge.sourceHandle}"` });
        }
      } else {
        issues.push({ edgeIndex: i, issue: 'missing sourceHandle' });
      }

      if (edge.targetHandle) {
        if (!isValidHandleId(edge.targetHandle, 'in')) {
          issues.push({ edgeIndex: i, issue: `suspicious targetHandle: "${edge.targetHandle}"` });
        }
      }

      // Self-connection
      if (edge.source === edge.target) {
        issues.push({ edgeIndex: i, issue: 'self-connection (source === target)' });
      }

      // Type mismatch between handles
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
            issue: `type mismatch: source=${srcType}, target=${tgtType}`
          });
        }
      }
    }

    return issues;
  }

  function isValidHandleId(handle: string, expectedDir: 'in' | 'out'): boolean {
    // Valid patterns:
    // type-dir-id:  audio-in-0, message-out-1, video-in-0-uTex-sampler2D
    // type-dir:     message-in, audio-out, video-out
    // dir-id:       in-0, out-1
    // dir:          inlet, outlet (rare)
    const validPatterns = [
      /^(audio|video|message|analysis)-(in|out)(-.+)?$/,
      /^(in|out)(-.+)?$/,
      /^(inlet|outlet)$/
    ];

    const matchesPattern = validPatterns.some((p) => p.test(handle));
    if (!matchesPattern) return false;

    // Check direction consistency
    if (
      handle.includes(`-${expectedDir}`) ||
      handle === expectedDir ||
      handle === (expectedDir === 'in' ? 'inlet' : 'outlet')
    ) {
      return true;
    }
    // For bare in-0/out-0 pattern
    if (handle.startsWith(expectedDir)) return true;

    return false;
  }

  function extractHandleType(handle: string): string | null {
    const match = handle.match(/^(audio|video|message|analysis)-/);
    return match ? match[1] : null;
  }

  function edgeHasIssue(
    edgeIndex: number,
    issues: { edgeIndex: number; issue: string }[]
  ): boolean {
    return issues.some((i) => i.edgeIndex === edgeIndex);
  }
</script>

<div class="min-h-screen bg-zinc-950 p-6 font-mono text-zinc-200">
  <div class="mx-auto max-w-6xl space-y-6">
    <header>
      <h1 class="text-2xl font-bold text-zinc-100">Multi-Object AI Debug</h1>
      <p class="mt-1 text-sm text-zinc-500">
        Test multi-object generation and inspect handle IDs / edge connections
      </p>
    </header>

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
          onclick={cancel}
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

    <!-- Status -->
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

    <!-- Thinking Log -->
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
          <h2 class="text-lg font-semibold text-zinc-300">Nodes ({rawResult.nodes.length})</h2>

          {#each rawResult.nodes as node, i}
            <div class="space-y-2 rounded border border-zinc-700 bg-zinc-900 p-3">
              <div class="flex items-center gap-2">
                <span class="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">#{i}</span>
                <span class="font-semibold text-zinc-100">{node.type}</span>
                {#if node.position}
                  <span class="text-xs text-zinc-600">({node.position.x}, {node.position.y})</span>
                {/if}
              </div>

              <!-- Node Data -->
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

              <!-- Connected edges for this node -->
              {#if rawResult.edges.filter((e) => e.source === i).length > 0}
                <div class="text-xs">
                  <span class="text-zinc-500">Outlets used:</span>
                  {#each rawResult.edges.filter((e) => e.source === i) as edge}
                    <span
                      class="ml-1 rounded px-1.5 py-0.5 {isValidHandleId(
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
                      class="ml-1 rounded px-1.5 py-0.5 {isValidHandleId(
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

          <!-- Issues Summary -->
          {#if issues.length > 0}
            <div class="space-y-1 rounded border border-red-800 bg-red-900/20 p-3">
              <div class="text-xs font-semibold text-red-300">Validation Issues</div>
              {#each issues as issue}
                <div class="text-xs text-red-400">
                  Edge #{issue.edgeIndex}: {issue.issue}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Edge List -->
          {#each rawResult.edges as edge, i}
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
                      ? isValidHandleId(edge.sourceHandle, 'out')
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
                      ? isValidHandleId(edge.targetHandle, 'in')
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

          <!-- After Insertion (handleMultiObjectInsert result) -->
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

              {#each insertResult.newEdges as edge, i}
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

      <!-- Raw JSON -->
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
  </div>
</div>
