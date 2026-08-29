import type { WorkerSettingsProxy } from '../shared/workerSettingsProxy';

/** Routes settings responses to the renderer instance that requested them. */
export class WorkerSettingsRegistry {
  private proxiesByNode = new Map<string, WorkerSettingsProxy>();

  register(nodeId: string, proxy: WorkerSettingsProxy): void {
    this.proxiesByNode.set(nodeId, proxy);
  }

  unregister(nodeId: string, proxy: WorkerSettingsProxy): void {
    if (this.proxiesByNode.get(nodeId) === proxy) {
      this.proxiesByNode.delete(nodeId);
    }
  }

  receiveValues(nodeId: string, requestId: string, values: Record<string, unknown>): void {
    this.proxiesByNode.get(nodeId)?._receiveValuesInit(requestId, values);
  }

  receiveValueChanged(nodeId: string, key: string, value: unknown): void {
    this.proxiesByNode.get(nodeId)?._receiveValueChanged(key, value);
  }
}
