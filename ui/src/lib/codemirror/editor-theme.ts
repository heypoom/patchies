import { EditorView } from '@codemirror/view';

export const editorTheme = EditorView.theme({
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
  '.cm-patchbay-virtual-expression-name, .cm-patchbay-virtual-expression-name *': {
    color: 'rgb(156, 255, 192) !important'
  },
  '.cm-patchbay-virtual-expression-keyword, .cm-patchbay-virtual-expression-keyword *': {
    color: 'rgb(81, 255, 144) !important'
  },
  '.cm-patchbay-virtual-expression-operator, .cm-patchbay-virtual-expression-operator *': {
    color: 'rgb(196 181 253) !important'
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
});
