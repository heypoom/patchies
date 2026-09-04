import type { EditorView } from '@codemirror/view';

type RegisterWriteCommand<TView> = (dispatchWrite: (view: TView) => void) => void;

/** Routes Vim's global :w command to the CodeEditor instance that invoked it. */
export class VimWriteCommandDispatcher<TView extends object> {
  private handlers = new WeakMap<TView, () => void>();
  private registered = false;

  register(registerCommand: RegisterWriteCommand<TView>): void {
    if (this.registered) return;

    registerCommand((view) => this.handlers.get(view)?.());

    this.registered = true;
  }

  setHandler(view: TView, handler: () => void): () => void {
    this.handlers.set(view, handler);

    return () => {
      if (this.handlers.get(view) === handler) {
        this.handlers.delete(view);
      }
    };
  }
}

export const vimWriteCommandDispatcher = new VimWriteCommandDispatcher<EditorView>();
