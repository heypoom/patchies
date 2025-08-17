# 25. Microphone Audio Node

object name: `mic`

The mic audio object should have no inlet, and one outlet for the signal output of type `signal`.

Relevant modules: `AudioSystem`, `object-definitions`

## On setup in AudioSystem

- Create a gain node
- Use getUserMedia({ audio: true }) to get the microphone stream
- Use audioContext.createMediaStreamSource to create an audio source
- Connect audio source to that gain node
- Register the gain node

## On cleanup

- Remove the gain node. Should be handled by default.
- Cleanup the microphone stream and media stream source.
