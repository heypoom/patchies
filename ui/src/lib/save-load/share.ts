import type { Node, Edge } from '@xyflow/svelte';
import { toast } from 'svelte-sonner';
import { appHostUrl, createShareablePatch } from '$lib/api/pb';
import { getSearchParam } from '$lib/utils/search-params';

/**
 * Copies text to clipboard with a fallback for iOS Safari,
 * which requires a synchronous user gesture and doesn't always support
 * the async Clipboard API.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  // Try the modern async Clipboard API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);

      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  // Fallback: create a temporary textarea and use execCommand('copy')
  // This works in iOS Safari where the Clipboard API may be unavailable
  // or restricted outside of user gesture handlers.
  const textarea = document.createElement('textarea');
  textarea.value = text;

  // Keep it off-screen but visible enough for iOS to allow selection
  textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  // iOS requires setSelectionRange after select()
  textarea.setSelectionRange(0, text.length);

  const success = document.execCommand('copy');
  document.body.removeChild(textarea);

  return success;
}

/**
 * Creates a shareable link for the patch and copies it to clipboard.
 * Shows toast notifications for loading, success, and error states.
 */
export async function createAndCopyShareLink(nodes: Node[], edges: Edge[]): Promise<void> {
  toast.loading('Creating shareable link...');

  const id = await createShareablePatch(null, nodes, edges);

  if (id === null) {
    toast.error('Failed to create shareable link');
    return;
  }

  const room = getSearchParam('room');
  const url = room ? `${appHostUrl}/?id=${id}&room=${room}` : `${appHostUrl}/?id=${id}`;

  if (await copyToClipboard(url)) {
    toast.success('Shareable link copied to clipboard');
  } else {
    toast.error('Failed to copy link to clipboard');
  }
}
