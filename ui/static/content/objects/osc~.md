Oscillator for generating audio waveforms (sine, square, sawtooth, triangle).

## Custom Waveforms

![Patchies periodic wave oscillator](/content/images/patchies-periodic-waves.png)

> Try this patch [in the app](https://patchies.app/?id=ocj3v2xp790gq8u)!

Use [PeriodicWave](https://developer.mozilla.org/en-US/docs/Web/API/PeriodicWave)
by sending `[real: Float32Array, imaginary: Float32Array]` to the type inlet.

1. Create a `js` object
2. Connect it to `osc~`'s `type` inlet (second message inlet)
3. Run the code to send the arrays
4. The `type` property will show "custom"

```js
setRunOnMount(true);

const real = new Float32Array(64);
const imag = new Float32Array(64);

for (let n = 1; n < 64; n++) {
  real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.5);
}

send([real, imag]);
```

## See Also

- [sig~](/docs/objects/sig~) - constant signal generator
- [gain~](/docs/objects/gain~) - amplify audio
