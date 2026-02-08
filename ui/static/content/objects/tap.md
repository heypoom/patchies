Execute JavaScript expressions for side effects (like logging) while passing
the original message through unchanged.

Perfect for debugging message flow without altering the data.

## Examples

```js
// Log incoming messages
console.log('received:', $1)

// Log specific fields
console.log('note:', $1.note, 'velocity:', $1.velocity)

// Conditional logging
if ($1.type === 'noteOn') console.log('Note on!', $1)
```

The expression result is ignored - the original message always passes through.

## Hot and Cold Inlets

Inlet 0 triggers evaluation; other inlets store values silently.
See [Hot and Cold Inlets](/docs/hot-cold-inlets) for details.

## See Also

- [peek](/docs/objects/peek) - display message values visually
- [map](/docs/objects/map) - transform messages
- [filter](/docs/objects/filter) - conditional message passing
