import { EditorView } from '@codemirror/view';

export const valueWidgetsTheme = EditorView.baseTheme({
  '.cm-value-widget': {
    position: 'relative',
    display: 'inline-block',
    width: '0.75em',
    height: '0.75em',
    marginLeft: '0.35em',
    verticalAlign: '-0.08em',
    border: '1px solid rgba(212, 212, 216, 0.55)',
    borderRadius: '2px',
    boxSizing: 'border-box',
    cursor: 'ns-resize',
    opacity: '0.78'
  },
  '.cm-value-widget-number-active': {
    textDecoration: 'underline',
    textDecorationColor: 'rgba(147, 197, 253, 0.95)',
    textDecorationThickness: '2px',
    textUnderlineOffset: '3px',
    cursor: 'ns-resize'
  },
  '.cm-value-widget-active': {
    textDecoration: 'underline',
    textDecorationColor: 'rgba(147, 197, 253, 0.95)',
    textDecorationThickness: '2px',
    textUnderlineOffset: '3px',
    backgroundColor: 'rgba(147, 197, 253, 0.12)',
    borderRadius: '2px',
    cursor: 'crosshair'
  },
  '.cm-value-widget-xy': {
    background:
      'linear-gradient(90deg, transparent 45%, rgba(147, 197, 253, 0.9) 45%, rgba(147, 197, 253, 0.9) 55%, transparent 55%), linear-gradient(0deg, transparent 45%, rgba(147, 197, 253, 0.9) 45%, rgba(147, 197, 253, 0.9) 55%, transparent 55%)'
  },
  '.cm-value-widget-color': {
    borderColor: 'rgba(244, 244, 245, 0.8)',
    cursor: 'pointer'
  },
  '.cm-value-widget-xy-grid': {
    position: 'absolute',
    zIndex: '50',
    left: '50%',
    top: '1.1em',
    width: '160px',
    height: '160px',
    transform: 'translateX(-50%)',
    border: '1px solid rgba(161, 161, 170, 0.9)',
    backgroundColor: 'rgba(24, 24, 27, 0.96)',
    backgroundImage:
      'linear-gradient(rgba(161, 161, 170, 0.24) 1px, transparent 1px), linear-gradient(90deg, rgba(161, 161, 170, 0.24) 1px, transparent 1px), linear-gradient(rgba(244, 244, 245, 0.42) 1px, transparent 1px), linear-gradient(90deg, rgba(244, 244, 245, 0.42) 1px, transparent 1px)',
    backgroundSize: '16px 16px, 16px 16px, 80px 80px, 80px 80px',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
    cursor: 'crosshair'
  },
  '.cm-value-widget-xy-dot': {
    position: 'absolute',
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    backgroundColor: 'rgb(244, 244, 245)',
    border: '1px solid rgb(9, 9, 11)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none'
  }
});
