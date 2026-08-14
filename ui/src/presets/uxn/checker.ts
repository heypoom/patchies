import type { UxnPreset } from './types';

const code = `( Sketch by Keijiro )
( https://github.com/keijiro/uxn-sketches )

( devices )

|00 @System     [ &vector $2 &pad      $6 &r      $2 &g     $2 &b      $2 ]
|20 @Screen     [ &vector $2 &width    $2 &height $2 &pad   $2 &x      $2 &y      $2 &addr $2 &pixel  $1 &sprite $1 ]

( variables )

|0000

@scroll [ &x $2 &y $2 ]

( program )

|0100 ( -> )

    ( theme )
    #2ee5 .System/r DEO2
    #23c5 .System/g DEO2
    #4225 .System/b DEO2

    ( vectors )
    ;on-frame .Screen/vector DEO2

    BRK

@on-frame ( -> )
    ( scrolling )
    .scroll/x LDZ2 #0002 ADD2 .scroll/x STZ2
    .scroll/y LDZ2 #0003 ADD2 .scroll/y STZ2

    ( y = 0 )
    #0000 ,&y STR2

    &loop-y
        ( y ++ )
        ,&y LDR2 INC2 DUP2 ,&y STR2 .Screen/y DEO2

        ( x = 0 )
        #0000 ,&x STR2

        ( checker pattern )
        ,&y POPk LDR
        .scroll/y INC LDZ ADD #20 AND
        .scroll/x INC LDZ EOR ,&chk STR

        &loop-x
            ( x ++ )
            ,&x LDR2 INC2 DUP2 ,&x STR2 .Screen/x DEO2

            ( checker pattern )
            ,&chk LDR INC DUP ,&chk STR #05 SFT #01 AND
            .Screen/pixel DEO

            ( jump if x < width )
            ,&x LDR2 .Screen/width DEI2 LTH2 ,&loop-x JCN

        ( jump if y < height )
        ,&y LDR2 .Screen/height DEI2 LTH2 ,&loop-y JCN

    BRK

    &x $2
    &y $2
    &chk $1`;

export const preset: UxnPreset = {
  type: 'uxn',
  description: 'Animated checkerboard by Keijiro',
  data: { code }
};
