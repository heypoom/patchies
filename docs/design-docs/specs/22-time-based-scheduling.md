# 22. Time Based Audio Scheduling

Right now, the audio pipeline (`AudioSystem`) works in a real-time manner: when a control message is sent (e.g. via `send()`), it is processed immediately.

My use case is I want to build an ADSR envelope to automate the gain of a sound over time.

## Message types for automating values with ADSR

Today, you can already send a plain integer like `0.5` and it sets the gain value to 0.5, if wired to the `gain` inlet of the `gain` node, see `ui/src/lib/objects/object-definitions.ts`.

We want to add support for 3 message types, `set`, `trigger` and `release`. `set` sets the value (at a future time), `trigger` schedules the attack-delay-sustain phase, and `release` schedules the release.

First, the `set` message. At the simplest form it sets the value via `data.value`.

```ts
{
  "type": "set",
  "value": 440
}
```

You can schedule the value to be set at a specific time in the future by adding the `time` and `timeMode` properties. By default, `timeMode` is `relative`, but `absolute` sets the time directly.

```ts
{
  "type": "set",
  "value": 0.5,
  "time": 2.5,
  "timeMode": "relative"
}
```

Example Implementation of `set`:

```ts
const time = match(data.timeMode)
  .with('absolute', () => data.time)
  .otherwise(() => audioContext.currentTime + data.time)

param.setValueAtTime(data.value, time)
```

Then, there is `trigger` and `release`. the following messages to the `gain` node will automate the gain value over time following an ADSR envelope.

```ts
{
  "type": "trigger",
  "startValue": 0,
  "peakValue": 1,
  "attackTime": 0.1,
  "decayTime": 0.2,
  "sustainValue": 0.7
}

{
  "type": "release",
  "releaseTime": 0.3,
  "endValue": 0
}
```

You can also automate the oscillator frequency of the `osc` node as well by sending the following messages to the `frequency` inlet of the osc.

```ts
{
  "type": "trigger",
  "startValue": 440,
  "peakValue": 880,
  "attackTime": 0.1,
  "decayTime": 0.2,
  "sustainValue": 660
}

{
  "type": "release",
  "releaseTime": 0.3,
  "endValue": 440
}
```

## Example of ADSR implementation

Here's a sample code of how the above message parameters could be used to automate via `linearRampToValueAtTime`:

```ts
// Assume you have an AudioContext and a GainNode instance.
const gainNode = audioContext.createGain()

function triggerADSR(attackTime, decayTime, sustainValue, releaseTime) {
  const now = audioContext.currentTime

  // Attack Phase
  gainNode.gain.setValueAtTime(startValue, now)
  gainNode.gain.linearRampToValueAtTime(peakValue, now + attackTime)

  // Decay Phase
  gainNode.gain.linearRampToValueAtTime(
    sustainValue,
    now + attackTime + decayTime
  )

  // The sustain level will hold until the release phase is triggered.
}

function releaseADSR(releaseTime) {
  const now = audioContext.currentTime
  gainNode.gain.cancelScheduledValues(now)
  gainNode.gain.linearRampToValueAtTime(0, now + releaseTime)
}
```

## Custom Curves

In the next phase, we want to support defining custom curves too.

We should be able to specify the curve to use for each of the phases. They all default to `linear` curve:

- `attackCurve`
- `decayCurve`
- `releaseCurve`

We should be able to use 3 type of curves

- `linear` - calls `linearRampToValueAtTime`
- `exponential` - calls `exponentialRampToValueAtTime`
- `targetAtTime` - useful for decay and release. calls `setTargetAtTime`

Examples:

```ts
{
  "attackCurve": "linear",
  "decayCurve": "targetAtTime",
  "decayTimeConstant": 0.3 // The time constant for the decay
}

{
  "releaseCurve": "exponential"
}
```

Example implementation for using `exponentialRampToValueAtTime`:

```ts
if (data.decayCurve === 'exponential') {
  param.exponentialRampToValueAtTime(
    data.sustainValue,
    now + data.attackTime + data.decayTime
  )
}
```

Example implementation for using `setTargetAtTime`:

```ts
if (data.decayCurve === 'targetAtTime') {
  param.setTargetAtTime(
    data.sustainValue,
    now + data.attackTime,
    data.decayTimeConstant
  )
} else {
  param.linearRampToValueAtTime(
    data.sustainValue,
    now + data.attackTime + data.decayTime
  )
}
```
