# 6. Creating dynamic objects with JavaScript

Users can write code in JavaScript right in the Patchies editor to create their own custom objects at runtime.

- We need an internal dynamic registry to manage these custom components.
  - We should also have custom object libraries, which are essentially the same as the above registry but can have multiple instances.
- When the user tries to drag in a `object.js` file, we should try to parse that as a custom object first. If it is, then add it to the canvas.

```js
// ES modules should be supported by browsers..?
import p5 from "https://cdn.example.com/p5.js"

export default {
  // object name. required.
  name: "P5",

  // inlets are input slots that receives incoming messages.
  // default inlets are untyped, accepts every kind of messages.
  // using string as an input
  inlets: ['sketch']

  setup() {
   this.canvas = createElement('canvas')
   this.canvas.className = '...'
  }

  render() {
   return this.canvas
  }

  onMessage(message) {
  if (message.inlet === 'sketch' && typeof message.data === 'string') {
    this.p5 = p5(message.data, this.canvas)
  }
  }

  cleanup() {
    this.p5.destroy()
    this.canvas.remove()
  }
}
```

- UI can be written in JavaScript, e.g. HTML/CSS, P5.js or Svelte.
- UI components written in Svelte be able to subscribe to messages coming from particular block ids.
  - We will allow users to write their own objects using JavaScript within the app soon. We should consider making this dynamic enough.

## Typed Inlets & Outlets

```js
{
  inlets: [
    // Specify the message type here.
    // This will validate that only untyped or string outlets are supported
    {name: 'sketch', type: 'string'},

    // Only accepts a 'bang' message for use as clock signals.
    {
      name: 'clock',
      type: 'bang',
      description: 'Clock signals',
    },

    // Support multiple types of messages for an inlet.
    {
      name: 'clock',
      type: ['bang', 'int'],
    },
  ]
}
```
