import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { fromStore, writable } from 'svelte/store';
import { EditorView } from '@codemirror/view';
import DetachedCodeEditorHost from './DetachedCodeEditorHost.svelte';

import {
  activeCodeEditorTarget,
  closeCodeEditorOverlay,
  openCodeEditorOverlay
} from '../../stores/code-editor-layout.store';

import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

vi.mock('@xyflow/svelte', () => ({
  useViewport: () => ({ current: { x: 0, y: 0, zoom: 1 } })
}));

vi.mock('$lib/codemirror/language', () => ({ loadLanguageExtension: async () => [] }));

vi.mock(
  './DetachedCodeEditorOverlay.svelte',
  () => import('./test-fixtures/DetachedCodeEditorShell.svelte')
);

let component: ReturnType<typeof mount> | undefined;
const onCommit = vi.fn();
const bus = PatchiesEventBus.getInstance();

const code = writable('initial');
const nodeExists = writable(true);

const editorValue = fromStore(code);
const hasNode = fromStore(nodeExists);
const activeTarget = fromStore(activeCodeEditorTarget);

const props = {
  get target() {
    return activeTarget.current;
  },
  get hasNode() {
    return hasNode.current;
  },
  get value() {
    return editorValue.current;
  },
  onchange: (value: string) => code.set(value),
  onClose: closeCodeEditorOverlay,
  fontSize: 16
};

afterEach(async () => {
  if (component) await unmount(component);

  component = undefined;
  closeCodeEditorOverlay();

  bus.removeEventListener('codeCommit', onCommit);
  onCommit.mockClear();

  code.set('initial');
  nodeExists.set(true);
});

it.each(['close', 'switch node', 'switch field', 'sidebar', 'delete node'])(
  'commits the original node edit on %s',
  async (action) => {
    openCodeEditorOverlay({ nodeId: 'node-1', dataKey: 'expr', language: 'javascript' });
    bus.addEventListener('codeCommit', onCommit);

    component = mount(DetachedCodeEditorHost, {
      target: document.body,
      props
    });

    await vi.waitFor(() => expect(document.querySelector('.cm-content')).not.toBeNull());

    const content = document.querySelector<HTMLElement>('.cm-content')!;
    const view = EditorView.findFromDOM(content)!;
    view.focus();

    expect(document.activeElement).toBe(content);

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: 'edited'
      }
    });

    if (action === 'close') {
      closeCodeEditorOverlay();
    } else if (action === 'delete node') {
      nodeExists.set(false);
    } else {
      activeCodeEditorTarget.set({
        nodeId: action === 'switch node' ? 'node-2' : 'node-1',
        dataKey: action === 'switch field' ? 'code' : 'expr',
        language: 'javascript',
        mode: action === 'sidebar' ? 'sidebar' : 'overlay'
      });
    }

    await tick();

    expect(document.body.contains(content)).toBe(false);

    expect(onCommit).toHaveBeenCalledExactlyOnceWith({
      type: 'codeCommit',
      nodeId: 'node-1',
      dataKey: 'expr',
      oldValue: 'initial',
      newValue: 'edited'
    });
  }
);
