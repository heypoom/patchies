import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { fromStore, writable } from 'svelte/store';
import { EditorView, keymap } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import CodeEditor from './CodeEditor.svelte';
import { loadLanguageExtension } from '$lib/codemirror/language';

vi.mock('@xyflow/svelte', () => ({ useViewport: () => ({ current: { x: 0, y: 0, zoom: 1 } }) }));
vi.mock('$lib/codemirror/language', () => ({ loadLanguageExtension: vi.fn(async () => []) }));

let component: ReturnType<typeof CodeEditor> | undefined;
let target: HTMLElement | undefined;

afterEach(async () => {
  if (component) await unmount(component);

  target?.remove();
  component = undefined;
  target = undefined;
  vi.mocked(loadLanguageExtension).mockClear();
});

it('forwards readiness, cursor insertion and external value updates through the lazy editor', async () => {
  const value = writable('initial');
  const state = fromStore(value);
  const onready = vi.fn();
  const runShortcut = vi.fn(() => true);
  const loadExtensions = vi.fn(async () => [keymap.of([{ key: 'F2', run: runShortcut }])]);
  target = document.createElement('div');
  document.body.appendChild(target);
  component = mount(CodeEditor, {
    target,
    props: {
      get value() {
        return state.current;
      },
      onchange: (next) => value.set(next),
      onready,
      loadExtensions
    }
  });

  await vi.waitFor(() => expect(onready).toHaveBeenCalledOnce());

  const view = EditorView.findFromDOM(target.querySelector('.cm-content')!)!;
  component.insertAtCursor('prefix ');

  expect(view.state.doc.toString()).toBe('prefix initial');
  expect(state.current).toBe('prefix initial');

  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));

  expect(loadExtensions).toHaveBeenCalledOnce();
  expect(runShortcut).toHaveBeenCalledOnce();

  value.set('external');

  await vi.waitFor(() => expect(view.state.doc.toString()).toBe('external'));
});

it('does not create an editor after unmounting during language loading', async () => {
  let resolve!: (extensions: Extension[]) => void;
  const pending = new Promise<Extension[]>((done) => (resolve = done));
  vi.mocked(loadLanguageExtension).mockReturnValueOnce(pending);
  const onready = vi.fn();
  target = document.createElement('div');
  document.body.appendChild(target);
  component = mount(CodeEditor, { target, props: { value: 'initial', onready } });

  await vi.waitFor(() => expect(loadLanguageExtension).toHaveBeenCalled());

  // Retain the former host so a leaked editor on detached DOM is observable too.
  const editorHost = target.querySelector('.code-editor-container')!;
  await unmount(component);
  component = undefined;
  resolve([]);
  await pending;
  await tick();

  expect(editorHost.querySelector('.cm-editor')).toBeNull();
  expect(onready).not.toHaveBeenCalled();
});

it('allows failed editor extensions to be retried before creating the editor', async () => {
  const loadExtensions = vi
    .fn()
    .mockRejectedValueOnce(new Error('Download failed'))
    .mockResolvedValue([]);
  const onready = vi.fn();
  target = document.createElement('div');
  document.body.appendChild(target);
  component = mount(CodeEditor, { target, props: { value: 'initial', loadExtensions, onready } });

  await vi.waitFor(() => expect(target!.querySelector('[role="alert"]')).not.toBeNull());

  expect(onready).not.toHaveBeenCalled();

  target.querySelector('button')!.click();

  await vi.waitFor(() => expect(onready).toHaveBeenCalledOnce());

  expect(loadExtensions).toHaveBeenCalledTimes(2);
  expect(target.querySelector('.cm-content')!.textContent).toBe('initial');
});
