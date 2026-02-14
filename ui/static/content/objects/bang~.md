Emit a bang message when audio input transitions from silence to non-silence. Detects audio onset at block boundaries.

## Inlets

1. **signal**: audio signal to monitor

## Outlets

1. **bang**: bang on audio onset

## Usage

```
osc~ → bang~ → triggers on first non-zero sample block
```

Useful for detecting when audio starts playing, triggering events from audio signals, or converting audio-rate events to message-rate.

## See Also

- [snapshot~](/docs/objects/snapshot~) - sample signal value on bang
- [meter~](/docs/objects/meter~) - visual signal level meter
