import { capturePreviewFrame, bitmapToBase64Image } from '$lib/ai/google';
import type { WorkerMessage } from './WorkerNodeSystem';

/**
 * Proxies llm() calls from worker threads to the main-thread AI provider.
 * Manages per-request AbortControllers so in-flight requests can be cancelled
 * when a node is destroyed.
 */
export class WorkerLLMProxy {
  private abortControllers = new Map<string, AbortController>(); // requestId -> controller
  private requestsByNode = new Map<string, Set<string>>(); // nodeId -> Set<requestId>

  async handle(
    nodeId: string,
    worker: Worker,
    requestId: string,
    prompt: string,
    imageNodeId?: string,
    model?: string
  ): Promise<void> {
    const abortController = new AbortController();

    this.abortControllers.set(requestId, abortController);

    if (!this.requestsByNode.has(nodeId)) {
      this.requestsByNode.set(nodeId, new Set());
    }

    this.requestsByNode.get(nodeId)!.add(requestId);

    try {
      const { getTextProvider } = await import('$lib/ai/providers');

      const provider = getTextProvider(model);

      const images: { mimeType: string; data: string }[] = [];

      if (imageNodeId) {
        const bitmap = await capturePreviewFrame(imageNodeId);

        if (bitmap) {
          const data = bitmapToBase64Image({
            bitmap,
            format: 'image/jpeg',
            quality: 0.7
          });

          images.push({ mimeType: 'image/jpeg', data });
        }
      }

      const text = await provider.generateText(
        [
          {
            role: 'user',
            content: prompt,
            images
          }
        ],
        {
          signal: abortController.signal
        }
      );

      worker.postMessage({
        type: 'llmConfig',
        nodeId,
        requestId,
        text
      } satisfies WorkerMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      worker.postMessage({
        type: 'llmConfig',
        nodeId,
        requestId,
        error: errorMessage
      } satisfies WorkerMessage);
    } finally {
      this.abortControllers.delete(requestId);

      this.requestsByNode.get(nodeId)?.delete(requestId);
    }
  }

  /** Abort all in-flight requests for a node (call on destroy). */
  abortNode(nodeId: string): void {
    const pending = this.requestsByNode.get(nodeId);
    if (!pending) return;

    for (const requestId of pending) {
      this.abortControllers.get(requestId)?.abort();
      this.abortControllers.delete(requestId);
    }

    this.requestsByNode.delete(nodeId);
  }
}
