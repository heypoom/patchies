import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { fromStore, writable } from 'svelte/store';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import AssemblyEditor from './AssemblyEditor.svelte';
import { loadLanguageExtension } from '$lib/codemirror/language';

vi.mock('$lib/codemirror/language', () => ({ loadLanguageExtension: vi.fn(async () => []) }));

let component: ReturnType<typeof mount> | undefined;
let target: HTMLElement | undefined;

afterEach(async () => {
  if (component) await unmount(component);

  target?.remove();
  component = undefined;
  target = undefined;
  vi.mocked(loadLanguageExtension).mockClear();
});

it('preserves assembly editor updates, run shortcuts and readonly input callbacks', async () => {
  const value = writable('push 1');
  const readonly = writable(false);
  const state = fromStore(value);
  const readonlyState = fromStore(readonly);
  const onrun = vi.fn();
  const onReadonlyInput = vi.fn();
  let highlight: ((line: number) => void) | undefined;
  target = document.createElement('div');
  document.body.appendChild(target);
  component = mount(AssemblyEditor, {
    target,
    props: {
      get value() {
        return state.current;
      },
      get readonly() {
        return readonlyState.current;
      },
      onchange: (next) => value.set(next),
      highlightLine: (callback) => (highlight = callback),
      onrun,
      onReadonlyInput
    }
  });

  await vi.waitFor(() => expect(highlight).toBeDefined());

  const view = EditorView.findFromDOM(target.querySelector('.cm-content')!)!;
  highlight!(1);
  view.focus();
  view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true })
  );

  expect(onrun).toHaveBeenCalledOnce();

  value.set('push 2');

  await vi.waitFor(() => expect(view.state.doc.toString()).toBe('push 2'));

  readonly.set(true);
  await tick();
  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

  expect(onReadonlyInput).toHaveBeenCalledOnce();
});

it('does not create the assembly editor after closing during language loading', async () => {
  let resolve!: (extensions: Extension[]) => void;
  const pending = new Promise<Extension[]>((done) => (resolve = done));
  vi.mocked(loadLanguageExtension).mockReturnValueOnce(pending);
  target = document.createElement('div');
  document.body.appendChild(target);
  component = mount(AssemblyEditor, { target, props: { value: 'push 1' } });

  await vi.waitFor(() => expect(loadLanguageExtension).toHaveBeenCalled());

  const host = target.firstElementChild!;
  await unmount(component);
  component = undefined;
  resolve([]);
  await pending;
  await tick();

  expect(host.querySelector('.cm-editor')).toBeNull();
});
