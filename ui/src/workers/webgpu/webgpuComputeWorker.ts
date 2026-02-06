import type { ToWorker, FromWorker, DirectConnection } from '$lib/webgpu/types';
import { match } from 'ts-pattern';
import {
  createDirectChannelHandler,
  type DirectChannelHandler
} from '../shared/directChannelHandler';

interface NodeState {
  pipeline: GPUComputePipeline | null;
  buffers: Map<number, GPUBuffer>;
  inputData: Map<number, ArrayBuffer>;
  uniformData: Map<number, ArrayBuffer>;
  bindingAccessModes: Map<number, 'read' | 'read_write'>;
  uniformBindings: Set<number>;
  workgroupSize: [number, number, number];
  code: string;
  outputSize: number | null; // explicit output buffer size in elements (not bytes)
  dispatchCount: [number, number, number] | null; // explicit dispatch workgroup count
  directChannel: DirectChannelHandler;
}

let device: GPUDevice | null = null;
const nodeStates = new Map<string, NodeState>();

// Track last active node for uncaptured error reporting
let lastActiveNodeId: string | null = null;

// Pipeline cache keyed by shader code hash
const pipelineCache = new Map<string, GPUComputePipeline>();

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

function reply(message: FromWorker, transfer?: Transferable[]) {
  if (transfer) {
    self.postMessage(message, { transfer });
  } else {
    self.postMessage(message);
  }
}

function getOrCreateState(nodeId: string): NodeState {
  let state = nodeStates.get(nodeId);
  if (!state) {
    // Create direct channel handler for this node
    const directChannel = createDirectChannelHandler({
      nodeId,
      onIncomingMessage: (data, meta) => {
        // Handle incoming messages from other workers
        // For wgpu nodes, we could handle bang messages or buffer data
        if (data === 'bang') {
          handleDispatch(nodeId);
        }
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        reply({ type: 'error', nodeId, message });
      }
    });

    state = {
      pipeline: null,
      buffers: new Map(),
      inputData: new Map(),
      uniformData: new Map(),
      bindingAccessModes: new Map(),
      uniformBindings: new Set(),
      workgroupSize: [64, 1, 1],
      code: '',
      outputSize: null,
      dispatchCount: null,
      directChannel
    };

    nodeStates.set(nodeId, state);
  }
  return state;
}

async function handleInit() {
  try {
    if (!navigator.gpu) {
      reply({ type: 'ready', supported: false });
      return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      reply({ type: 'ready', supported: false });
      return;
    }

    device = await adapter.requestDevice();

    device.lost.then((info) => {
      console.error('WebGPU device lost:', info.message);
      device = null;
    });

    // Forward uncaptured errors to the last active node's virtual console
    device.onuncapturederror = (event) => {
      if (lastActiveNodeId) {
        reply({ type: 'error', nodeId: lastActiveNodeId, message: event.error.message });
      }
    };

    reply({ type: 'ready', supported: true });
  } catch {
    reply({ type: 'ready', supported: false });
  }
}

async function handleCompile(nodeId: string, code: string) {
  if (!device) {
    reply({ type: 'compiled', nodeId, error: 'WebGPU device not available' });
    return;
  }

  const state = getOrCreateState(nodeId);

  try {
    const hash = simpleHash(code);
    let pipeline = pipelineCache.get(hash);

    if (!pipeline) {
      // Push error scope to capture validation errors during pipeline creation
      device.pushErrorScope('validation');

      const shaderModule = device.createShaderModule({ code });

      // Check for compilation errors
      const info = await shaderModule.getCompilationInfo();
      const errors = info.messages.filter((m) => m.type === 'error');

      if (errors.length > 0) {
        await device.popErrorScope(); // Clear the error scope
        const errorText = errors.map((e) => `Line ${e.lineNum}: ${e.message}`).join('\n');
        reply({ type: 'compiled', nodeId, error: errorText });
        return;
      }

      pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' }
      });

      // Check for validation errors (e.g., workgroup size limits)
      const validationError = await device.popErrorScope();
      if (validationError) {
        reply({ type: 'compiled', nodeId, error: validationError.message });
        return;
      }

      pipelineCache.set(hash, pipeline);
    }

    state.pipeline = pipeline;
    state.code = code;

    // Parse binding access modes from code
    const bindingRegex = /@group\((\d+)\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>/g;
    state.bindingAccessModes.clear();
    state.uniformBindings.clear();
    let m;
    while ((m = bindingRegex.exec(code)) !== null) {
      state.bindingAccessModes.set(parseInt(m[2]), m[3] as 'read' | 'read_write');
    }

    // Parse uniform bindings
    const uniformRegex = /@group\((\d+)\)\s*@binding\((\d+)\)\s*var<uniform>/g;
    while ((m = uniformRegex.exec(code)) !== null) {
      state.uniformBindings.add(parseInt(m[2]));
    }

    // Parse workgroup size
    const wgMatch = /@workgroup_size\((\d+)(?:,\s*(\d+))?(?:,\s*(\d+))?\)/.exec(code);
    if (wgMatch) {
      state.workgroupSize = [
        parseInt(wgMatch[1]),
        parseInt(wgMatch[2] ?? '1'),
        parseInt(wgMatch[3] ?? '1')
      ];
    }

    reply({ type: 'compiled', nodeId });
  } catch (e) {
    reply({ type: 'compiled', nodeId, error: String(e) });
  }
}

