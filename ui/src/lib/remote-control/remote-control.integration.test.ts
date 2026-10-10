import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from '@xyflow/svelte';
import { CanvasContext } from '$lib/services/CanvasContext';
import { AddNodeCommand, HistoryManager, type CanvasStateAccessors } from '$lib/history';
import { VirtualFilesystem } from '$lib/vfs/VirtualFilesystem';
import { RemoteControlGraphService } from './graph-service';
import { RemoteControlSyncCoordinator } from './sync-coordinator';

const relayBinary = process.env.PATCHIES_TEST_RELAY;
const cliBinary = process.env.PATCHIES_TEST_CLI;

async function until(check: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (await check()) return;

    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  throw new Error('Remote Control integration condition did not settle');
}

async function stop(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  const exited = once(child, 'exit');
  child.kill(signal);

  await exited;
}

// This runs the real browser coordinator and history against the production Go
// relay and CLI. Rendered Svelte handle measurement still needs a browser test.
describe.skipIf(!relayBinary || !cliBinary)('coordinator → relay → CLI recovery', () => {
  it.each([1, 2, 3, 4, 5])(
    'keeps graph/history and alternating file edits working across CLI restart and browser reclaim (%i)',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'patchies-integration-'));
      const relay = spawn(relayBinary!, [], { stdio: ['ignore', 'pipe', 'pipe'] });

      let origin = '';

      relay.stdout!.on('data', (data) => {
        origin += String(data);
      });

      await until(() => origin.includes('\n'));
      origin = origin.trim();

      const storage = new Map<string, string>();
      vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key)
      });

      VirtualFilesystem.resetInstance();
      const vfs = VirtualFilesystem.getInstance();

      let nodes: Node[] = [
        { id: 'js-1', type: 'js', position: { x: 0, y: 0 }, data: { code: 'first' } }
      ];

      let edges: Edge[] = [];

      const history = new HistoryManager();
      let coordinator: RemoteControlSyncCoordinator;

      const accessors: CanvasStateAccessors = {
        getNodes: () => nodes,
        setNodes: (value) => {
          nodes = value;
          vfs.objectFiles.sync(nodes);
          coordinator?.notifyPatchChanged();
        },
        getEdges: () => edges,
        setEdges: (value) => {
          edges = value;
          coordinator?.notifyPatchChanged();
        }
      };

      const context = new CanvasContext(
        { get: accessors.getNodes, set: accessors.setNodes },
        { get: accessors.getEdges, set: accessors.setEdges },
        history
      );

      context.setNodeIdCounterFromNodes(nodes);

      const graph = new RemoteControlGraphService({
        accessors,
        history,
        ports: (node) => ({
          ready: true,
          inlets: [{ id: 'message-in', kind: 'message' }],
          outlets: [{ id: node.type === 'js' ? 'out-0' : 'message-out', kind: 'message' }]
        }),
        settle: async () => {},
        create: (command) => {
          const id = context.nextNodeId(command.name);
          history.execute(
            new AddNodeCommand(
              {
                id,
                type: command.name,
                position: command.position ?? { x: 0, y: 0 },
                data: command.data ?? {}
              },
              accessors
            )
          );
          return id;
        }
      });

      vfs.objectFiles.connect(
        (file, content) => {
          accessors.setNodes(
            nodes.map((node) =>
              node.id === file.objectId
                ? { ...node, data: { ...node.data, [file.dataKey]: content } }
                : node
            )
          );
        },
        async () => {}
      );

      vfs.objectFiles.sync(nodes);

      const createCoordinator = () =>
        new RemoteControlSyncCoordinator({
          patchId: () => 'integration-patch',
          filesystem: vfs,
          graph,
          instanceURL: origin
        });

      coordinator = createCoordinator();

      let mount: ChildProcess | undefined;
      let diagnostics = '';
      let phase = 'mount';

      const launchMount = (resume: boolean) => {
        const token = coordinator.mountCommand!.match(/--token (\S+)/)![1];

        const child = spawn(
          cliBinary!,
          ['mount', '--path', root, '--token-fd', '0', ...(resume ? ['--resume'] : [])],
          { stdio: ['pipe', 'ignore', 'pipe'] }
        );

        child.stderr!.on('data', (data) => {
          diagnostics += String(data);
        });

        child.stdin!.end(token);

        return child;
      };

      const command = async (args: string[]) => {
        const child = spawn(cliBinary!, [...args, '--path', root, '--json'], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let result = '';

        child.stdout!.on('data', (data) => {
          result += String(data);
        });

        const [code] = await once(child, 'exit');
        expect(code, result).toBe(0);

        return JSON.parse(result);
      };

      const codePath = join(root, 'objects/js-1/code.js');

      const fileEquals = async (path: string, expected: string) => {
        try {
          return (await readFile(path, 'utf8')) === expected;
        } catch {
          return false;
        }
      };

      try {
        await coordinator.enable();

        mount = launchMount(false);
        await until(() => fileEquals(codePath, 'first'));

        phase = 'first local save';
        await writeFile(codePath, 'local-1');
        await until(() => nodes[0].data.code === 'local-1');

        phase = 'first browser save';
        vfs.writeCodeFile('obj://js-1/code.js', 'browser-1');
        await until(() => fileEquals(codePath, 'browser-1'));

        phase = 'graph commands';
        const created = await command(['node', 'create', 'button']);
        const nodeId = created.result.id;
        expect(nodeId).toBe('button-2');
        expect(nodes.some((node) => node.id === nodeId)).toBe(true);

        await command(['wire', 'connect', 'js-1:out-0', `${nodeId}:message-in`]);
        expect(edges).toMatchObject([
          { source: 'js-1', sourceHandle: 'out-0', target: nodeId, targetHandle: 'message-in' }
        ]);

        await writeFile(join(root, 'connections.txt'), '');
        await until(() => edges.length === 0);
        history.undo();

        await until(async () =>
          (await readFile(join(root, 'connections.txt'), 'utf8')).includes(nodeId)
        );
        await command(['node', 'delete', nodeId]);
        expect(edges).toEqual([]);
        history.undo();

        await until(() => edges.length === 1);
        const queried = await command(['graph']);
        expect(queried.result.edges[0].target).toBe(nodeId);

        phase = 'offline restart';
        await stop(mount, 'SIGKILL');
        await writeFile(codePath, 'offline');

        vfs.writeCodeFile('obj://js-1/code.js', 'browser-while-offline');
        mount = launchMount(true);
        await until(() => nodes[0].data.code === 'offline');
        await until(() => fileEquals(codePath, 'offline'));

        phase = 'browser reclaim';
        coordinator.dispose();
        coordinator = createCoordinator();
        expect(await coordinator.restore()).toBe(true);

        phase = 'local save during reclaim';
        await writeFile(codePath, 'after-reload');
        await until(() => nodes[0].data.code === 'after-reload');

        phase = 'browser save after reclaim';
        vfs.writeCodeFile('obj://js-1/code.js', 'browser-after-reload');

        await until(() => fileEquals(codePath, 'browser-after-reload'));
        expect(diagnostics).not.toContain('invalid mount namespace');
      } catch (error) {
        throw new Error(
          `${phase}: ${error instanceof Error ? error.message : error}\nCLI diagnostics:\n${diagnostics}`
        );
      } finally {
        coordinator.dispose();

        if (mount) {
          await stop(mount);
        }

        await stop(relay);

        vi.unstubAllGlobals();
        await rm(root, { recursive: true, force: true });
      }
    },
    60_000
  );
});
