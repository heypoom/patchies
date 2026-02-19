<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import hljs from 'highlight.js/lib/core';
  import javascript from 'highlight.js/lib/languages/javascript';
  import CodeEditor from '../CodeEditor.svelte';
  import { keymap } from '@codemirror/view';
  import { EditorView } from 'codemirror';
  import { highlightUiua } from '$lib/uiua/uiua-highlight';
  import type { SupportedLanguage } from '$lib/codemirror/types';

  import 'highlight.js/styles/tokyo-night-dark.css';

  hljs.registerLanguage('javascript', javascript);

  // Track preview element size to avoid layout shift when switching to editor
  let previewEl: HTMLDivElement | null = $state(null);
  let capturedSize: { width: number; height: number } | null = $state(null);

  $effect(() => {
    if (!previewEl) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // Use borderBoxSize for full dimensions including padding/border
        const box = entry.borderBoxSize[0];
        if (box) {
          capturedSize = {
            width: box.inlineSize,
            height: box.blockSize
          };
        }
      }
    });

    observer.observe(previewEl);
    return () => observer.disconnect();
  });

  let {
    nodeId,
    data,
    selected,
    expr = $bindable(),
    isEditing = $bindable(),
    placeholder = 'expr',
    displayPrefix,
    editorClass = 'common-expr-node-code-editor',
    previewContainerClass = '',
    class: className = '',
    language = 'javascript',
    onExpressionChange = () => {},
    onRun = () => {},
    exitOnRun = true,
    runOnExit = false,
    extraExtensions = [],
    hasError = false,
    allowEmptyExpr = false,
    dataKey = 'expr',
    children,
    handles,
    outlets
  }: {
    nodeId: string;
    data: any;
    selected: boolean;
    expr: string;
    isEditing: boolean;
    placeholder?: string;
    displayPrefix?: string;
    editorClass?: string;
    previewContainerClass?: string;
    class?: string;
    language?: SupportedLanguage;
    onRun?: () => void;
    onExpressionChange?: (expr: string) => void;
    exitOnRun?: boolean;
    runOnExit?: boolean;
    extraExtensions?: any[];
    hasError?: boolean;
    allowEmptyExpr?: boolean;
    children?: any;
    handles?: any;
    outlets?: any;
    dataKey?: string;
  } = $props();

  const { updateNodeData, deleteElements } = useSvelteFlow();

  let originalExpr = expr; // Store original for escape functionality

  // Escape HTML for safe display
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let highlightedHtml = $derived.by(() => {
    if (!expr) return '';

    // Use language-specific highlighter
    if (language === 'uiua') {
      return highlightUiua(expr);
    }

    if (language !== 'javascript') {
      return escapeHtml(expr);
    }

    try {
      return hljs.highlight(expr, {
        language: 'javascript',
        ignoreIllegals: true
      }).value;
    } catch (e) {
      return '';
    }
  });

  function enterEditingMode() {
    isEditing = true;
    originalExpr = expr;

    focusEditor();
  }

  function focusEditor() {
    setTimeout(() => {
      const editor = document.querySelector(`.${editorClass} .cm-content`) as HTMLElement;
      editor?.focus();
    }, 10);
  }

  function exitEditingMode(save: boolean = true) {
    isEditing = false;

    if (runOnExit) {
      onRun?.();
    }

    if (!save) {
      // Restore original expression on escape
      expr = originalExpr;
      updateNodeData(nodeId, { expr: originalExpr });
      onExpressionChange(originalExpr);

      // If the original expression was empty, delete the node (unless empty is allowed)
      if (!originalExpr.trim() && !allowEmptyExpr) {
        deleteElements({ nodes: [{ id: nodeId }] });
        return;
      }
    }

    if (save) {
      if (expr.trim()) {
        const trimmedExpr = expr.trim();
        updateNodeData(nodeId, { expr: trimmedExpr });
        onExpressionChange(trimmedExpr);
      } else if (!allowEmptyExpr) {
        // If trying to save with empty expression, delete the node (unless empty is allowed)
        deleteElements({ nodes: [{ id: nodeId }] });
      }
    }
  }

  function handleDoubleClick() {
    if (!isEditing) {
      enterEditingMode();
    }
  }

  function handleExpressionUpdate(value: string) {
    expr = value;
    updateNodeData(nodeId, { expr: value });
    onExpressionChange(value);
  }

  const containerClass = $derived.by(() => {
    const base = hasError
      ? '!border-red-500 object-container'
      : selected
        ? 'object-container-selected'
        : 'object-container';

    return className ? `${base} ${className}` : base;
  });

  export function focus() {
    if (isEditing) {
      focusEditor();
    }
  }
