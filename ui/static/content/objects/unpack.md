Splits an array into individual elements, sending each to a separate outlet.

## Usage

```text
unpack <count>
```

## Arguments

- `count` — number of elements to unpack (default: `2`)

`unpack 4` creates 4 outlets and sends `array[0]` through `array[3]`.

## Examples

`unpack 3` receives `[10, 20, 30]`:

1. Outlet 0: `10`
2. Outlet 1: `20`
3. Outlet 2: `30`

`unpack 3` receives `[10, 20]` (fewer elements than outlets):

1. Outlet 0: `10`
2. Outlet 1: `20`
3. Outlet 2: `null`

If the input is not an array, it is treated as a single-element array — outlet 0
gets the value, remaining outlets get `null`.

## See Also

- [trigger](/docs/objects/trigger) - fan out a single message to multiple outlets
- [select](/docs/objects/select) - route by matching value
- [map](/docs/objects/map) - transform array elements
