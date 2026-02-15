# 73. Object Field Shorthands

## Motivation

Typing `{type: 'set', value: 1}` in a message box is verbose. Max/MSP lets users type `set 1` — the object receiving the message knows how to map positional arguments to fields based on its schema. Patchies already has TypeBox schemas for every message type. We can use them to resolve shorthands at send time.

## Pain Points

```text
{type: 'set', value: 1}            ← current, verbose
{type: 'setCode', value: "code"}   ← even worse for strings with spaces
{type: 'get', key: 'foo'}          ← common kv pattern
```

## Proposed Syntax

### Unnamed (positional) shorthands

The first space-separated token is the `type` discriminator. Remaining tokens map to fields in schema-defined order:

```text
set 1                → {type: 'set', value: 1}
setCode console.log  → {type: 'setCode', value: "console.log"}
get foo              → {type: 'get', key: 'foo'}
set foo 42           → {type: 'set', key: 'foo', value: 42}
```

For messages with a single non-type field (like `set` with `value`), this is unambiguous — the second token IS the value.

For messages with multiple non-type fields, the schema defines a canonical field order:

```text
# KVSet schema: msg('set', { key: Type.String(), value: Type.Any() })
# Field order: key, value (as declared in the msg() call)

set foo 42   → {type: 'set', key: 'foo', value: 42}
```

### Named (explicit) shorthands

Use `field=value` syntax for explicit field assignment:

```text
set value=1                → {type: 'set', value: 1}
set key=foo value=42       → {type: 'set', key: 'foo', value: 42}
setCode value="hello"      → {type: 'setCode', value: "hello"}
```

Named and positional can mix — named arguments override positional ones:

```text
set foo value=42           → {type: 'set', key: 'foo', value: 42}
```

### Complex field values

Field values are parsed with the same JSON5 rules as regular message tokens:

```text
trigger values={start: 0, peak: 1} attack={time: 0.02} decay={time: 0.1}

→ {type: 'trigger', values: {start: 0, peak: 1, sustain: 0.7}, attack: {time: 0.02}, decay: {time: 0.1}}
```

Quoted strings preserve spaces:

```text
setCode value="console.log('hello world')"
→ {type: 'setCode', value: "console.log('hello world')"}
```

### Interaction with existing syntax

Shorthand resolution is a **new step** in the `sendMessage()` pipeline, inserted between space-splitting and the bare-string fallback:

```
1. Split by commas → sequential messages
2. Per segment: substitute $1-$9 placeholders
3. Try JSON5 parse → send as-is
4. Split by top-level spaces
5. NEW: If first token matches a known message type → resolve shorthand
6. If multiple tokens (no schema match) → send as array (existing behavior)
7. Single bare string → {type: string} (existing behavior)
```

Step 5 takes priority over step 6. If the first token is a recognized message type name (e.g., `set`, `get`, `bang`, `setCode`), it's treated as a shorthand. Otherwise, the existing space-separated array behavior applies.

## Schema Field Order

### Current state

The `msg()` helper already preserves field order through JavaScript object key ordering:

```typescript
msg('set', { key: Type.String(), value: Type.Any() })
// Properties: type, key, value → canonical order: [key, value]
```

### Extracting field order

Field order can be extracted from TypeBox schemas at runtime:

```typescript
function getFieldOrder(schema: TObject): string[] {
  return Object.keys(schema.properties).filter(k => k !== 'type');
}

// msg('set', { key: Type.String(), value: Type.Any() })
// → ['key', 'value']
```

No new metadata is needed — the existing `msg()` declaration order IS the canonical order.

### Where schemas live

Message schemas are defined in two places:

1. **V2 node classes** — e.g., `KVObject.ts` exports `KVSet = msg('set', { key, value })`
2. **Manual schema files** — e.g., `schemas/msg.ts` exports `SetValue = msg('set', { value })`

Both already use `msg()` which preserves field order.

## Building the Type→Schema Lookup

To resolve `set 1` → `{type: 'set', value: 1}`, we need to know which schemas exist for each message type name.

### Approach: Build from `ObjectSchemaRegistry`

The `objectSchemas` registry already has every object's inlet message schemas. We can build a reverse index at startup:

