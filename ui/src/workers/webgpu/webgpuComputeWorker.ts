import type { ToWorker, FromWorker } from '$lib/webgpu/types';

interface NodeState {
  pipeline: GPUComputePipeline | null;
  buffers: Map<number, GPUBuffer>;
  inputData: Map<number, ArrayBuffer>;
  bindingAccessModes: Map<number, 'read' | 'read_write'>;
  workgroupSize: [number, number, number];
  code: string;
}

let device: GPUDevice | null = null;
const nodeStates = new Map<string, NodeState>();

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
    state = {
      pipeline: null,
      buffers: new Map(),
      inputData: new Map(),
      bindingAccessModes: new Map(),
      workgroupSize: [64, 1, 1],
      code: ''
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
      const shaderModule = device.createShaderModule({ code });

      // Check for compilation errors
      const info = await shaderModule.getCompilationInfo();
      const errors = info.messages.filter((m) => m.type === 'error');

      if (errors.length > 0) {
        const errorText = errors.map((e) => `Line ${e.lineNum}: ${e.message}`).join('\n');
        reply({ type: 'compiled', nodeId, error: errorText });
        return;
      }

      pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' }
      });

      pipelineCache.set(hash, pipeline);
    }

    state.pipeline = pipeline;
    state.code = code;

    // Parse binding access modes from code
    const bindingRegex = /@group\((\d+)\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>/g;
    state.bindingAccessModes.clear();
    let m;
    while ((m = bindingRegex.exec(code)) !== null) {
      state.bindingAccessModes.set(parseInt(m[2]), m[3] as 'read' | 'read_write');
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

    // Collect all bindings and sort them
    const allBindings = [...state.bindingAccessModes.entries()].sort(([a], [b]) => a - b);

    for (const [bindingIdx, accessMode] of allBindings) {
      const inputData = state.inputData.get(bindingIdx);
      const isOutput = accessMode === 'read_write';

      // Determine buffer size
      let size: number;
      if (inputData) {
        size = inputData.byteLength;
      } else if (isOutput) {
        // For outputs without input data, infer size from the largest input
        const maxInputSize = Math.max(
          ...Array.from(state.inputData.values()).map((d) => d.byteLength),
          256
        );
        size = maxInputSize;
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

    // Calculate dispatch count if not provided
    const actualDispatch = dispatchCount ?? calculateDispatchCount(state);

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
    }

    reply({ type: 'result', nodeId, outputs }, transfers);
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
    nodeStates.delete(nodeId);
  }
}

self.onmessage = async (event: MessageEvent<ToWorker>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      await handleInit();
      break;
    case 'compile':
      await handleCompile(msg.nodeId, msg.code);
      break;
    case 'setBuffer':
      handleSetBuffer(msg.nodeId, msg.binding, msg.data);
      break;
    case 'dispatch':
      await handleDispatch(msg.nodeId, msg.dispatchCount);
      break;
    case 'destroy':
      handleDestroy(msg.nodeId);
      break;
  }
};
