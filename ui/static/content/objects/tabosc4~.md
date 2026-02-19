Wavetable oscillator with 4-point interpolation.

Combines a built-in phasor with `tabread4~` for smooth wavetable synthesis.

## Usage

```text
tabosc4~ <frequency> <table-name>
```

## Example

Create a wavetable and play it as an oscillator:

```text
[table waveform]      <- Create/load your wavetable

[tabosc4~ 440 waveform]
         |
      [out~]
```

## Wavetable Creation

Fill a table with a single cycle waveform (e.g., 512 or 1024 samples).
The oscillator loops through the table at the specified frequency.

```text
[msg: sinesum 512 1]  <- Generate sine wave
         |
   [table mytable]

[tabosc4~ 220 mytable] → [out~]
```

## FM Modulation

The frequency inlet accepts audio-rate modulation:

```text
[osc~ 5]              <- LFO
    |
[*~ 50]               <- Vibrato depth
    |
[+~ 440]              <- Center frequency
    |
[tabosc4~ 0 waveform]
    |
 [out~]
```

## See Also

- [table](/docs/objects/table) - create/store wavetables
- [tabread4~](/docs/objects/tabread4~) - manual table reading
- [phasor~](/docs/objects/phasor~) - phase ramp generator
- [osc~](/docs/objects/osc~) - basic oscillator