```typescript
// Map from message type name → schema properties (excluding 'type')
type FieldMapping = {
  fields: string[];           // canonical order: ['key', 'value']
  types: Record<string, TSchema>;  // field name → TypeBox type
};

// Build from objectSchemas — scan all inlet message schemas
function buildMessageFieldMap(): Map<string, FieldMapping[]>
```

Multiple objects may define different schemas for the same type name (e.g., `set` means `{value: any}` for msg boxes but `{key: string, value: any}` for kv). The lookup should:

1. **Context-aware (ideal)**: Know the downstream object type and use its specific schema. Requires tracing the edge to the target node.
2. **Heuristic (simpler)**: When ambiguous, prefer the schema with fewer fields (the simpler interpretation). `set 1` → `{type: 'set', value: 1}` (1 field) wins over `{type: 'set', key: 1}` (also 1 field but missing `value`).

### Recommendation: Start context-free, add context later

For v1, build a global map. If a type name has multiple schemas with different field counts, require named arguments for disambiguation. Most common messages (`bang`, `set`, `clear`, `reset`, `get`, `setCode`) have unambiguous schemas.

## Implementation Plan

### Phase 1: Schema introspection utilities

Add to `src/lib/objects/schemas/utils.ts`:

- `getMessageFields(schema): string[]` — extract non-type field names in order
- `buildMessageTypeMap(registry): Map<string, FieldMapping[]>` — build the global lookup

### Phase 2: Shorthand parser

Add to `src/lib/utils/message-parser.ts`:

- `parseNamedArgs(tokens: string[]): { positional: string[], named: Record<string, string> }` — separate `field=value` from positional args
- Keep existing `splitByTopLevelSpaces` for tokenization

### Phase 3: Integrate into MessageNode

In `sendMessage()`, after space-splitting but before the array fallback:

```typescript
const tokens = splitByTopLevelSpaces(processedMsg);
if (tokens.length > 1) {
  const resolved = tryResolveShorthand(tokens);
  if (resolved) { send(resolved); continue; }
  // fallback: send as array
  send(tokens.map(parseToken));
  continue;
}
```

### Phase 4: Context-aware resolution (future)

Trace edges from the msg node's outlet to find the target object type. Use the target's specific inlet schemas for resolution. This makes `set 1` unambiguous when connected to a specific object.

## Examples

### Common messages today

| Shorthand | Resolves to | Schema source |
|---|---|---|
| `bang` | `{type: 'bang'}` | `sym('bang')` — no fields, existing behavior |
| `set 1` | `{type: 'set', value: 1}` | `msg('set', { value })` |
| `setCode code` | `{type: 'setCode', value: "code"}` | `msg('setCode', { value })` |
| `clear` | `{type: 'clear'}` | `sym('clear')` — no fields |
| `get foo` | `{type: 'get', key: 'foo'}` | `msg('get', { key })` |
| `set foo 42` | `{type: 'set', key: 'foo', value: 42}` | `msg('set', { key, value })` |

### Edge cases

| Input | Behavior | Reason |
|---|---|---|
| `set` | `{type: 'set'}` | Recognized type, no args → symbol |
| `unknownThing 1 2` | `[{type: 'unknownThing'}, 1, 2]` | Not a recognized type → array fallback |
| `100 200` | `[100, 200]` | First token is number, not a type name → array |
| `set value=1` | `{type: 'set', value: 1}` | Named arg |
| `set "hello world"` | `{type: 'set', value: "hello world"}` | Quoted string as value |

## Resolved Questions

1. **Symbols with no extra args go through shorthand.** `set` alone sends `{type: 'set'}`. The receiver validates required fields — keeps the syntax layer simple and consistent.

2. **Rest args for the last `Type.String()` field: yes.** If the last positional field is `Type.String()`, remaining tokens are joined with spaces. `setCode console.log('hello')` → `{type: 'setCode', value: "console.log('hello')"}`. Unquoted commas in code (e.g., `console.log(a, b)`) will be split by the sequential message parser since `()` isn't tracked — users must quote: `setCode "console.log(a, b)"`. Quoted commas and spaces are already protected by `splitAtTopLevel`.

3. **Shorthands work in sequential messages.** `set 1, bang` → sends `{type: 'set', value: 1}` then `{type: 'bang'}`. Each comma-segment is processed independently through the full pipeline (step 5 in the resolution order).
