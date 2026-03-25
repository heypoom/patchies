import { toast } from 'svelte-sonner';
import { match } from 'ts-pattern';

/**
 * Checks if the keyboard event target is in a typing context.
 * Checks composedPath() to handle inputs inside shadow DOM (e.g. Vue/DOM nodes).
 */
const isTypingContext = (target: HTMLElement, event?: KeyboardEvent): boolean => {
  if (event) {
    for (const el of event.composedPath()) {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
      if (el instanceof HTMLElement && el.contentEditable === 'true') return true;
    }
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    !!target.closest('.cm-editor') ||
    !!target.closest('.cm-content') ||
    target.contentEditable === 'true' ||
    // Allow text selection in virtual console
    !!target.closest('[role="log"]') ||
    // Allow copy in sidebar
    !!target.closest('[data-sidebar]')
  );
};

const INTERACTIVE_TAGS = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];

/**
 * Checks if the currently focused element is an interactive control
 * that should receive spacebar/enter activation instead of global shortcuts.
 */
const isInteractiveFocus = (): boolean => {
  const el = document.activeElement;
  if (!el || el === document.body) return false;

  if (INTERACTIVE_TAGS.includes(el.tagName)) return true;
  if (el instanceof HTMLAnchorElement && el.hasAttribute('href')) return true;
  if ((el as HTMLElement).contentEditable === 'true') return true;
  if (el.getAttribute('role') === 'button') return true;

  return false;
};

export interface KeyboardShortcutActions {
  // Clipboard
  copy: () => void;
  paste: () => void;

  // History
  undo: () => string | null;
  redo: () => string | null;

  // UI toggles
  toggleSidebar: () => void;
  openObjectBrowser: () => void;
  openCommandPalette: () => void;

  // Transport
  togglePlayPause: () => void;
  toggleTransportPanel: () => void;

  // Patch operations
  newPatch: () => void;
  quickSave: () => void;
  saveAs: () => void;

  // AI operations
  triggerAiPrompt: () => void;
  checkGeminiApiKey: () => boolean;

  // Node operations
  quickAddNode: () => void;

  // State getters
  hasNodeSelected: () => boolean;
  hasTextSelection: () => boolean;
  isCommandPaletteOpen: () => boolean;
  isAiFeaturesVisible: () => boolean;
  isPatchEmpty: () => boolean;
  isAiPromptOpen: () => boolean;

  // AI editing state
  setAiEditingNodeId: (nodeId: string | null) => void;
  getSelectedNodeId: () => string | null;
}

/**
 * KeyboardShortcutManager handles global keyboard shortcuts.
 * Decoupled from component state via action callbacks.
 */
export class KeyboardShortcutManager {
  private actions: KeyboardShortcutActions;
  private boundHandler: (event: KeyboardEvent) => void;

  constructor(actions: KeyboardShortcutActions) {
    this.actions = actions;
    this.boundHandler = this.handleKeydown.bind(this);
  }

  /**
   * Start listening for keyboard events.
   */
  attach(): void {
    document.addEventListener('keydown', this.boundHandler);
  }

  /**
   * Stop listening for keyboard events.
   */
  detach(): void {
    document.removeEventListener('keydown', this.boundHandler);
  }

  private handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isTyping = isTypingContext(target, event);
    const hasNodeSelected = this.actions.hasNodeSelected();
    const hasTextSelection = this.actions.hasTextSelection();
    const key = event.key.toLowerCase();
    const isMod = event.metaKey || event.ctrlKey;

    // CMD+Shift+C: Copy node ID to clipboard
    if (key === 'c' && isMod && event.shiftKey && !isTyping) {
      const nodeId = this.actions.getSelectedNodeId();
      if (nodeId) {
        event.preventDefault();
        navigator.clipboard.writeText(nodeId);
        toast.success(`Copied node ID: ${nodeId}`);
      }

      return;
    }

    // CMD+C: Copy
    if (key === 'c' && isMod && !isTyping && hasNodeSelected && !hasTextSelection) {
      event.preventDefault();
      this.actions.copy();

      return;
    }

    // CMD+V: Paste
    if (key === 'v' && isMod && !isTyping) {
      event.preventDefault();
      this.actions.paste();

      return;
    }

    // CMD+Z: Undo
    if (key === 'z' && isMod && !event.shiftKey && !isTyping) {
      event.preventDefault();

      const desc = this.actions.undo();
      if (desc) toast.success(`Undo: ${desc}`);

      return;
    }

    // CMD+Shift+Z: Redo
    if (key === 'z' && isMod && event.shiftKey && !isTyping) {
      event.preventDefault();

      const desc = this.actions.redo();
      if (desc) toast.success(`Redo: ${desc}`);

      return;
    }

    // CMD+K: Command palette
    if (key === 'k' && isMod && !this.actions.isCommandPaletteOpen()) {
      event.preventDefault();
      this.actions.openCommandPalette();

      return;
    }

    // CMD+B: Toggle sidebar
    if (key === 'b' && isMod && !isTyping) {
      event.preventDefault();
      this.actions.toggleSidebar();

      return;
    }

    // CMD+O: Open object browser
    if (key === 'o' && isMod && !isTyping) {
      event.preventDefault();
      this.actions.openObjectBrowser();

      return;
    }

    // CMD+N: New patch
    if (key === 'n' && isMod && !isTyping) {
      event.preventDefault();
      this.actions.newPatch();

      return;
    }

    // CMD+I: AI object insertion/editing
    if (key === 'i' && isMod && !isTyping) {
      event.preventDefault();

      // When AI features are hidden, fallback to browse objects
      if (!this.actions.isAiFeaturesVisible()) {
        this.actions.openObjectBrowser();
        return;
      }

      // Check if Gemini API key is set
      if (!this.actions.checkGeminiApiKey()) {
        return;
      }

      // If a single node is selected, edit it; otherwise create new
      const selectedNodeId = this.actions.getSelectedNodeId();

      this.actions.setAiEditingNodeId(selectedNodeId);
      this.actions.triggerAiPrompt();

      return;
    }

    // CMD+Shift+S: Save As
    if (key === 's' && isMod && event.shiftKey && !isTyping) {
      event.preventDefault();
      if (this.actions.isPatchEmpty()) return;

      this.actions.saveAs();

      return;
    }

    // CMD+S: Quick save
    if (key === 's' && isMod && !event.shiftKey && !isTyping) {
      event.preventDefault();
      if (this.actions.isPatchEmpty()) return;

      this.actions.quickSave();

      return;
    }

    // Enter: Quick add node (when no node selected and not typing)
    if (key === 'enter' && !this.actions.isCommandPaletteOpen() && !isTyping && !hasNodeSelected) {
      event.preventDefault();
      this.actions.quickAddNode();

      return;
    }

    // Shift+Space: Toggle transport panel
    if (key === ' ' && event.shiftKey && !isTyping && !isInteractiveFocus()) {
      event.preventDefault();
      this.actions.toggleTransportPanel();

      return;
    }

    // Spacebar: Toggle play/pause (when not typing or on interactive element)
    match([key, isTyping || isInteractiveFocus()] as const)
      .with([' ', false], () => {
        event.preventDefault();
        this.actions.togglePlayPause();
      })
      .otherwise(() => {});
  }
}
