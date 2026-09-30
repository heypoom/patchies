import { onDestroy, untrack } from 'svelte';
import { SelectionChangeController } from './SelectionChangeController';

type SelectionChangeOptions = {
  getSelected: () => boolean;
  onError: (error: unknown) => void;
};

export function useSelectionChange({ getSelected, onError }: SelectionChangeOptions) {
  const controller = new SelectionChangeController({
    getSelected: () => untrack(getSelected),
    onError
  });

  $effect(() => {
    const selected = getSelected();

    untrack(() => controller.update(selected));
  });

  const reset = () => controller.clear();

  onDestroy(reset);

  return {
    onSelectionChange: controller.onSelectionChange,
    reset
  };
}
