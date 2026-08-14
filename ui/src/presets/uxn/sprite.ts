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
    #2fe5 .System/r DEO2
    #2fc5 .System/g DEO2
    #4f25 .System/b DEO2

    ( random seed )
    #01 ;rand/a STA

    ( initialization )
    #00
    &ball-init-loop
        DUP ;rand JSR2 #07 AND #01 ORA SWP STZ
    INC DUP ;rand JSR2                 SWP STZ
    INC DUP ;rand JSR2 #07 AND #01 ORA SWP STZ
    INC DUP ;rand JSR2                 SWP STZ
    INC DUP ,&ball-init-loop JCN
    POP

    ( vectors )
    ;on-frame .Screen/vector DEO2

    BRK

@on-frame ( -> )
    ;sprite .Screen/addr DEO2

    ( clear )
    #00
    &ball-clear-loop
    INC #00 OVR LDZ .Screen/x DEO2
    INC
    INC #00 OVR LDZ .Screen/y DEO2
    #00 .Screen/sprite DEO
    INC DUP ,&ball-clear-loop JCN
    POP

    ( move )
    #00
    &ball-update-loop
    LDZk SWP INC LDZk ROT ADD SWP STZk NIP INC
    LDZk SWP INC LDZk ROT ADD SWP STZk NIP INC
    DUP ,&ball-update-loop JCN
    POP

    ( draw )
    #00
    &ball-draw-loop
    INC #00 OVR LDZ .Screen/x DEO2
    INC
    INC #00 OVR LDZ .Screen/y DEO2
    #01 .Screen/sprite DEO
    INC DUP ,&ball-draw-loop JCN
    POP

    BRK

@sprite
    3c7e ffff ffff 7e3c

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
  description: 'Animated sprite field by Keijiro',
  data: { code }
};
