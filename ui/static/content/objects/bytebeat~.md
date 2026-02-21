[Bytebeat](https://en.wikipedia.org/wiki/Bytebeat) is a form of algorithmic music
where simple mathematical expressions operating on a time counter `t` produce
audio output.

Great for creating lo-fi, glitchy, and experimental sounds with minimal code.
Powered by [bytebeat.js](https://github.com/greggman/html5bytebeat).

## Getting Started

Write an expression using `t` (the time counter that increments each sample):

```javascript
((t >> 10) & 42) * t
```

Click the **Play** button to hear your creation. The expression is evaluated
for each audio sample, creating sound from pure math.

## Controls

- **Play/Pause**: Start or pause audio generation
- **Stop**: Stop and reset time counter to zero
- **Settings**: Configure type, syntax, and sample rate

## Settings

### Type

- **Bytebeat**: Classic 8-bit output (0-255), wraps automatically
- **Floatbeat**: Floating point output (-1.0 to +1.0), use `Math.sin()` etc.
- **Signed Bytebeat**: Signed 8-bit output (-128 to 127)

### Syntax

- **Infix**: Standard math notation like `sin(t / 50)`
- **Postfix (RPN)**: Reverse Polish notation like `t 50 / sin`
- **Glitch**: Glitch machine URL format
- **Function**: JavaScript function body returning a function

### Sample Rate

Lower rates produce crunchier, more lo-fi sound. Classic bytebeat uses 8000 Hz.

## Example Expressions

```javascript
// Classic bytebeat
((t >> 10) & 42) * t

// Sierpinski harmony
t & t >> 8

// 8-bit melody
(t * 5 & t >> 7) | (t * 3 & t >> 10)

// Floatbeat sine (use floatbeat type)
Math.sin(t / 10) * 0.5
```

## Messages

Control the node programmatically:

- `{type: 'play'}` - Start playback
- `{type: 'pause'}` - Pause (keeps t position)
- `{type: 'stop'}` - Stop and reset t=0
- `{type: 'bang'}` - Evaluate and play
- `{type: 'setType', value: 'floatbeat'}` - Change type
- `{type: 'setSyntax', value: 'postfix'}` - Change syntax
- `{type: 'setSampleRate', value: 11025}` - Change sample rate

## See Also

- [strudel](/docs/objects/strudel) - Strudel music environment
- [orca](/docs/objects/orca) - Orca livecoding
- [expr~](/docs/objects/expr~) - Audio expression DSP
