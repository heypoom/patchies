Filters out consecutive duplicate values (like Unix `uniq` or RxJS
`distinctUntilChanged`).

By default, uses strict equality (`===`) to compare values.

## Custom Comparator

Optional comparator expression: `$1` is the previous value, `$2` is the
current value. Return `true` if equal (skip), `false` if different (pass
through).

```js
// Default: strict equality (no expression needed)
// 1 1 1 2 2 3 3 3 4 → 1 2 3 4

// Compare by specific property
$1.id === $2.id

// Compare by multiple properties
$1.x === $2.x && $1.y === $2.y

// Custom comparison (e.g., within threshold)
Math.abs($1 - $2) < 0.01
```

## Reset

Second inlet resets the state (forgets the last value).

## See Also

- [filter](/docs/objects/filter) - conditional message passing
- [scan](/docs/objects/scan) - stateful accumulation
