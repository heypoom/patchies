Load and play audio files with transport controls.

## Loading Audio

- Double click or drop a file to load it
- Dropping an audio file into the patcher creates a `soundfile~` by default
- Right click to convert to [sampler~](/docs/objects/sampler~) for more
  playback capabilities

## Radio Stations

Load streaming audio too! Search for "online radio station search" to find
stream URLs.

```js
// Example: send URL to soundfile~ then bang to play
'https://stream.japanradio.de/live'
```

## Settings

![Audio I/O settings](/content/images/audio-io-settings.webp)

Configure audio devices using the settings button on `mic~` and `out~`.

## See Also

- [sampler~](/docs/objects/sampler~) - sample playback with triggering
- [out~](/docs/objects/out~) - audio output
