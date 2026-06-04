<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useViewport } from '@xyflow/svelte';
  import { EditorView, minimalSetup } from 'codemirror';
  import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
  import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
  import {
    keymap,
    drawSelection,
    Decoration,
    type DecorationSet,
    hoverTooltip,
    tooltips,
    type Tooltip,
    placeholder as cmPlaceholder
  } from '@codemirror/view';
  import { StateField, StateEffect } from '@codemirror/state';
  import {
    editorAutocompleteEnabled,
    editorFontFamily,
    editorFontSize,
    editorHoverHintsEnabled,
    useVimInEditor
  } from '../../stores/editor.store';
  import { loadLanguageExtension } from '$lib/codemirror/language';
  import { autocompletion, acceptCompletion, completionStatus } from '@codemirror/autocomplete';
  import { indentMore } from '@codemirror/commands';
  import { search, searchKeymap } from '@codemirror/search';
  import type { SupportedLanguage } from '$lib/codemirror/types';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import {
    VALUE_WIDGET_CHANGE_EVENT,
    VALUE_WIDGET_VIEWPORT_CHANGE_EVENT,
    shouldRunOnValueWidgetChange,
    valueWidgetRunThrottleMs
  } from '$lib/codemirror/value-widget-events';

  // Effect to set error lines (supports multiple lines)
  const setErrorLinesEffect = StateEffect.define<number[] | null>();

  // Effect to set line errors with messages
  const setLineErrorsEffect = StateEffect.define<Record<number, string[]> | null>();

  export type InlineDecoration = {
    from: number;
    to: number;
    className: string;
    data?: string;
  };

  const setInlineDecorationsEffect = StateEffect.define<InlineDecoration[] | null>();

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

  const inlineDecorationField = StateField.define<DecorationSet>({
    create() {
      return Decoration.none;
    },
    update(decorations, tx) {
      decorations = decorations.map(tx.changes);

      for (let effect of tx.effects) {
        if (effect.is(setInlineDecorationsEffect)) {
          if (effect.value === null || effect.value.length === 0) {
            decorations = Decoration.none;
          } else {
            const decor = effect.value
              .filter(({ from, to }) => from < to && from >= 0 && to <= tx.state.doc.length)
              .map(({ from, to, className, data }) =>
                Decoration.mark({
                  class: className,
                  attributes: {
                    ...(data ? { 'data-inline-decoration': data } : {})
                  }
                }).range(from, to)
              );

            decorations = Decoration.set(decor, true);
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
  let autocompleteComp = new Compartment();

  let {
    value = $bindable(),
    language = 'javascript',
    placeholder = '',
    class: className = '',
    onrun = () => {},
    onchange = () => {},
    oncommit,
    nodeId,
    dataKey = 'code',
    fontSize,
    fontFamily,
    extraExtensions = [],
    onready,
    nodeType,
    lineErrors,
    inlineDecorations = [],
    onaltdecorationclick,
    lineWrap = false,
    ...restProps
  }: {
    value?: string;
    language?: SupportedLanguage;
    placeholder?: string;
    class?: string;
    onrun?: (code?: string) => void;
    onchange?: (code: string) => void;

    /** Called on blur if value changed since focus. For undo/redo tracking. */
    oncommit?: (detail: { oldValue: string; newValue: string }) => void;

    /** Node ID for automatic undo tracking via event bus */
    nodeId?: string;

    /** Data field name for undo tracking (default: 'code') */
    dataKey?: string;
    extraExtensions?: Extension[];
    fontSize?: string;
    fontFamily?: string;
    onready?: () => void;
    nodeType?: string;
    lineErrors?: Record<number, string[]>;
    inlineDecorations?: InlineDecoration[];
    onaltdecorationclick?: (data: string) => void;

    /** Enable line wrapping */
    lineWrap?: boolean;
  } = $props();

  let editorElement: HTMLDivElement;
  let editorView: EditorView | null = $state(null);
  let isAltNavigationActive = $state(false);
  let altHoveredDecoration: Element | null = null;
  const viewport = useViewport();
  let isInternalUpdate = false; // Flag to prevent loops when user types
  let valueOnFocus: string | null = null; // Track value at focus for undo commit
  let resolvedFontSize = $derived(fontSize ?? `${$editorFontSize}px`);
  let resolvedFontFamily = $derived(fontFamily ?? $editorFontFamily);
  let valueWidgetRunTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastValueWidgetRunAt = 0;
  let pendingValueWidgetRunCode: string | undefined;

  function runValueWidgetCode(code: string | undefined) {
    onrun(code);
    lastValueWidgetRunAt = Date.now();
  }

  function scheduleValueWidgetRun(code: string | undefined) {
    const throttleMs = valueWidgetRunThrottleMs(language, nodeType);

    if (throttleMs <= 0) {
      runValueWidgetCode(code);
      return;
    }

    pendingValueWidgetRunCode = code;

    const elapsed = Date.now() - lastValueWidgetRunAt;
    const remaining = throttleMs - elapsed;

    if (remaining <= 0) {
      if (valueWidgetRunTimeout) {
        clearTimeout(valueWidgetRunTimeout);
        valueWidgetRunTimeout = null;
      }

      runValueWidgetCode(pendingValueWidgetRunCode);
      pendingValueWidgetRunCode = undefined;

      return;
    }

    if (valueWidgetRunTimeout) return;

    valueWidgetRunTimeout = setTimeout(() => {
      valueWidgetRunTimeout = null;

      runValueWidgetCode(pendingValueWidgetRunCode);
      pendingValueWidgetRunCode = undefined;
    }, remaining);
  }

  function handleValueWidgetChange(event: Event) {
    const valueFromEvent =
      event instanceof CustomEvent && typeof event.detail?.value === 'string'
        ? event.detail.value
        : editorView?.state.doc.toString();

    if (shouldRunOnValueWidgetChange(language, nodeType)) {
      scheduleValueWidgetRun(valueFromEvent);
    }
  }

  function setAltNavigationActive(event: KeyboardEvent) {
    if (event.key === 'Alt') {
      isAltNavigationActive = event.type === 'keydown';
      if (!isAltNavigationActive) {
        clearAltHoveredDecoration();
      }
    }
  }

  function handleWindowBlur() {
    isAltNavigationActive = false;
    clearAltHoveredDecoration();
  }

  function clearAltHoveredDecoration() {
    altHoveredDecoration?.classList.remove('cm-alt-navigation-hover');
    altHoveredDecoration = null;
  }

  function setAltHoveredDecoration(decoration: Element | null) {
    if (decoration === altHoveredDecoration) return;

    clearAltHoveredDecoration();
    altHoveredDecoration = decoration;
    altHoveredDecoration?.classList.add('cm-alt-navigation-hover');
  }

  function getInlineDecorationTarget(event: Event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest('[data-inline-decoration]') ?? null;
  }

  onMount(async () => {
    if (editorElement) {
      editorElement.addEventListener(VALUE_WIDGET_CHANGE_EVENT, handleValueWidgetChange);

      window.addEventListener('keydown', setAltNavigationActive);
      window.addEventListener('keyup', setAltNavigationActive);
      window.addEventListener('blur', handleWindowBlur);

      const languageExtension = await loadLanguageExtension(
        language,
        { nodeType },
        {
          autocomplete: $editorAutocompleteEnabled,
          hoverHints: $editorHoverHintsEnabled
        }
      );

      const extensions = [
        keymap.of(searchKeymap),

        Prec.highest(
          keymap.of([
            {
              key: 'Shift-Enter',
              run: () => {
                onrun(editorView?.state.doc.toString());
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
        tooltips({ parent: document.body }),
        errorLineField,
        inlineDecorationField,
        lineErrorsField,
        errorTooltip,

        // Prevent wheel events from bubbling to XYFlow
        // Track focus/blur for undo commit
        EditorView.domEventHandlers({
          wheel: (event) => {
            event.stopPropagation();
          },
          focus: (_event, view) => {
            valueOnFocus = view.state.doc.toString();
          },
          blur: (_event, view) => {
            if (valueOnFocus !== null) {
              const currentValue = view.state.doc.toString();

              if (currentValue !== valueOnFocus) {
                // Call oncommit callback if provided
                oncommit?.({ oldValue: valueOnFocus, newValue: currentValue });

                // Emit event for undo tracking if nodeId is provided
                if (nodeId) {
                  PatchiesEventBus.getInstance().dispatch({
                    type: 'codeCommit',
                    nodeId,
                    dataKey,
                    oldValue: valueOnFocus,
                    newValue: currentValue
                  });
                }
              }
            }

            valueOnFocus = null;
          },
          click: (event) => {
            if (!event.altKey) return false;

            const decoration = getInlineDecorationTarget(event);

            const data = decoration?.getAttribute('data-inline-decoration');
            if (!data) return false;

            event.preventDefault();
            event.stopPropagation();
            onaltdecorationclick?.(data);
            return true;
          },
          mousemove: (event) => {
            if (!event.altKey) {
              clearAltHoveredDecoration();
              return false;
            }

            setAltHoveredDecoration(getInlineDecorationTarget(event));
            return false;
          },
          mouseleave: () => {
            clearAltHoveredDecoration();
            return false;
          }
        }),

        EditorView.theme({
          '&': {
            fontSize: 'var(--patchies-code-editor-font-size)',
            fontFamily: 'var(--patchies-code-editor-font-family)'
          },
          '.cm-content': {
            padding: '12px',
            minHeight: '100%',
            maxHeight: '500px',
            maxWidth: '500px',
            color: 'rgb(244 244 245)',
            cursor: 'text'
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
          '.cm-patchbay-unknown-channel': {
            color: 'rgb(252 165 165)',
            textDecoration: 'underline wavy rgb(248 113 113)',
            textDecorationThickness: '1px',
            textUnderlineOffset: '3px'
          },
          '.cm-patchbay-local-channel, .cm-patchbay-local-channel *': {
            color: 'rgb(196 181 253)'
          },
          '.cm-patchbay-object-name, .cm-patchbay-object-name *': {
            color: 'rgb(253 224 171) !important'
          },
          '.cm-patchbay-object-assignment, .cm-patchbay-object-assignment *': {
            color: 'rgb(224 231 255) !important'
          },
          '.cm-patchbay-object-keyword, .cm-patchbay-object-keyword *': {
            color: 'rgb(255, 202, 105) !important'
          },
          '.cm-patchbay-role-error': {
            color: 'rgb(252 165 165)',
            textDecoration: 'underline wavy rgb(248 113 113)',
            textDecorationThickness: '1px',
            textUnderlineOffset: '3px'
          },
          '.cm-completion-hover': {
            boxSizing: 'border-box',
            minWidth: 'min(260px, calc(100vw - 32px))',
            maxWidth: '320px',
            padding: '8px 10px',
            border: '1px solid rgb(63 63 70)',
            borderRadius: '4px',
            backgroundColor: 'rgb(39 39 42)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            lineHeight: '1.35'
          },
          '.cm-completion-hover-label': {
            color: 'rgb(244 244 245)',
            fontSize: '12px',
            fontWeight: '600'
          },
          '.cm-completion-hover-detail': {
            marginTop: '2px',
            color: 'rgb(147 197 253)',
            fontSize: '11px'
          },
          '.cm-completion-hover-info': {
            marginTop: '6px',
            color: 'rgb(212 212 216)',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px'
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
        autocompleteComp.of($editorAutocompleteEnabled ? autocompletion() : []),
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

      // Add line wrapping if enabled
      if (lineWrap) {
        extensions.push(EditorView.lineWrapping);
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

  /** Insert text at the current cursor position (or replace selection) */
  export function insertAtCursor(text: string) {
    if (!editorView) return;

    const { main } = editorView.state.selection;

    editorView.dispatch({
      changes: { from: main.from, to: main.to, insert: text },
      selection: { anchor: main.from + text.length }
    });

    editorView.focus();
  }

  onDestroy(() => {
    editorElement?.removeEventListener(VALUE_WIDGET_CHANGE_EVENT, handleValueWidgetChange);
    window.removeEventListener('keydown', setAltNavigationActive);
    window.removeEventListener('keyup', setAltNavigationActive);
    window.removeEventListener('blur', handleWindowBlur);

    if (valueWidgetRunTimeout) {
      clearTimeout(valueWidgetRunTimeout);
    }

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

  // Sync language, autocomplete, and hover-hint extensions with editor settings.
  $effect(() => {
    const autocomplete = $editorAutocompleteEnabled;
    const hoverHints = $editorHoverHintsEnabled;

    loadLanguageExtension(language, { nodeType }, { autocomplete, hoverHints }).then(
      (languageExtension) => {
        if (editorView) {
          editorView.dispatch({
            effects: [
              languageComp.reconfigure(languageExtension),
              autocompleteComp.reconfigure(autocomplete ? autocompletion() : [])
            ]
          });
        }
      }
    );
  });

  // Reposition body-level value widgets when xyflow pan/zoom changes.
  $effect(() => {
    if (!editorView) return;

    const { x, y, zoom } = viewport.current;

    editorView.dom.dispatchEvent(
      new CustomEvent(VALUE_WIDGET_VIEWPORT_CHANGE_EVENT, {
        detail: { x, y, zoom }
      })
    );
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

  $effect(() => {
    if (!editorView) return;

    editorView.dispatch({
      effects: setInlineDecorationsEffect.of(inlineDecorations)
    });
  });
</script>

<div
  bind:this={editorElement}
  class={[
    'code-editor-container nodrag nopan nowheel outline-none',
    isAltNavigationActive && 'cm-alt-navigation-active',
    className
  ]}
  style:--patchies-code-editor-font-size={resolvedFontSize}
  style:--patchies-code-editor-font-family={resolvedFontFamily}
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

  :global(
    .code-editor-container.cm-alt-navigation-active
      .cm-patchbay-channel-link.cm-alt-navigation-hover
  ),
  :global(
    .code-editor-container.cm-alt-navigation-active .cm-patchbay-object-link.cm-alt-navigation-hover
  ) {
    cursor: pointer;
    color: rgb(147 197 253);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