</script>

<div class="relative">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="relative">
        {@render handles?.()}

        <div class="relative">
          {#if isEditing}
            <div
              class={[
                'expr-editor-container nodrag w-full max-w-[400px] min-w-[40px] resize-none rounded-lg border font-mono text-zinc-200',
                containerClass
              ]}
              style={capturedSize
                ? `min-width: ${capturedSize.width}px; min-height: ${capturedSize.height}px`
                : undefined}
            >
              <CodeEditor
                value={expr}
                onchange={handleExpressionUpdate}
                onrun={() => {
                  if (exitOnRun) exitEditingMode(true);

                  onRun?.();
                }}
                {language}
                class={`${editorClass} rounded-lg border !border-transparent focus:outline-none`}
                {placeholder}
                nodeType="expr"
                extraExtensions={[
                  keymap.of([
                    {
                      key: 'Escape',
                      run: () => {
                        exitEditingMode(false);
                        return true;
                      }
                    }
                  ]),
                  EditorView.focusChangeEffect.of((_, focusing) => {
                    if (!focusing) {
                      // Delay to allow other events to process first
                      setTimeout(() => exitEditingMode(true), 100);
                    }
                    return null;
                  }),
                  ...extraExtensions
                ]}
                {nodeId}
                {dataKey}
              />
            </div>
          {:else}
            <div
              bind:this={previewEl}
              ondblclick={handleDoubleClick}
              class={[
                'expr-display cursor-pointer rounded-lg border px-3 py-2 text-start text-xs font-medium text-zinc-200 hover:bg-zinc-800',
                containerClass,
                previewContainerClass
              ]}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleDoubleClick()}
            >
              <div class="expr-preview flex items-center gap-2 font-mono">
                {#if expr || displayPrefix}
                  <span class="flex max-w-[400px] overflow-hidden">
                    {#if displayPrefix}
                      <span
                        class={[
                          'expr-preview-display-prefix text-xs',
                          expr ? 'mr-2 text-zinc-400' : 'text-zinc-200'
                        ]}>{displayPrefix}</span
                      >
                    {/if}

                    {#if expr}
                      <code class="expr-preview-code text-xs whitespace-pre">
                        {@html highlightedHtml}
                      </code>
                    {/if}
                  </span>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        {@render outlets?.()}
      </div>
    </div>
  </div>
</div>

<style>
  :global(.common-expr-node-code-editor .cm-content) {
    padding: 6px 8px 7px 4px !important;
  }

  .expr-display {
    font-family: var(--font-mono);
  }

  /* UIUA syntax highlighting for preview */
  :global(.uiua-monadic) {
    color: #7dcfff; /* cyan - monadic functions */
  }
  :global(.uiua-dyadic) {
    color: #9ece6a; /* green - dyadic functions */
  }
  :global(.uiua-mod1) {
    color: #bb9af7; /* pink/purple - 1-modifiers */
  }
  :global(.uiua-mod2) {
    color: #e0af68; /* yellow - 2-modifiers */
  }
  :global(.uiua-number) {
    color: #ff9e64; /* orange - numbers/constants */
  }
  :global(.uiua-string) {
    color: #9ece6a; /* green - strings */
  }
  :global(.uiua-comment) {
    color: #565f89; /* gray - comments */
  }
  :global(.uiua-stack) {
    color: #c0caf5; /* light - stack ops */
  }
</style>
