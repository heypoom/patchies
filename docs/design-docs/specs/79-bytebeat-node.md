# 79. Bytebeat Node

## Overview

Add a bytebeat synthesis node that uses the [bytebeat.js](https://www.npmjs.com/package/bytebeat.js) library. Bytebeat is a form of algorithmic music where simple mathematical expressions operating on a time counter `t` produce audio output.

## Requirements Summary

Based on design discussion:

- **Node style**: Visual node with CodeEditor (like js/hydra nodes)
- **Audio I/O**: Audio output + message inlet for programmatic control
- **Layout**: Compact (300x200) with expandable settings panel (PostItNode pattern)
- **Channels**: Mono only
- **Auto-start**: No - requires explicit play button

## Node Data Schema

```typescript
interface BytebeatNodeData {
  // Expression
  expression: string; // default: "((t >> 10) & 42) * t"

  // Playback state
  isPlaying: boolean; // default: false

  // Settings (persisted)
  type: "bytebeat" | "floatbeat" | "signedBytebeat"; // default: 'bytebeat'
  syntax: "infix" | "postfix" | "glitch" | "function"; // default: 'infix'
  sampleRate: 8000 | 11025 | 22050 | 32000 | 44100 | 48000; // default: 8000
}
```

## Audio V2 Node

Create `src/lib/audio/v2/nodes/BytebeatNode.ts`:

```typescript
import { ByteBeatNode } from "bytebeat.js";

export class BytebeatAudioNode implements AudioNodeV2 {
  static type = "bytebeat~";
  static group = "generators" as const;
  static description = "Bytebeat algorithmic synthesis";
  static tags = ["audio", "generator", "synthesis", "algorithmic"];

  static inlets: ObjectInlet[] = [
    {
      name: "control",
      type: "message",
      description: "Control messages",
      messages: [
        { schema: PlayMsg, description: "Start playback" },
        { schema: StopMsg, description: "Stop and reset t=0" },
        { schema: PauseMsg, description: "Pause playback (keep t)" },
        { schema: BangMsg, description: "Evaluate expression and play" },
        { schema: SetTypeMsg, description: "Set bytebeat type" },
        { schema: SetSyntaxMsg, description: "Set expression syntax" },
        { schema: SetSampleRateMsg, description: "Set sample rate" },
      ],
    },
  ];

  static outlets: ObjectOutlet[] = [
    { name: "out", type: "signal", description: "Audio output" },
  ];
}
```

## Message Protocol

Using TypeBox schemas:

```typescript
// Playback control (symbol messages)
export const PlayMsg = sym("play"); // Start/resume
export const StopMsg = sym("stop"); // Stop and reset t=0
export const PauseMsg = sym("pause"); // Pause (keep t position)
export const BangMsg = sym("bang"); // Evaluate expression and play

// Settings (object messages with type/value)
export const SetTypeMsg = msg("setType", {
  value: Type.Union([
    Type.Literal("bytebeat"),
    Type.Literal("floatbeat"),
    Type.Literal("signedBytebeat"),
  ]),
});
export const SetSyntaxMsg = msg("setSyntax", {
  value: Type.Union([
    Type.Literal("infix"),
    Type.Literal("postfix"),
    Type.Literal("glitch"),
    Type.Literal("function"),
  ]),
});
export const SetSampleRateMsg = msg("setSampleRate", { value: Type.Number() });
```

### Message Examples

```javascript
// Playback control
{ type: 'play' }
{ type: 'pause' }
{ type: 'stop' }
{ type: 'bang' }  // evaluate and play

// Settings
{ type: 'setType', value: 'floatbeat' }
{ type: 'setSyntax', value: 'postfix' }
{ type: 'setSampleRate', value: 11025 }
```

## Visual Node Component

Create `src/lib/components/nodes/BytebeatNode.svelte`:

### Layout

```
┌─────────────────────────────────────┐
│ [▶/⏸] [⏹] [⚙]          bytebeat~   │  <- Header bar
├─────────────────────────────────────┤
│                                     │
│  ((t >> 10) & 42) * t              │  <- CodeEditor
│                                     │
├─────────────────────────────────────┤
│ ○ out                               │  <- Audio outlet
└─────────────────────────────────────┘
         ↑
    message inlet (hidden, auto-positioned)
```

### Header Controls

- **Play/Pause button**: Toggle between ▶ and ⏸ icons
- **Stop button**: ⏹ - calls `ByteBeatNode.reset()`, sets `t=0`
- **Settings button**: ⚙ - toggles settings panel (appears to the right like PostItNode)

### Settings Panel

Appears to the right of the node when settings button is clicked:

```
┌──────────────────────┐
│ Type                 │
│ [Bytebeat ▼]         │
├──────────────────────┤
│ Syntax               │
│ [Infix ▼]            │
├──────────────────────┤
│ Sample Rate          │
│ [8000 ▼]             │
└──────────────────────┘
```

Each setting is a dropdown (`<select>`).

### Type Options

| Type            | ByteBeatNode constant              | Description                     |
| --------------- | ---------------------------------- | ------------------------------- |
| Bytebeat        | `ByteBeatNode.Type.byteBeat`       | Classic 8-bit output (0-255)    |
| Floatbeat       | `ByteBeatNode.Type.floatBeat`      | Floating point output (-1 to 1) |
| Signed Bytebeat | `ByteBeatNode.Type.signedByteBeat` | Signed 8-bit (-128 to 127)      |

### Syntax Options

| Syntax        | ByteBeatNode constant                  | Description              |
| ------------- | -------------------------------------- | ------------------------ |
| Infix         | `ByteBeatNode.ExpressionType.infix`    | Standard math notation   |
| Postfix (RPN) | `ByteBeatNode.ExpressionType.postfix`  | Reverse Polish notation  |
| Glitch        | `ByteBeatNode.ExpressionType.glitch`   | Glitch URL format        |
| Function      | `ByteBeatNode.ExpressionType.function` | JavaScript function body |

### Sample Rate Options

Standard rates: 8000, 11025, 22050, 32000, 44100, 48000

Lower rates = crunchier/lo-fi sound (classic bytebeat is 8000 Hz).

## ByteBeatNode Library API

Reference from [html5bytebeat](https://github.com/greggman/html5bytebeat):

### Setup & Construction

```typescript
await ByteBeatNode.setup(context);           // Required before instantiation
const node = new ByteBeatNode(context);      // Creates instance
```

### Enums (numeric values)

```typescript
// Type - accessed via ByteBeatNode.Type.*
ByteBeatNode.Type.byteBeat        // 0-255 output
ByteBeatNode.Type.floatBeat       // -1.0 to +1.0 output
ByteBeatNode.Type.signedByteBeat  // -128 to 127 output

// ExpressionType - accessed via ByteBeatNode.ExpressionType.*
ByteBeatNode.ExpressionType.infix     // Standard: sin(t / 50)
ByteBeatNode.ExpressionType.postfix   // RPN: t 50 / sin
ByteBeatNode.ExpressionType.glitch    // Glitch machine format
ByteBeatNode.ExpressionType.function  // Function body
```

### Methods

```typescript
// Configuration
node.setType(ByteBeatNode.Type.byteBeat);
node.setExpressionType(ByteBeatNode.ExpressionType.infix);
node.setDesiredSampleRate(8000);

// Expression (async!)
await node.setExpressions(['((t >> 10) & 42) * t']);

// Playback
node.reset();           // Reset t to 0
node.isRunning();       // Check if generating audio

// Connection (extends AudioWorkletNode)
node.connect(destination);
node.disconnect();
```

**Important**: The library has no explicit `play()`/`pause()` methods. Playback is always on when connected.

## Implementation Details

### Library Integration

```typescript
import { ByteBeatNode } from 'bytebeat.js';

// In AudioV2 node create():
async create(context: AudioContext) {
  await ByteBeatNode.setup(context);
  this.byteBeatNode = new ByteBeatNode(context);

  // GainNode for play/pause control (library has no pause)
  this.gainNode = context.createGain();
  this.gainNode.gain.value = 0;  // Start paused
  this.byteBeatNode.connect(this.gainNode);

  // Apply initial settings from node data
  this.applySettings(nodeData);

  return this.gainNode;  // Return gain node as output
}
```

### Play/Pause Implementation

Since ByteBeatNode has no pause method, we control playback via a GainNode:

```typescript
play() {
  this.gainNode.gain.value = 1;
  this.isPlaying = true;
}

pause() {
  this.gainNode.gain.value = 0;
  this.isPlaying = false;
}

stop() {
  this.gainNode.gain.value = 0;
  this.byteBeatNode.reset();  // Reset t to 0
  this.isPlaying = false;
}
```

### Expression Updates

When the expression changes in the CodeEditor:

1. Call `await byteBeatNode.setExpressions([expression])` (async!)
2. The library validates internally - catch errors for invalid expressions
3. Show error indicator if invalid (red border on editor?)

### Type/Syntax Mapping

Map our string values to library enums:

```typescript
const TYPE_MAP = {
  'bytebeat': ByteBeatNode.Type.byteBeat,
  'floatbeat': ByteBeatNode.Type.floatBeat,
  'signedBytebeat': ByteBeatNode.Type.signedByteBeat,
};

const SYNTAX_MAP = {
  'infix': ByteBeatNode.ExpressionType.infix,
  'postfix': ByteBeatNode.ExpressionType.postfix,
  'glitch': ByteBeatNode.ExpressionType.glitch,
  'function': ByteBeatNode.ExpressionType.function,
};
```

### Connection to Audio Graph

The ByteBeatNode extends AudioWorkletNode. We wrap it with a GainNode for volume control:

```text
ByteBeatNode → GainNode → destination
```

## Undo/Redo Support

Following the pattern from CLAUDE.md:

```typescript
const tracker = useNodeDataTracker(node.id);

// CodeEditor handles expression undo via codeCommit event
<CodeEditor value={expression} nodeId={node.id} dataKey="expression" />

// Discrete settings changes
function handleTypeChange(newType: string) {
  const oldType = type;
  updateNodeData(node.id, { type: newType });
  tracker.commit('type', oldType, newType);
}
```

## Files to Create/Modify

### New Files

1. `src/lib/audio/v2/nodes/BytebeatNode.ts` - Audio V2 node
2. `src/lib/components/nodes/BytebeatNode.svelte` - Visual component
3. `static/content/objects/bytebeat~.md` - Documentation

### Modifications

1. `src/lib/audio/v2/nodes/index.ts` - Register node
2. `src/lib/nodes/node-types.ts` - Add visual node type
3. `src/lib/nodes/defaultNodeData.ts` - Default data
4. `src/lib/components/object-browser/get-categorized-objects.ts` - Add to browser
5. `src/lib/extensions/object-packs.ts` - Add to Audio pack
6. `src/lib/ai/object-descriptions-types.ts` - Add to AI types
7. `src/lib/ai/object-prompts/` - Add prompt file
8. `package.json` - Add `bytebeat.js` dependency

## Default Expression Examples

Good defaults and examples for documentation:

```javascript
// Classic bytebeat
((t >> 10) & 42) * t

// Sierpinski harmony
t & t >> 8

// 8-bit melody
(t * 5 & t >> 7) | (t * 3 & t >> 10)

// Floatbeat sine
Math.sin(t / 10) * 0.5
```

## Edge Cases

1. **AudioContext not started**: Show "Click to start audio" overlay if context is suspended
2. **Invalid expression**: Show error state, don't crash, keep previous valid expression
3. **Node deletion**: Properly disconnect and cleanup ByteBeatNode instance
4. **Settings change while playing**: Apply changes without stopping playback

## Testing Considerations

- Unit tests for message handling
- Visual tests for settings panel
- Integration test: create node, set expression, verify audio output exists