function handleSetBuffer(nodeId: string, binding: number, data: ArrayBuffer) {
  const state = getOrCreateState(nodeId);
  state.inputData.set(binding, data);
}

function handleSetUniform(nodeId: string, binding: number, data: ArrayBuffer) {
  const state = getOrCreateState(nodeId);
  state.uniformData.set(binding, data);
}

function handleSetOutputSize(nodeId: string, size: number) {
  const state = getOrCreateState(nodeId);
  state.outputSize = size;
}

function handleSetDispatchCount(nodeId: string, count: [number, number, number]) {
  const state = getOrCreateState(nodeId);
  state.dispatchCount = count;
}

async function handleDispatch(nodeId: string, dispatchCount?: [number, number, number]) {
  if (!device) {
    reply({ type: 'error', nodeId, message: 'WebGPU device not available' });
    return;
  }

  const state = nodeStates.get(nodeId);
  if (!state?.pipeline) {
    reply({ type: 'error', nodeId, message: 'No compiled shader. Write WGSL code first.' });
    return;
  }

  try {
    // Destroy old GPU buffers
    for (const buf of state.buffers.values()) {
      buf.destroy();
    }
    state.buffers.clear();

    // Create GPU buffers from input data
    const entries: GPUBindGroupEntry[] = [];
    const outputBindings: number[] = [];
    let maxOutputSize = 0; // Track output size in elements

    // Create uniform buffers first
    for (const [bindingIdx, uniformData] of state.uniformData) {
      const size = Math.max(uniformData.byteLength, 16); // Minimum 16 bytes for uniform buffers
      const gpuBuffer = device.createBuffer({
        size,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });
      new Uint8Array(gpuBuffer.getMappedRange()).set(new Uint8Array(uniformData));
      gpuBuffer.unmap();

      state.buffers.set(bindingIdx, gpuBuffer);
      entries.push({ binding: bindingIdx, resource: { buffer: gpuBuffer } });
    }

    // Collect all storage bindings and sort them
    const allBindings = [...state.bindingAccessModes.entries()].sort(([a], [b]) => a - b);

    for (const [bindingIdx, accessMode] of allBindings) {
      const inputData = state.inputData.get(bindingIdx);
      const isOutput = accessMode === 'read_write';

      // Determine buffer size
      let size: number;
      if (inputData) {
        size = inputData.byteLength;
      } else if (isOutput) {
        // For outputs without input data, use explicit outputSize or infer from largest input
        if (state.outputSize !== null) {
          size = state.outputSize * 4; // outputSize is in elements, convert to bytes (assume f32)
        } else {
          const maxInputSize = Math.max(
            ...Array.from(state.inputData.values()).map((d) => d.byteLength),
            256
          );
          size = maxInputSize;
        }
      } else {
        // Read-only binding with no data - create empty buffer
        size = 256;
      }

      // Ensure minimum size and alignment
      size = Math.max(size, 4);

      const usage = isOutput
        ? GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        : GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;

      const gpuBuffer = device.createBuffer({ size, usage, mappedAtCreation: !!inputData });

      if (inputData) {
        new Uint8Array(gpuBuffer.getMappedRange()).set(new Uint8Array(inputData));
        gpuBuffer.unmap();
      }

      state.buffers.set(bindingIdx, gpuBuffer);
      entries.push({ binding: bindingIdx, resource: { buffer: gpuBuffer } });

      if (isOutput) {
        outputBindings.push(bindingIdx);
        maxOutputSize = Math.max(maxOutputSize, size / 4); // Track size in elements
      }
    }

    if (entries.length === 0) {
      reply({
        type: 'error',
        nodeId,
        message: 'No bindings found. Define storage bindings in your shader.'
      });
      return;
    }

    const bindGroup = device.createBindGroup({
      layout: state.pipeline.getBindGroupLayout(0),
      entries
    });

    // Calculate dispatch count: use param > stored state > auto-calculate
    const actualDispatch = dispatchCount ?? state.dispatchCount ?? calculateDispatchCount(state);

    // Push error scope to capture validation errors
    device.pushErrorScope('validation');

    // Run compute pass
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(state.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(actualDispatch[0], actualDispatch[1], actualDispatch[2]);
    passEncoder.end();

    // Create readback buffers for outputs
    const readbackBuffers = new Map<number, GPUBuffer>();
    for (const bindingIdx of outputBindings) {
      const srcBuffer = state.buffers.get(bindingIdx)!;
      const readback = device.createBuffer({
        size: srcBuffer.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
      commandEncoder.copyBufferToBuffer(srcBuffer, 0, readback, 0, srcBuffer.size);
      readbackBuffers.set(bindingIdx, readback);
    }

    device.queue.submit([commandEncoder.finish()]);

    // Check for validation errors
    const validationError = await device.popErrorScope();
    if (validationError) {
      reply({ type: 'error', nodeId, message: validationError.message });
      return;
    }

    // Read output data
    const outputs: Record<number, ArrayBuffer> = {};
    const transfers: Transferable[] = [];

    for (const [bindingIdx, readback] of readbackBuffers) {
      await readback.mapAsync(GPUMapMode.READ);
      const data = readback.getMappedRange();
      const copy = data.slice(0);
      readback.unmap();
      readback.destroy();
      outputs[bindingIdx] = copy;
      transfers.push(copy);

      // Send output via direct channels (as Float32Array for compatibility)
      // Use the binding number as the outlet index
      const typedArray = new Float32Array(copy);
      state.directChannel.sendToRenderTargets(typedArray, { to: bindingIdx });
      state.directChannel.sendToWorkerTargets(typedArray, { to: bindingIdx });
    }

    reply(
      { type: 'result', nodeId, outputs, actualDispatch, actualOutputSize: maxOutputSize },
      transfers
    );
  } catch (e) {
    reply({ type: 'error', nodeId, message: String(e) });
  }
}

function calculateDispatchCount(state: NodeState): [number, number, number] {
  const maxBytes = Math.max(...Array.from(state.inputData.values()).map((d) => d.byteLength), 256);
  const maxElements = maxBytes / 4; // assume f32 (4 bytes per element)
  const threadsPerWorkgroup =
    state.workgroupSize[0] * state.workgroupSize[1] * state.workgroupSize[2];
  const numWorkgroups = Math.ceil(maxElements / threadsPerWorkgroup);
  return [numWorkgroups, 1, 1];
}

function handleDestroy(nodeId: string) {
  const state = nodeStates.get(nodeId);
  if (state) {
    for (const buf of state.buffers.values()) {
      buf.destroy();
    }
    state.directChannel.cleanup();
    nodeStates.delete(nodeId);
  }
}

self.onmessage = async (event: MessageEvent<ToWorker>) => {
  const msg = event.data;

  // Track active node for uncaptured error reporting
  if ('nodeId' in msg) {
    lastActiveNodeId = msg.nodeId;
  }

  await match(msg)
    .with({ type: 'init' }, async () => {
      await handleInit();
    })
    .with({ type: 'compile' }, async ({ nodeId, code }) => {
      await handleCompile(nodeId, code);
    })
    .with({ type: 'setBuffer' }, ({ nodeId, binding, data }) => {
      handleSetBuffer(nodeId, binding, data);
    })
    .with({ type: 'setUniform' }, ({ nodeId, binding, data }) => {
      handleSetUniform(nodeId, binding, data);
    })
    .with({ type: 'setOutputSize' }, ({ nodeId, size }) => {
      handleSetOutputSize(nodeId, size);
    })
    .with({ type: 'setDispatchCount' }, ({ nodeId, count }) => {
      handleSetDispatchCount(nodeId, count);
    })
    .with({ type: 'dispatch' }, async ({ nodeId, dispatchCount }) => {
      await handleDispatch(nodeId, dispatchCount);
    })
    .with({ type: 'destroy' }, ({ nodeId }) => {
      handleDestroy(nodeId);
    })
    // Direct channel handlers
    .with({ type: 'setRenderPort' }, ({ nodeId }) => {
      const state = getOrCreateState(nodeId);
      state.directChannel.handleSetRenderPort(event.ports[0]);
    })
    .with({ type: 'setWorkerPort' }, ({ nodeId, targetNodeId, sourceNodeId }) => {
      const state = getOrCreateState(nodeId);
      state.directChannel.handleSetWorkerPort(event.ports[0], targetNodeId, sourceNodeId);
    })
    .with({ type: 'updateRenderConnections' }, ({ nodeId, connections }) => {
      const state = getOrCreateState(nodeId);
      state.directChannel.handleUpdateRenderConnections(connections);
    })
    .with({ type: 'updateWorkerConnections' }, ({ nodeId, connections }) => {
      const state = getOrCreateState(nodeId);
      state.directChannel.handleUpdateWorkerConnections(connections);
    })
    .otherwise(() => {});
};
