import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';
import { BufferBridgeService } from '$lib/audio/buffer-bridge';

/** Set a sample value at index */
const TableSet = msg('set', { index: Type.Number(), value: Type.Number() });

/** Get a sample value at index */
const TableGet = msg('get', { index: Type.Number() });

/** Resize the buffer */
const TableResize = msg('resize', { length: Type.Number() });

/** Clear the buffer */
const TableClear = sym('clear');

/** Normalize the buffer to -1..1 range */
const TableNormalize = sym('normalize');

const tableMessages = {
  set: schema(TableSet),
  get: schema(TableGet),
  resize: schema(TableResize),
  clear: schema(TableClear),
  normalize: schema(TableNormalize)
};

/**
 * TableObject creates and manages a named audio buffer.
 *
 * Creation: [table name size]
 * - name: buffer name (shared across tabwrite~/tabread~ with same name)
 * - size: buffer length in samples (default 512)
 */
export class TableObject implements TextObjectV2 {
  static type = 'table';
  static description = 'Named audio buffer for tabwrite~/tabread~';

  static inlets: ObjectInlet[] = [
    {
      name: 'command',
      type: 'message',
      description: 'Buffer commands',
      messages: [
        { schema: TableSet, description: 'Set sample at index' },
        { schema: TableGet, description: 'Get sample at index' },
        { schema: TableResize, description: 'Resize buffer' },
        { schema: TableClear, description: 'Clear buffer (fill with zeros)' },
        { schema: TableNormalize, description: 'Normalize buffer to -1..1' }
      ]
    },
    {
      name: 'name',
      type: 'string',
      description: 'Buffer name',
      hideInlet: true
    },
    {
      name: 'size',
      type: 'int',
      description: 'Buffer size in samples',
      defaultValue: 512,
      minNumber: 1,
      hideInlet: true
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'result',
      type: 'message',
      description: 'Response to get commands'
    }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private bufferName = '';
  private bufferSize = 512;
  private bridge: BufferBridgeService;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
    this.bridge = BufferBridgeService.getInstance();
  }

  create(): void {
    const name = this.context.getParam('name');
    const size = this.context.getParam('size');

    this.bufferName = typeof name === 'string' && name.length > 0 ? name : this.nodeId;
    this.bufferSize = typeof size === 'number' && size > 0 ? Math.round(size) : 512;

    this.bridge.createBuffer(this.bufferName, this.bufferSize);
  }

  destroy(): void {
    if (this.bufferName) {
      this.bridge.deleteBuffer(this.bufferName);
    }
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match(meta.inletName)
      .with('command', () => this.handleCommand(data))
      .otherwise(() => {});
  }

  private handleCommand(data: unknown): void {
    match(data)
      .with(tableMessages.set, ({ index, value }) => {
        this.bridge.setBufferSample(this.bufferName, index, value);
      })
      .with(tableMessages.get, ({ index }) => {
        this.bridge.readBufferAsync(this.bufferName).then((buf) => {
          if (!buf) return;
          const len = this.bufferSize;
          const wrapped = ((index % len) + len) % len;
          this.context.send({ type: 'get', index, value: buf[wrapped] });
        });
      })
      .with(tableMessages.resize, ({ length }) => {
        if (length > 0) {
          this.bufferSize = Math.round(length);
          this.bridge.resizeBuffer(this.bufferName, this.bufferSize);
        }
      })
      .with(tableMessages.clear, () => {
        this.bridge.clearBuffer(this.bufferName);
      })
      .with(tableMessages.normalize, () => {
        this.bridge.readBufferAsync(this.bufferName).then((buf) => {
          if (!buf) return;

          let maxAbs = 0;
          for (let i = 0; i < buf.length; i++) {
            const abs = Math.abs(buf[i]);
            if (abs > maxAbs) maxAbs = abs;
          }

          if (maxAbs > 0) {
            const scale = 1 / maxAbs;
            for (let i = 0; i < buf.length; i++) {
              this.bridge.setBufferSample(this.bufferName, i, buf[i] * scale);
            }
          }
        });
      })
      .otherwise(() => {});
  }
}
