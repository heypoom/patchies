Routes one message inlet to one of several outlets.

## Usage

```text
gate <outlet-count>
```

`gate` has a selector inlet on the left and a data inlet on the right. Send a one-based integer to the selector, then messages arriving at the data inlet go to that outlet. Send `0` to close the gate. It has two outlets by default.

## See Also

- [switch](/docs/objects/switch) - select one of several input routes
- [spigot](/docs/objects/spigot) - allow or block a single message route
