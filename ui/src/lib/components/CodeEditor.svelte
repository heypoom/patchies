<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, minimalSetup } from 'codemirror';
  import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
  import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
  import {
    keymap,
    drawSelection,
    Decoration,
    type DecorationSet,
    hoverTooltip,
    type Tooltip,
    placeholder as cmPlaceholder
  } from '@codemirror/view';
  import { StateField, StateEffect } from '@codemirror/state';
  import { useVimInEditor } from '../../stores/editor.store';
  import { loadLanguageExtension } from '$lib/codemirror/language';
  import { autocompletion, acceptCompletion, completionStatus } from '@codemirror/autocomplete';
  import { indentMore } from '@codemirror/commands';
  import { search, searchKeymap } from '@codemirror/search';
  import type { SupportedLanguage } from '$lib/codemirror/types';

  // Effect to set error lines (supports multiple lines)
  const setErrorLinesEffect = StateEffect.define<number[] | null>();

  // Effect to set line errors with messages
  const setLineErrorsEffect = StateEffect.define<Record<number, string[]> | null>();

  // StateField to store line errors for tooltip lookup
  const lineErrorsField = StateField.define<Record<number, string[]>>({
    create() {
      return {};
    },
    update(errors, tr) {
      for (let effect of tr.effects) {
        if (effect.is(setLineErrorsEffect)) {
          return effect.value ?? {};
        }
      }
      return errors;
    }
  });

  // StateField to manage error line decorations
  const errorLineField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(decorations, tr) {
      decorations = decorations.map(tr.changes);
      for (let effect of tr.effects) {
        if (effect.is(setErrorLinesEffect)) {
          if (effect.value === null || effect.value.length === 0) {
            decorations = Decoration.none;
          } else {
            const decoration = Decoration.line({ class: 'cm-errorLine' });
            const ranges = effect.value
              .filter((lineNum) => lineNum > 0 && lineNum <= tr.state.doc.lines)
              .map((lineNum) => decoration.range(tr.state.doc.line(lineNum).from));
            decorations = Decoration.set(ranges, true);
          }
        }
      }
      return decorations;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  // Create hover tooltip for error lines
  const errorTooltip = hoverTooltip(
    (view, pos) => {
      // Get the line at this position
      const line = view.state.doc.lineAt(pos);
      const lineNum = line.number;

      // Check if this line has errors
      const lineErrors = view.state.field(lineErrorsField);
      const errors = lineErrors[lineNum];

      if (!errors || errors.length === 0) return null;

      return {
        pos: line.from,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-error-tooltip';

          errors.forEach((msg) => {
            const msgEl = document.createElement('div');
            msgEl.className = 'cm-error-tooltip-message';
            msgEl.textContent = msg;
            dom.appendChild(msgEl);
          });

          return { dom };
        }
      } satisfies Tooltip;
    },
    { hoverTime: 100 }
  );

  let languageComp = new Compartment();

  let {
    value = $bindable(),
    language = 'javascript',
    placeholder = '',
    class: className = '',
    onrun = () => {},
    onchange = (code: string) => {},
    fontSize = '12px',
    extraExtensions = [],
    onready,
    nodeType,
    lineErrors,
    ...restProps
  }: {
    value?: string;
    language?: SupportedLanguage;
    placeholder?: string;
    class?: string;
    onrun?: () => void;
    onchange?: (code: string) => void;
    extraExtensions?: Extension[];
    fontSize?: string;
    onready?: () => void;
    nodeType?: string;
    lineErrors?: Record<number, string[]>;
  } = $props();

  let editorElement: HTMLDivElement;
  let editorView: EditorView | null = $state(null);
  let isInternalUpdate = false; // Flag to prevent loops when user types

  onMount(async () => {
    if (editorElement) {
      const languageExtension = await loadLanguageExtension(language, { nodeType });

      const extensions = [
        keymap.of(searchKeymap),
        Prec.highest(
          keymap.of([
            {
              key: 'Shift-Enter',
              run: () => {
                onrun();
                return true;
              }
            },
            {
              key: 'Tab',
              run: (view) => {
                // Accept completion if one is active, otherwise indent
                if (completionStatus(view.state) === 'active') {
                  return acceptCompletion(view);
                }

                return indentMore(view);
              }
            }
          ])
        ),
        drawSelection(),
        minimalSetup,

        tokyoNight,

        search(),

        languageComp.of(languageExtension),

        // Error line highlighting with hover tooltips
        errorLineField,
        lineErrorsField,
        errorTooltip,

        // Prevent wheel events from bubbling to XYFlow
        EditorView.domEventHandlers({
          wheel: (event) => {
            event.stopPropagation();
          }
        }),

        EditorView.theme({
          '&': {
            fontSize,
            fontFamily: 'var(--font-mono)'
          },
          '.cm-content': {
            padding: '12px',
            minHeight: '100%',
            maxHeight: '500px',
            maxWidth: '500px',
            color: 'rgb(244 244 245)'
          },
          '.cm-focused': {
            outline: 'none'
          },
          '.cm-editor': {
            borderRadius: '6px',
            border: '1px solid rgb(63 63 70)'
          },
          '.cm-editor.cm-focused': {
            borderColor: 'rgb(59 130 246)',
            boxShadow: '0 0 0 1px rgb(59 130 246)'
          },
          '.cm-scroller': {
            fontFamily: 'inherit'
          },
          '.cm-placeholder': {
            color: 'rgb(115 115 115)'
          },
          '.cm-selectionBackground': {
            backgroundColor: 'rgba(59, 130, 246, 0.3)'
          },
          '.cm-errorLine': {
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderLeft: '3px solid rgb(239 68 68)'
          },
          '.cm-error-tooltip': {
            backgroundColor: 'rgb(39 39 42)',
            border: '1px solid rgb(239 68 68)',
            borderRadius: '4px',
            padding: '6px 10px',
            maxWidth: '400px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
          },
          '.cm-error-tooltip-message': {
            color: 'rgb(252 165 165)',
            padding: '2px 0',
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          },
          '.cm-error-tooltip-message + .cm-error-tooltip-message': {
            borderTop: '1px solid rgb(63 63 70)',
            marginTop: '4px',
            paddingTop: '6px'
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const updatedValue = update.state.doc.toString();

            // Set flag to prevent the $effect from triggering on user input
            isInternalUpdate = true;

            if (onchange) {
              onchange(updatedValue);
            } else {
              value = updatedValue;
            }

            // Reset flag after microtask to allow external updates
            queueMicrotask(() => {
              isInternalUpdate = false;
            });
          }
        }),
        autocompletion(),
        ...extraExtensions
      ];

      if ($useVimInEditor) {
        const { vim, Vim } = await import('@replit/codemirror-vim');
        Vim.defineEx('write', 'w', onrun);
        extensions.push(drawSelection());
        extensions.push(vim({ status: false }));
      }

      // Add placeholder if provided
      if (placeholder) {
        extensions.push(cmPlaceholder(placeholder));
      }

      const state = EditorState.create({
        doc: value ?? '',
        extensions
      });

      editorView = new EditorView({
        state,
        parent: editorElement
      });

      onready?.();
    }
  });

  onDestroy(() => {
    if (editorView) {
      editorView.destroy();
    }
  });

  // Update editor when value prop changes externally
  // We need to read 'value' at the start to make it a tracked dependency
  $effect(() => {
    const newValue = value ?? '';

    // Only update if editor is mounted
    if (!editorView) return;

    // Skip update if the change came from the editor itself (user typing)
    // This prevents unnecessary XYFlow updates on every keystroke
    if (isInternalUpdate) return;

    const currentDoc = editorView.state.doc.toString();

    // Only dispatch if the values are actually different
    if (currentDoc !== newValue) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: newValue
        }
      });
    }
  });

  // Sync language extension with the `language` prop
  $effect(() => {
    loadLanguageExtension(language, { nodeType }).then((languageExtension) => {
      if (editorView) {
        editorView.dispatch({
          effects: languageComp.reconfigure(languageExtension)
        });
      }
    });
  });

  // Highlight error lines when lineErrors prop or editorView changes
  $effect(() => {
    if (!editorView) return;

    const lineCount = editorView.state.doc.lines;

    // Filter lineErrors to only include valid line numbers
    const validLineErrors =
      lineErrors && Object.keys(lineErrors).length > 0
        ? Object.fromEntries(
            Object.entries(lineErrors).filter(([lineStr]) => {
              const line = parseInt(lineStr, 10);
              return line > 0 && line <= lineCount;
            })
          )
        : null;

    // Derive error lines from lineErrors
    const validErrorLines = validLineErrors
      ? Object.keys(validLineErrors)
          .map(Number)
          .sort((a, b) => a - b)
      : null;

    // Dispatch effect to set or clear error lines
    editorView.dispatch({
      effects: [setErrorLinesEffect.of(validErrorLines), setLineErrorsEffect.of(validLineErrors)]
    });
  });
</script>

<div
  bind:this={editorElement}
  class={['code-editor-container nodrag nopan nowheel outline-none', className]}
  {...restProps}
></div>

<style>
  .code-editor-container {
    width: 100%;
    height: 100%;
    min-width: 50px;
    min-height: 25px;
  }

  /* Additional dark theme customizations */
  :global(.code-editor-container .cm-editor) {
    height: 100%;
    background: transparent !important;
  }

  :global(.code-editor-container .cm-content) {
    background: transparent !important;
    color: rgb(244 244 245) !important;
  }

  :global(.code-editor-container .cm-gutters) {
    background: transparent !important;
    border-right: 1px solid transparent !important;
    color: rgb(115 115 115) !important;
  }

  :global(.code-editor-container .cm-activeLine) {
    background: rgba(255, 255, 255, 0.05) !important;
  }

  :global(.code-editor-container .cm-activeLineGutter) {
    background: rgba(255, 255, 255, 0.05) !important;
  }

  :global(.code-editor-container .cm-cursor) {
    border-left-color: rgb(244 244 245) !important;
  }
</style>
