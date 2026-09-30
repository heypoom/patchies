export type SelectionChangeCallback = (selected: boolean) => void | Promise<void>;

type Subscription = {
  callback: SelectionChangeCallback;
  selected: boolean;
};

/** Shares selection with user code without imposing the preview's border geometry. */
export class SelectionChangeController {
  private subscriptions = new Set<Subscription>();

  constructor(
    private options: {
      getSelected: () => boolean;
      onError: (error: unknown) => void;
    }
  ) {}

  onSelectionChange = (callback: SelectionChangeCallback) => {
    const selected = this.options.getSelected();
    const subscription = { callback, selected };
    this.subscriptions.add(subscription);

    this.notify(callback, selected);

    return () => this.subscriptions.delete(subscription);
  };

  update(selected: boolean) {
    for (const subscription of [...this.subscriptions]) {
      if (!this.subscriptions.has(subscription) || subscription.selected === selected) continue;

      subscription.selected = selected;
      this.notify(subscription.callback, selected);
    }
  }

  clear() {
    this.subscriptions.clear();
  }

  private notify(callback: SelectionChangeCallback, selected: boolean) {
    try {
      const result = callback(selected);

      if (result) {
        Promise.resolve(result).catch(this.options.onError);
      }
    } catch (error) {
      this.options.onError(error);
    }
  }
}
