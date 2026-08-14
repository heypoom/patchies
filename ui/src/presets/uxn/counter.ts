import type { UxnPreset } from './types';

const code = `( Sketch by Keijiro )
( https://github.com/keijiro/uxn-sketches )

( devices )

|00 @System     [ &vector $2 &pad    $6 &r      $2 &g     $2 &b      $2 ]
|20 @Screen     [ &vector $2 &width  $2 &height $2 &auto  $1 &pad    $1
                  &x      $2 &y      $2 &addr   $2 &pixel $1 &sprite $1 ]

( variables )

|0000

@count $2

( program )

|0100 ( -> )

    #07ff .System/r DEO2
    #0e4f .System/g DEO2
    #0c4f .System/b DEO2
    ;step .Screen/vector DEO2

BRK

@step

    ( count ++ )
    ;count LDA2 INC2 ;count STA2

    ( draw count )
    #0010 #0010 ;count LDA2 #01 ;draw-dec JSR2

BRK

@draw-dec ( x* y* num* color -- )

    STH ( use return stack to store color )

    ( apply x* and y* )
    STH2 [ .Screen/y DEO2 ] [ .Screen/x DEO2 ] STH2r

    ( x-axis auto increment )
    #01 .Screen/auto DEO

    ( 10,000 )
    #2710 DIV2k DUP2 NIP
    [ #30 SFT #00 SWP ] [ ;font-dec ADD2 .Screen/addr DEO2 ]
    STHkr .Screen/sprite DEO
    MUL2 SUB2

    ( 1,000 )
    #03e8 DIV2k DUP2 NIP
    [ #30 SFT #00 SWP ] [ ;font-dec ADD2 .Screen/addr DEO2 ]
    STHkr .Screen/sprite DEO
    MUL2 SUB2

    ( 100 )
    #0064 DIV2k DUP2 NIP
    [ #30 SFT #00 SWP ] [ ;font-dec ADD2 .Screen/addr DEO2 ]
    STHkr .Screen/sprite DEO
    MUL2 SUB2 NIP

    ( 10 )
    #0a DIVk DUP
    [ #30 SFT #00 SWP ] [ ;font-dec ADD2 .Screen/addr DEO2 ]
    STHkr .Screen/sprite DEO
    MUL SUB

    ( 1 )
    [ #30 SFT #00 SWP ] [ ;font-dec ADD2 .Screen/addr DEO2 ]
    STHr .Screen/sprite DEO

JMP2r

@font-dec
    007c 8282 8282 827c
    0030 1010 1010 1010
    007c 8202 7c80 80fe
    007c 8202 1c02 827c
    000c 1424 4484 fe04
    00fe 8080 7c02 827c
    007c 8280 fc82 827c
    007c 8202 1e02 0202
    007c 8282 7c82 827c
    007c 8282 7e02 827c`;

export const preset: UxnPreset = {
  type: 'uxn',
  description: 'Animated decimal counter by Keijiro',
  data: { code }
};
