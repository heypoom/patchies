/**
 * Service for tracking browser focus and visibility state.
 * Useful for reducing resource usage when the tab is not visible or focused.
 */
export class BrowserFocusService {
  private static instance: BrowserFocusService;

  private _isWindowFocused = true;
  private _isDocumentVisible = true;

  private focusListeners = new Set<(focused: boolean) => void>();
  private visibilityListeners = new Set<(visible: boolean) => void>();

  private constructor() {
    this.initListeners();
  }

  private initListeners(): void {
    // Track window focus/blur
    window.addEventListener('focus', () => {
      this._isWindowFocused = true;
      this.notifyFocusListeners();
    });

    window.addEventListener('blur', () => {
      this._isWindowFocused = false;
      this.notifyFocusListeners();
    });

    // Track document visibility (tab switching)
    document.addEventListener('visibilitychange', () => {
      this._isDocumentVisible = !document.hidden;
      this.notifyVisibilityListeners();
    });
  }

  private notifyFocusListeners(): void {
    for (const listener of this.focusListeners) {
      listener(this._isWindowFocused);
    }
  }

  private notifyVisibilityListeners(): void {
    for (const listener of this.visibilityListeners) {
      listener(this._isDocumentVisible);
    }
  }

  /** Whether the window is currently focused */
  get isWindowFocused(): boolean {
    return this._isWindowFocused;
  }

  /** Whether the document/tab is currently visible */
  get isDocumentVisible(): boolean {
    return this._isDocumentVisible;
  }

  /** Whether the app is both focused and visible (user is actively using it) */
  get isActive(): boolean {
    return this._isWindowFocused && this._isDocumentVisible;
  }

  /** Subscribe to focus changes. Returns unsubscribe function. */
  onFocusChange(listener: (focused: boolean) => void): () => void {
    this.focusListeners.add(listener);
    return () => this.focusListeners.delete(listener);
  }

  /** Subscribe to visibility changes. Returns unsubscribe function. */
  onVisibilityChange(listener: (visible: boolean) => void): () => void {
    this.visibilityListeners.add(listener);
    return () => this.visibilityListeners.delete(listener);
  }

  static getInstance(): BrowserFocusService {
    if (!BrowserFocusService.instance) {
      BrowserFocusService.instance = new BrowserFocusService();
    }

    return BrowserFocusService.instance;
  }
}
