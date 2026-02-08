Distortion and waveshaping effects using custom curves.

## Custom Distortion Curve

![Patchies waveshaper curve](/content/images/patchies-waveshaper-curve.png)

> Try this patch [in the app](https://patchies.app/?id=55oju82ir1ujko1)!

Send a
[distortion curve](https://developer.mozilla.org/en-US/docs/Web/API/WaveShaperNode)
(Float32Array) to the `curve` inlet.

1. Create a `js` object
2. Connect it to `waveshaper~`'s `curve` inlet (second message inlet)
3. Run the code to send the array
4. The `curve` property will show "curve"

```js
setRunOnMount(true);

const k = 50;
const s = 44100;
const curve = new Float32Array(s);
const deg = Math.PI / 180;

for (let i = 0; i < s; i++) {
  const x = (i * 2) / s - 1;
  curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
}

send(curve);
```

## See Also

- [compressor~](/docs/objects/compressor~) - dynamic range compression
- [gain~](/docs/objects/gain~) - amplify audio
