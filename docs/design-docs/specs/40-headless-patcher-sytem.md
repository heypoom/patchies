# 40. Headless Patcher System

## Goal

We'll gradually migrate the patcher system to a headless architecture. The goal is to:

1. Separate the patcher logic from the user interface. This allows us to implement features such as nested patches and abstractions.
2. Run the patch in a headless mode with no user interface.

## Patcher Class

We should have an internal `Patcher` class that allows:

1. Registering new nodes.
2. Integrating with existing systems (e.g. `GLSystem`, `AudioSystem`, `AudioAnalysisSystem`)
3. Managing lifecycles of nodes.

## Node Lifecycle

For strictly visual-related things, we will continue to use Svelte's `onMount` and `onDestroy` for lifecycle management. For example, registering a bitmap renderer to display the preview.

In the context of sub-patching, the `onMount` and `onDestroy` handlers are only visible if that node is visually visible on screen. It won't be called if the node is inside a sub-patch that is not currently open.

For other tasks, we will instead create classes to manage lifecycles.

## Classes for Nodes

In order to represent the nodes in a headless system, we will create a base class called `PatcherNode`. This class will provide the following features:

Example: how to implement `HydraNode.svelte`'s headless logic.

```ts
class HydraNode extends PatcherNode {
  // messaging should be automatically injected into every patcher node.
  // they're auto-hooked into PatcherNode's onMessage.
  messageContext: MessageContext

  // grab singleton instances of systems
  glSystem = GLSystem.getInstance()
  audioAnalysisSystem = AudioAnalysisSystem.getInstance()

  onCreate() {}

  onDestroy() {}

  onMessage(message) {
    const handleMessage: MessageCallbackFn = (message, meta) => {
      try {
        match(message)
          .with({type: 'set', code: P.string}, ({code}) => {
            this.updateNodeData({code})
            setTimeout(() => this.updateHydra())
          })
          .with({type: 'run'}, () => {
            this.updateHydra()
          })
          .otherwise(() => {
            glSystem.sendMessageToNode(nodeId, {...meta, data: message})
          })
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error)
      }
    }
  }

  private updateHydra() {
    try {
      this.messageContext.clearTimers()
      this.audioAnalysisSystem.disableFFT(nodeId)

      const isUpdated = this.glSystem.upsertNode(nodeId, 'hydra', {code})

      // If the code hasn't changed, the code will not be re-run.
      // This allows us to forcibly re-run hydra to update FFT.
      if (!isUpdated) this.glSystem.send('updateHydra', {nodeId})

      this.updateNodeData({errorMessage: null})
    } catch (error) {
      this.updateNodeData({
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
```
