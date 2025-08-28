# 32. Dynamic JavaScript DSP (dsp~)

Let's create "dsp~", a super advanced sibling of AudioExprNode.svelte (expr~).

You need to write a lot more code than `expr~` for the simple stuff, but it gives you more control.

Basic white noise DSP. In `expr~` this would be `random() * 2 - 1`;
In `dsp~` we write a `process` method, which takes `inputs, outputs, params`.

```js
function process(inputs, outputs) {
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.random() * 2 - 1
    }
  })
}
```

Notice that we do not have to return `true` manually. We consider the node to always be long-lived.

## Inlet Parameters

We can use `$1` to `$9` like in `expr~.

```js
const process = (inputs, outputs) => {
  outputs[0].forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.random() * $1 - $2
    }
  })
}
```

## Audio Parameters

The signal (blue) inlets are created automatically for each audio parameter.

```js
const params = [
  {
    name: 'customGain',
    defaultValue: 1,
    minValue: 0,
    maxValue: 1,
    automationRate: 'a-rate',
  },
]

function process(inputs, outputs, params) {
  const output = outputs[0]
  const g = params['customGain']

  output.forEach((channel) => {
    for (let i = 0; i < channel.length; i++) {
      channel[i] = (Math.random() * 2 - 1) * (g.length > 1 ? g[i] : g[0])
    }
  })
}
```
