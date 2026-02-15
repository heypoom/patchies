Sample-accurate ADSR envelope generator. Outputs a continuous audio-rate signal between 0 and 1.

## Usage

Send 1 to trigger the attack phase, 0 to trigger release:

```txt
1 → adsr~ → envelope rises (attack → decay → sustain)
0 → adsr~ → envelope falls (release → idle)
```

Set envelope times via inlets (attack, decay, release in ms; sustain as 0-1 level):

```txt
50 → inlet 2 (attack = 50ms)
200 → inlet 3 (decay = 200ms)
0.7 → inlet 4 (sustain = 0.7)
500 → inlet 5 (release = 500ms)
```

Multiply with an oscillator for amplitude control:

```txt
osc~ 440 → *~
adsr~ → *~ → gain~
```

## See Also

- [adsr](/docs/objects/adsr) - message-rate ADSR for audio param automation
- [line~](/docs/objects/line~) - signal ramp generator
- [vline~](/docs/objects/vline~) - sample-accurate scheduled ramps
