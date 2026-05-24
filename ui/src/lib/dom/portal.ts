import type { Action } from 'svelte/action';

export const portal: Action<HTMLElement, HTMLElement | null | undefined> = (node, target) => {
  const parent = node.parentNode;
  const marker = document.createComment('portal');

  parent?.insertBefore(marker, node);

  function move(nextTarget: HTMLElement | null | undefined) {
    if (nextTarget) {
      nextTarget.appendChild(node);
    } else {
      marker.parentNode?.insertBefore(node, marker);
    }
  }

  move(target);

  return {
    update(nextTarget) {
      move(nextTarget);
    },
    destroy() {
      marker.parentNode?.insertBefore(node, marker);
      marker.remove();
    }
  };
};
