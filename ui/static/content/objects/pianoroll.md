# pianoroll

MIDI clip recorder and player with an inline piano roll visualization.

## Usage

Connect a MIDI source to inlet 0. Send `arm` to inlet 1, then press play — recording starts. Press stop (or set **Bars** for auto-stop) and the clip plays back automatically. Connect outlet 0 to a synth or `midi.out`.

## Inlets

| # | Description |
|---|-------------|
| 0 | MIDI input (noteOn / noteOff) |
| 1 | Commands: `arm`, `record`, `stop`, `clear`, `loop`, `unloop` |

## Outlet

| # | Description |
|---|-------------|
| 0 | MIDI output (noteOn / noteOff during playback) |

## Settings

- **Bars** — clip length (1, 2, 4, 8, 16). Auto-stops recording after this many bars.
- **Quantize** — snap incoming notes to grid on record and drawing.
- **Sync to Transport** — follow global transport play/stop (default: on).
- **Loop** — loop playback.

## Drawing Notes

Click on the grid to add a note. Right-click to delete. Scroll the mouse wheel to scroll pitch. Notes flash when played.

## See Also

`midi.in`, `midi.out`, `sequencer`, `pads~`
