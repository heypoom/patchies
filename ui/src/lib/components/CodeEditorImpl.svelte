<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { useViewport } from '@xyflow/svelte';
  import { EditorView, minimalSetup } from 'codemirror';
  import { Annotation, Compartment, EditorState, Prec, type Extension } from '@codemirror/state';
  import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
  import { keymap, drawSelection, tooltips, placeholder as cmPlaceholder } from '@codemirror/view';
  import {
    setErrorLinesEffect,
    setLineErrorsEffect,
    lineErrorsField,
    errorLineField,
    errorTooltip
  } from '$lib/codemirror/editor-errors';
  import {
    editorAutocompleteEnabled,
    editorFontFamily,
    editorFontSize,
    editorHoverHintsEnabled,
    useVimInEditor
  } from '../../stores/editor.store';
  import { loadLanguageExtension } from '$lib/codemirror/language';
  import { autocompletion } from '@codemirror/autocomplete';
  import { search, searchKeymap } from '@codemirror/search';
  import type { SupportedLanguage } from '$lib/codemirror/types';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import {
    VALUE_WIDGET_CHANGE_EVENT,
    VALUE_WIDGET_VIEWPORT_CHANGE_EVENT,
    shouldRunOnValueWidgetChange,
    valueWidgetRunThrottleMs
  } from '$lib/codemirror/value-widget-events';
  import {
    getInlineDecorationTarget,
    inlineDecorationExtensions,
    inlineDecorationTheme,
    setInlineDecorationsEffect,
    type InlineDecoration
  } from '$lib/codemirror/inline-decorations';
  import { vimWriteCommandDispatcher } from '$lib/codemirror/vim-write-command';
  import { editorTheme } from '$lib/codemirror/editor-theme';
  import { completionOrIndentKeymap } from '$lib/codemirror/editor-keymap';

  let languageComp = new Compartment();
  let autocompleteComp = new Compartment();
  let placeholderComp = new Compartment();

  let {
    value = $bindable(),
    language = 'javascript',
    placeholder = '',
    class: className = '',
    onrun = () => {},
    onsave,
    onchange = () => {},
    onundo,
    onredo,
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
    onsave?: () => void;
    onchange?: (code: string) => void;
    onundo?: () => boolean;
    onredo?: () => boolean;

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
  const externalValueUpdate = Annotation.define<boolean>();
  let valueOnFocus: string | null = null; // Track value at focus for undo commit
  let resolvedFontSize = $derived(fontSize ?? `${$editorFontSize}px`);
  let resolvedFontFamily = $derived(fontFamily ?? $editorFontFamily);
  let valueWidgetRunTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastValueWidgetRunAt = 0;
  let pendingValueWidgetRunCode: string | undefined;
  let languageRequestVersion = 0;
  let removeVimWriteHandler: (() => void) | null = null;

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

  let destroyed = false;

  onMount(async () => {
    if (editorElement) {
      editorElement.addEventListener(VALUE_WIDGET_CHANGE_EVENT, handleValueWidgetChange);

      window.addEventListener('keydown', setAltNavigationActive);
      window.addEventListener('keyup', setAltNavigationActive);
      window.addEventListener('blur', handleWindowBlur);

      const languageExtension = await loadLanguageExtension(
        language,
        { nodeType },
        { autocomplete: $editorAutocompleteEnabled, hoverHints: $editorHoverHintsEnabled }
      );

      if (destroyed) return;

      const extensions = [
        keymap.of(searchKeymap),

        Prec.highest(
          keymap.of([
            {
              key: 'Mod-s',
              run: () => {
                if (!onsave) return false;

                onsave();

                return true;
              }
            },
            {
              key: 'Shift-Enter',
              run: () => {
                onrun(editorView?.state.doc.toString());

                return true;
              }
            },
            {
              key: 'Mod-z',
              run: () => onundo?.() ?? false
            },
            {
              key: 'Mod-Shift-z',
              run: () => onredo?.() ?? false
            },
            {
              key: 'Mod-y',
              run: () => onredo?.() ?? false
            },
            ...completionOrIndentKeymap
          ])
        ),

        drawSelection(),
        minimalSetup,

        tokyoNight,

        search(),

        languageComp.of(languageExtension),
        placeholderComp.of(placeholder ? cmPlaceholder(placeholder) : []),

        // Error line highlighting with hover tooltips
        tooltips({ parent: document.body }),
        errorLineField,
        lineErrorsField,
        errorTooltip,
        inlineDecorationExtensions,

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

            if (onaltdecorationclick) {
              event.preventDefault();
              event.stopPropagation();
              onaltdecorationclick(data);
              return true;
            }

            return false;
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

        editorTheme,
        inlineDecorationTheme,
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            !update.transactions.some((transaction) => transaction.annotation(externalValueUpdate))
          ) {
            const updatedValue = update.state.doc.toString();

            if (onchange) {
              onchange(updatedValue);
            } else {
              value = updatedValue;
            }
          }
        }),
        autocompleteComp.of($editorAutocompleteEnabled ? autocompletion() : []),
        ...extraExtensions
      ];

      const vimEnabled = $useVimInEditor;

      if (vimEnabled) {
        const { vim, Vim } = await import('@replit/codemirror-vim');

        vimWriteCommandDispatcher.register((dispatchWrite) => {
          Vim.defineEx('write', 'w', (cm) => {
            dispatchWrite(cm.cm6);
          });
        });

        extensions.push(drawSelection());
        extensions.push(vim({ status: false }));
      }

      if (destroyed) return;

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

      if (vimEnabled) {
        const view = editorView;

        removeVimWriteHandler = vimWriteCommandDispatcher.setHandler(view, () => {
          if (onsave) {
            onsave();

            return;
          }

          onrun(view.state.doc.toString());
        });
      }

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
    destroyed = true;

    editorElement?.removeEventListener(VALUE_WIDGET_CHANGE_EVENT, handleValueWidgetChange);
    window.removeEventListener('keydown', setAltNavigationActive);
    window.removeEventListener('keyup', setAltNavigationActive);
    window.removeEventListener('blur', handleWindowBlur);

    if (valueWidgetRunTimeout) {
      clearTimeout(valueWidgetRunTimeout);
    }

    removeVimWriteHandler?.();

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

    const currentDoc = editorView.state.doc.toString();

    // Only dispatch if the values are actually different
    if (currentDoc !== newValue) {
      editorView.dispatch({
        annotations: externalValueUpdate.of(true),
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
    const requestVersion = ++languageRequestVersion;

    loadLanguageExtension(language, { nodeType }, { autocomplete, hoverHints }).then(
      (languageExtension) => {
        if (!destroyed && editorView && requestVersion === languageRequestVersion) {
          editorView.dispatch({
            effects: [
              languageComp.reconfigure(languageExtension),
              autocompleteComp.reconfigure(autocomplete ? autocompletion() : []),
              placeholderComp.reconfigure(placeholder ? cmPlaceholder(placeholder) : [])
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
