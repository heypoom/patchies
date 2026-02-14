Sample a signal value and output it as a message. Send a bang to capture the current value of the input signal.

## Usage

Connect a signal and send bang to read the current value:

```
osc~ → snapshot~
metro → snapshot~ → peek (shows current amplitude)
```

Useful for monitoring signal values, creating control signals from audio, or bridging audio-rate to message-rate.

## See Also

- [bang~](/docs/objects/bang~) - emit bang on audio onset
- [meter~](/docs/objects/meter~) - visual signal level meter
