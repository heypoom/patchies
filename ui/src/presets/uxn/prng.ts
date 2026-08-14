import type { UxnPreset } from './types';

const code = `( Sketch by Keijiro )
( https://github.com/keijiro/uxn-sketches )

( devices )

|00 @System [ &vector $2 &pad   $6 &r      $2 &g   $2 &b $2 ]
|20 @Screen [ &vector $2 &width $2 &height $2 &pad $2 &x $2 &y $2 &addr $2 &pixel $1 &sprite $1 ]

( variables )

|0000

( program )

|0100 ( -> )

    ( theme )
    #0fff .System/r DEO2
    #0fff .System/g DEO2
    #0fff .System/b DEO2

    ( random seed )
    #01 ;rand/a STA

    ( vector )
    ;on-frame .Screen/vector DEO2

    BRK

@on-frame ( -- )
    ( y = 0 )
    #00
    &loop-y
        ( y -> Screen/y )
        DUP #00 SWP .Screen/y DEO2
        ( r = rand, x = 0 )
        ;rand JSR2 #00
        &loop-x
            ( x -> Screen/x )
            DUP #00 SWP .Screen/x DEO2
            ( x < r -> Screen/pixel )
            GTHk .Screen/pixel DEO
            ( loop until ++x == 0 )
            INC DUP ,&loop-x JCN
        POP2
        ( loop until ++y == 0 )
        INC DUP ,&loop-y JCN
    POP
    BRK

@rand ( -- number )
    ( 8-bit PRNG https://github.com/edrosten/8bit_rng )

    ( t = x ^ (x << 4) )
    ,&x LDR DUP #40 SFT EOR
    ( x = y )
    ,&y LDR ,&x STR
    ( y = z )
    ,&z LDR ,&y STR
    ( z = a )
    ,&a LDR DUP ,&z STR
    ( a = z ^ t ^ (z >> 1) ^ (t << 1) )
    DUP #10 SFT EOR SWP DUP #01 SFT EOR EOR
    DUP ,&a STR
    JMP2r

    &x $1 &y $1 &z $1 &a $1`;

export const preset: UxnPreset = {
  type: 'uxn',
  description: 'Random bar field by Keijiro',
  data: { code }
};
