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

It would be great if there is a parameter that increment each time the process function is called `counter`.
