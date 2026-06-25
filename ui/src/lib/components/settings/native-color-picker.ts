export interface NativeColorPickerSession {
  id: number;
}

export interface OpenNativeColorPickerOptions {
  value: string;
  onInput: (value: string) => void;
  onChange?: (value: string) => void;
  getDocument?: () => Document | undefined;
}

interface ActiveCallbacks {
  id: number;
  onInput: (value: string) => void;
  onChange?: (value: string) => void;
}

let activeInput: HTMLInputElement | null = null;
let activeCallbacks: ActiveCallbacks | null = null;
let nextSessionId = 1;

const currentDocument = (): Document | undefined =>
  typeof document === 'undefined' ? undefined : document;

function ensureColorInput(doc: Document): HTMLInputElement {
  if (activeInput) return activeInput;

  const input = doc.createElement('input');
  input.type = 'color';
  input.className = 'patchies-native-color-picker';
  input.tabIndex = -1;
  input.ariaHidden = 'true';

  Object.assign(input.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '1px',
    height: '1px',
    opacity: '0',
    pointerEvents: 'none'
  });

  input.addEventListener('input', () => {
    activeCallbacks?.onInput(input.value);
  });

  input.addEventListener('change', () => {
    activeCallbacks?.onChange?.(input.value);
  });

  doc.body.appendChild(input);
  activeInput = input;

  return input;
}

export function openNativeColorPicker({
  value,
  onInput,
  onChange,
  getDocument = currentDocument
}: OpenNativeColorPickerOptions): NativeColorPickerSession | null {
  const doc = getDocument();
  if (!doc) return null;

  const input = ensureColorInput(doc);
  const session = { id: nextSessionId++ };

  activeCallbacks = { id: session.id, onInput, onChange };
  input.value = value;

  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  } catch {
    try {
      input.click();
    } catch {
      // Some browsers reject programmatic picker opening in edge cases.
      // The callbacks remain active in case the input still produces events.
    }
  }

  return session;
}

export function dismissActiveNativeColorPicker(session?: NativeColorPickerSession | null): void {
  if (!activeInput) return;
  if (session && activeCallbacks?.id !== session.id) return;

  activeInput.blur();
}

export function __resetNativeColorPickerForTests(): void {
  activeInput = null;
  activeCallbacks = null;
  nextSessionId = 1;
}
