Filter messages based on a JavaScript expression. If the expression evaluates
to a truthy value, the message is sent to the **first outlet** (matched);
otherwise, it's sent to the **second outlet** (no match).

Use `$1` to `$9` variables like in `expr` to reference inlet values.

Unlike `expr` which outputs the result of the expression, `filter` passes
through the original input message when the condition is met (or not met).

## Examples

```js
// Only pass through messages where type is 'play'
$1.type === 'play'

// Filter for note-on messages with velocity above 64
$1.type === 'noteOn' && $1.velocity > 64

// Pass through numbers greater than 100
$1 > 100
```

## Two Outlets

- **First outlet**: Messages that match the filter condition
- **Second outlet**: Messages that fail to match

## Hot and Cold Inlets

Inlet 0 (`$1`) triggers evaluation; other inlets store values silently.
See [Hot and Cold Inlets](/docs/hot-cold-inlets) for details.

## See Also

- [expr](/docs/objects/expr) - expression evaluator
- [map](/docs/objects/map) - transform messages
- [uniq](/docs/objects/uniq) - filter consecutive duplicates
