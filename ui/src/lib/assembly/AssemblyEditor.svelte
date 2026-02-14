<script lang="ts">
  import { EditorView, keymap, Decoration } from '@codemirror/view';
  import {
    EditorState,
    Prec,
    type Extension,
    StateEffect,
    StateField,
    Compartment
  } from '@codemirror/state';
  import { minimalSetup } from 'codemirror';
  import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
  import { loadLanguageExtension } from '$lib/codemirror/language';
  import { onDestroy, onMount } from 'svelte';
  import { insertNewline } from '@codemirror/commands';

  interface Props {
    value: string;
    onchange?: (value: string) => void;
    onrun?: () => void;
    placeholder?: string;
    readonly?: boolean;
    highlightLine?: (callback: (lineNo: number) => void) => void;
    onReadonlyInput?: () => void;
  }

  let {
    value = '',
    onchange,
    placeholder = 'Enter assembly code...',
    readonly = false,
    onrun,
    highlightLine,
    onReadonlyInput
  }: Props = $props();

  function handleKeydown(event: KeyboardEvent) {
    // Detect typing attempt while readonly (printable character or backspace/delete)
    if (readonly && onReadonlyInput) {
      const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey;
      const isEditKey = ['Backspace', 'Delete', 'Enter'].includes(event.key);
      if (isPrintable || isEditKey) {
        onReadonlyInput();
      }
    }
  }

  let editorContainer = $state<HTMLDivElement>();
  let editorView = $state<EditorView | null>(null);
  let currentAssemblyExtension: Extension | null = null;
  const readonlyCompartment = new Compartment();

  // Line highlighter functionality
  const addLineHighlight = StateEffect.define<number>();

  const HIGHLIGHT_COLOR = '#e4e4e722';

  const lineHighlightMark = Decoration.line({
    attributes: { style: `background-color: ${HIGHLIGHT_COLOR}` }
  });

  const lineHighlighter = StateField.define({
    create() {
      return Decoration.none;
    },
    update(lines, transaction) {
      lines = lines.map(transaction.changes);
      for (const effect of transaction.effects) {
        if (effect.is(addLineHighlight)) {
          lines = Decoration.none;
          lines = lines.update({ add: [lineHighlightMark.range(effect.value)] });
        }
      }
      return lines;
    },
    provide: (field) => EditorView.decorations.from(field)
  });

  function highlightLineNumber(lineNo: number) {
    if (!editorView) return;

    try {
      // Check if the line number is valid before attempting to highlight
      const doc = editorView.state.doc;
      if (lineNo < 1 || lineNo > doc.lines) {
        console.warn(`Line number ${lineNo} is out of range (1-${doc.lines})`);
        return;
      }

      const pos = doc.line(lineNo).from;
      editorView.dispatch({ effects: addLineHighlight.of(pos) });
    } catch (error) {
      console.warn('Failed to highlight line:', lineNo, error);
    }
  }

  async function createOrUpdateEditor() {
    const assemblyExtension = await loadLanguageExtension('assembly');

    if (!editorContainer) return;

    // If extension changed or no editor exists, recreate the editor
    if (!editorView || currentAssemblyExtension !== assemblyExtension) {
      if (editorView) {
        editorView.destroy();
      }

      currentAssemblyExtension = assemblyExtension;

      const asmKeymap = Prec.highest(
        keymap.of([
          {
            key: 'Shift-Enter',
            run: () => {
              onrun?.();
              return true;
            }
          },
          {
            key: 'Enter',
            run: (view) => {
              insertNewline(view);
              return true;
            }
          }
        ])
      );

      const extensions = [
        asmKeymap,
        minimalSetup,
        tokyoNight,
        lineHighlighter,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onchange && !readonly) {
            onchange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            fontSize: '13px',
            fontFamily: 'var(--font-mono)'
          },
          '.cm-content': {
            padding: '0px',
            minHeight: '50px',
            maxHeight: '300px'
          },
          '.cm-focused': {
            outline: 'none'
          },
          '.cm-editor': {
            borderRadius: '6px'
          },
          '.cm-line': {
            padding: '0 2px 0 4px'
          }
        }),
        readonlyCompartment.of(EditorState.readOnly.of(readonly)),
        assemblyExtension
      ];

      const startState = EditorState.create({
        doc: value,
        extensions
      });

      editorView = new EditorView({
        state: startState,
        parent: editorContainer
      });
    }
  }

  onMount(() => {
    createOrUpdateEditor();
  });

  // Expose the highlight function to parent component when editor is ready
  $effect(() => {
    if (highlightLine && editorView) {
      highlightLine(highlightLineNumber);
    }
  });

  // Update readonly state dynamically
  $effect(() => {
    if (editorView) {
      editorView.dispatch({
        effects: readonlyCompartment.reconfigure(EditorState.readOnly.of(readonly))
      });
    }
  });

  onDestroy(() => {
    editorView?.destroy();
    editorView = null;
  });

  // Update editor when value prop changes
  $effect(() => {
    if (editorView && editorView.state.doc.toString() !== value) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: value
        }
      });
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={editorContainer}
  class="assembly-editor nodrag nopan nowheel overflow-hidden"
  class:cursor-not-allowed={readonly}
  onkeydown={handleKeydown}
>
  {#if !editorContainer}
    <div class="p-4 font-mono text-sm text-zinc-400">
      {placeholder}
    </div>
  {/if}
</div>

<style>
  .assembly-editor {
    --cm-font-family: var(--font-mono);
  }

  /* Background color overrides to match CodeEditor.svelte */
  :global(.assembly-editor .cm-editor) {
    height: 100%;
    background: transparent !important;
  }

  :global(.assembly-editor .cm-content) {
    background: transparent !important;
    color: rgb(244 244 245) !important;
  }

  :global(.assembly-editor .cm-gutters) {
    background: transparent !important;
    border-right: 1px solid transparent !important;
    color: rgb(115 115 115) !important;
  }

  :global(.assembly-editor .cm-activeLine) {
    background: rgba(255, 255, 255, 0.05) !important;
  }

  :global(.assembly-editor .cm-activeLineGutter) {
    background: rgba(255, 255, 255, 0.05) !important;
  }

  :global(.assembly-editor .cm-cursor) {
    border-left-color: rgb(244 244 245) !important;
  }
</style>
