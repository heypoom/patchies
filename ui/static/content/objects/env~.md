RMS envelope follower. Analyzes the amplitude of an audio signal and outputs the RMS level as messages.

## Usage

```txt
osc~ 440 → env~ → number display
```

The default analysis window is 1024 samples. Set a smaller window for faster response:

```txt
256 → inlet 2 (window size in samples)
```

Useful for amplitude-following effects, ducking, or visualizing signal levels.

## See Also

- [snapshot~](/docs/objects/snapshot~) - sample signal on bang
- [meter~](/docs/objects/meter~) - audio level meter with visual display
