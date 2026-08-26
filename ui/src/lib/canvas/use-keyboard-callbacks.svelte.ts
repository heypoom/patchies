type KeyboardCallback = (event: KeyboardEvent) => void;

type KeyboardCallbacksOptions = {
  onError?: (error: unknown) => void;
};

type AttachOptions = {
  stopPropagation?: boolean;
};

export function useKeyboardCallbacks({ onError }: KeyboardCallbacksOptions = {}) {
  let callbacks: {
    onKeyDown?: KeyboardCallback;
    onKeyUp?: KeyboardCallback;
  } = {};

  function invoke(
    callback: KeyboardCallback | undefined,
    event: KeyboardEvent,
    options: AttachOptions
  ) {
    if (!callback) return;

    if (options.stopPropagation ?? true) event.stopPropagation();

    try {
      callback(event);
    } catch (error) {
      onError?.(error);
    }
  }

  function createEventHandlers(options: AttachOptions = {}) {
    return {
      keydown: (event: Event) => invoke(callbacks.onKeyDown, event as KeyboardEvent, options),
      keyup: (event: Event) => invoke(callbacks.onKeyUp, event as KeyboardEvent, options)
    };
  }

  function attach(target: HTMLElement | Document, options: AttachOptions = {}) {
    const handlers = createEventHandlers(options);

    target.addEventListener('keydown', handlers.keydown);
    target.addEventListener('keyup', handlers.keyup);

    return () => {
      target.removeEventListener('keydown', handlers.keydown);
      target.removeEventListener('keyup', handlers.keyup);
    };
  }

  return {
    onKeyDown(callback: KeyboardCallback) {
      callbacks.onKeyDown = callback;
    },
    onKeyUp(callback: KeyboardCallback) {
      callbacks.onKeyUp = callback;
    },
    reset() {
      callbacks = {};
    },
    attach
  };
}
