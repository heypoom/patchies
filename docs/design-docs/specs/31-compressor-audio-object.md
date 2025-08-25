# 31. Compressor

Add a `compressor` node with the below audio parameters.

See `21-basic-audio-nodes.md` on basics of how to add audio nodes. Important files: `AudioSystem.ts`, `object-definitions.ts`

## Compressor Parameters

attack

    The amount of time (in seconds) to reduce the gain by 10dB. Its default value is 0.003. This parameter is k-rate. Its nominal range is [0, 1].

knee

    A decibel value representing the range above the threshold where the curve smoothly transitions to the "ratio" portion. Its default value is 30. This parameter is k-rate. Its nominal range is [0, 40].

ratio

    The amount of dB change in input for a 1 dB change in output. Its default value is 12. This parameter is k-rate. Its nominal range is [1, 20].

release

    The amount of time (in seconds) to increase the gain by 10dB. Its default value is 0.250. This parameter is k-rate. Its nominal range is [0, 1].

threshold

    The decibel value above which the compression will start taking effect. Its default value is -24. This parameter is k-rate. Its nominal range is [-100, 0].
