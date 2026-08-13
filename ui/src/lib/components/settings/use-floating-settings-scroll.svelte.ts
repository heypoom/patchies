export interface FloatingSettingsScrollController {
  element: HTMLDivElement | undefined;
  readonly isScrollable: boolean;
  readonly hasMore: boolean;
  onScroll: () => void;
}

/**
 * Tracks overflow for a floating settings panel and keeps its scroll affordance
 * in sync as the viewport or panel content changes.
 */
export function useFloatingSettingsScroll(
  isEnabled: () => boolean
): FloatingSettingsScrollController {
  let element = $state<HTMLDivElement>();
  let isScrollable = $state(false);
  let hasMore = $state(false);

  function update(): void {
    if (!element || !isEnabled()) {
      isScrollable = false;
      hasMore = false;
      return;
    }

    isScrollable = element.scrollHeight > element.clientHeight + 1;
    hasMore = isScrollable && element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }

  $effect(() => {
    if (!isEnabled() || !element) return;

    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(element);

    if (element.firstElementChild) observer.observe(element.firstElementChild);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });

  return {
    get element() {
      return element;
    },
    set element(value) {
      element = value;
    },
    get isScrollable() {
      return isScrollable;
    },
    get hasMore() {
      return hasMore;
    },
    onScroll: update
  };
}
