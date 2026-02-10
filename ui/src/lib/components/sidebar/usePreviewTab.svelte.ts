import type { SidebarView } from '../../../stores/ui.store';

interface PreviewTabOptions {
  getView: () => SidebarView;
  setView: (view: SidebarView) => void;
  getHasPreview: () => boolean;
}

/**
 * Composable for managing the preview tab's promotion state in the sidebar.
 *
 * The preview tab can be "promoted" to the top row when:
 * - There's an actual preview (auto-promoted)
 * - User explicitly clicks "Patch to App" from the expanded section
 *
 * It gets demoted when:
 * - User clicks another base tab (and there's no actual preview)
 * - The preview is cleared while viewing it
 */
export function usePreviewTab(options: PreviewTabOptions) {
  const { getView, setView, getHasPreview } = options;

  let isPromoted = $state(false);
  let hadPreview = $state(false);

  // Auto-promote when there's a preview and view is preview
  $effect(() => {
    if (getHasPreview() && getView() === 'preview') {
      isPromoted = true;
    }
  });

  // Track preview state to detect when it's cleared
  $effect(() => {
    if (getHasPreview()) {
      hadPreview = true;
    } else if (hadPreview && getView() === 'preview') {
      // Preview was just cleared while viewing it - demote and switch view
      isPromoted = false;
      setView('files');
      hadPreview = false;
    }
  });

  /**
   * Handle clicking a base view tab.
   * Demotes preview if clicking away (unless there's an actual preview).
   */
  function handleBaseViewClick(viewId: SidebarView) {
    setView(viewId);
    // Demote preview when clicking a base tab (unless there's an actual preview)
    if (isPromoted && viewId !== 'preview' && !getHasPreview()) {
      isPromoted = false;
    }
  }

  /**
   * Handle clicking an item in the expandable section.
   * Promotes the preview tab and selects it.
   */
  function handleExpandableItemClick() {
    // Normal tab focus behavior: promote to top row and select
    isPromoted = true;
    setView('preview');
  }

  /**
   * Handle clicking the promoted preview icon.
   * Just selects the preview view.
   */
  function handlePromotedClick() {
    setView('preview');
  }

  return {
    get isPromoted() {
      return isPromoted;
    },
    handleBaseViewClick,
    handleExpandableItemClick,
    handlePromotedClick
  };
}
