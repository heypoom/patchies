Splits an array into individual elements, sending each to a separate outlet.

## Usage

```text
unpack <count>
```

## Arguments

- `count` — number of elements to unpack (default: `2`)

`unpack 4` creates 4 element outlets plus a `remaining` outlet (5 total).

## Outlets

The rightmost outlet is always `remaining` — it fires only when the input array
has more elements than `count`, sending the leftover slice.

## Examples

`unpack 3` receives `[1, 2, 3, 4, 5]`:

1. Outlet 0: `1`
2. Outlet 1: `2`
3. Outlet 2: `3`
4. Outlet 3 (remaining): `[4, 5]`

`unpack 3` receives `[10, 20]` (fewer elements than count):

1. Outlet 0: `10`
2. Outlet 1: `20`
3. Outlet 2: `null`
4. Outlet 3 (remaining): nothing

If the input is not an array, it is treated as a single-element array — outlet 0
gets the value, remaining named outlets get `null`.

_Inspired by [Pure Data](https://pd.iem.sh/objects/unpack)._

## See Also

- [trigger](/docs/objects/trigger) - fan out a single message to multiple outlets
- [select](/docs/objects/select) - route by matching value
- [map](/docs/objects/map) - transform array elements
