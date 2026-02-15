Sample-and-hold triggered by bang. Captures the current input signal value when banged and holds it as a constant output.

## Usage

```txt
osc~ 1 → latch~
metro 500 → bang → latch~ → *~ → gain~
```

This samples a slow LFO every 500ms, creating a stepped modulation signal.

## See Also

- [samphold~](/docs/objects/samphold~) - sample and hold triggered by control signal decrease
- [snapshot~](/docs/objects/snapshot~) - sample signal on bang (outputs as message)
