Convolution reverb using impulse responses.

## Loading Impulse Responses

1. Connect a `soundfile~` to the `convolver~` message inlet
2. Upload a sound file or send a URL to `soundfile~`
3. Send a `read` message to `soundfile~` to load the impulse response

The sound file must be a valid
[impulse response](https://en.wikipedia.org/wiki/Impulse_response) - typically
a short audio file with a single impulse followed by reverb tail.

> **Tip**: Clap your hands in a room and record the sound to create your own
> impulse response!

## See Also

- [soundfile~](/docs/objects/soundfile~) - audio file playback
- [delay~](/docs/objects/delay~) - audio delay line
