Routes one of several message inlets to a single outlet.

## Usage

```text
switch <inlet-count>
```

`switch` has one data inlet for each route and a selector inlet on the far right. Send a one-based integer to the selector, then messages arriving at the matching data inlet pass to the outlet. Send `0` to block every route. It has two data inlets by default.

## See Also

- [gate](/docs/objects/gate) - select one of several output routes
- [spigot](/docs/objects/spigot) - allow or block a single message route
