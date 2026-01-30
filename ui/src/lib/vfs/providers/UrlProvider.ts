// URL Provider - resolves files from URLs

import type { VFSEntry, VFSProvider } from '../types';

/**
 * Provider that fetches files from URLs.
 * URLs are stored in the VFSEntry and fetched on demand.
 */
export class UrlProvider implements VFSProvider {
  readonly type = 'url' as const;

  async resolve(entry: VFSEntry, _path: string): Promise<File | Blob> {
    if (!entry.url) {
      throw new Error('UrlProvider: Entry has no URL');
    }

    const response = await fetch(entry.url);
    if (!response.ok) {
      throw new Error(`UrlProvider: Failed to fetch ${entry.url}: ${response.status}`);
    }

    const blob = await response.blob();

    // Return as File if we have filename info
    if (entry.filename) {
      return new File([blob], entry.filename, {
        type: entry.mimeType || blob.type
      });
    }

    return blob;
  }
}
