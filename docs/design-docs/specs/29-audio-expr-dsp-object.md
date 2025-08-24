# 29. expr~ (audio expression) object

We can use `AudioWorklet` to build a custom vector-based DSP.

We can register an `ExprProcessor` that runs custom DSP code over the inputs, outputs and given parameters. Here's an example:

```tsx
class ExpressionProcessor extends AudioWorkletProcessor {
  processor: Function | null

  set(code: string) {
    const userCode = `
      const numChannels = input.length;
      const numSamples = input[0].length;

      for (let channel = 0; channel < numChannels; channel++) {
        const inChannel = input[channel];
        const outChannel = output[channel];

        for (let i = 0; i < numSamples; i++) {
          const sample = inChannel[i];
          outChannel[i] = ${expressionString};
        }
      }
    `

    try {
      this.processor = new Function('input', 'output', 'parameters', userCode)
    } catch (error) {
      this.processor = null
    }
  }

  process(inputs, outputs, parameters) {
    // Keep the expression node alive.
    if (!this.processor) return true

    try {
      this.processor(inputs[0], outputs[0], parameters)
    } catch (error) {
      this.processor = null
    }

    return true
  }
}

registerProcessor('expression-processor', ExpressionProcessor)
```

You will need to use the MessagePort to set expressions on the `ExpressionProcessor` instance.

Look at `AudioSystem.ts` on how to register this audio system, and look at `ObjectNode.ts` for inspiration on how audio object usually works. In this case, I want you to implement a separate visual node similar to `ExprNode.ts`, you can call it `AudioExprNode.ts` and register it under the name of `expr~` to indicate that it is an audio DSP.
