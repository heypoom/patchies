# 50. Uxntal

I want to implement a `uxn` node for [Uxn](https://wiki.xxiivv.com/site/uxntal.html) for Patchies.

We can use one of these web-friendly implementations:
- [uxn.wasm](https://mko.re/blog/uxn-wasm/), compiled to WebAssembly, quite fast
  - https://www.jsdelivr.com/package/npm/uxn.wasm
  - https://cdn.jsdelivr.net/npm/uxn.wasm@0.9.0/dist/uxn.esm.min.js
  - It is a drop-in replacement for the uxn5 vanilla JS core.
- [uxn5](https://git.sr.ht/~rabbits/uxn5), Varvara Ordinator written in JavaScript.
  - demo: https://rabbits.srht.site/uxn5

[Varvara](https://wiki.xxiivv.com/site/varvara.html), "Varvara is a specification for devices communicating with the Uxn virtual machine intended to run little audio and visual programs. To see a list of compatible software, see roms, and the community projects."

I want to also eventually create an `orca` node for the [Orca programming language](https://github.com/hundredrabbits/Orca)

### Uxn.wasm example

See https://mko.re/blog/uxn-wasm

> Even though uxn.wasm was designed as a drop-in core for Uxn5, uxn.wasm is also packaged so you can use it in JavaScript without requiring Uxn5 (which isn’t packaged).

> The uxn.wasm npm module ships with extra utilities under the util submodule to easily run Uxn programs, including a Uxntal assembler (asm), and utility devices (e.g. a LogConsole console device that logs output to console).

> The example below runs a Uxntal program to compute prime numbers below 65536, and writes them to the console.

```
import { Uxn } from "uxn.wasm";
import { asm, mux, LogConsole } from "uxn.wasm/util";

(async () => {
  const uxn = new Uxn();

  // Initialize the system with 1 device: a console at device offset 0x10 that
  // logs output using `console.log`.
  await uxn.init(mux(uxn, { 0x10: new LogConsole() }));

  // Assemble the program written in Uxntal assembly language into a binary ROM 
  // using `asm`, and load it into the core.
  uxn.load(
    asm(`
( Source: https://git.sr.ht/~rabbits/uxn/tree/main/item/projects/examples/exercises )

|0100 ( -> ) @reset
  #0000 INC2k
  &loop
    DUP2 not-prime ?&skip
      DUP2 print/short #2018 DEO
      &skip
    INC2 NEQ2k ?&loop
  POP2 POP2
  ( flush ) #0a18 DEO
  ( halt ) #010f DEO
BRK

@not-prime ( number* -- flag )
  DUP2 ,&t STR2
  ( range ) #01 SFT2 #0002 LTH2k ?&fail
  &loop
    [ LIT2 &t $2 ] OVR2 ( mod2 ) DIV2k MUL2 SUB2 ORA ?&continue
      &fail POP2 POP2 #01 JMP2r &continue
    INC2 GTH2k ?&loop
  POP2 POP2 #00
JMP2r

@print ( short* -- )
  &short ( short* -- ) SWP print/byte
  &byte  ( byte   -- ) DUP #04 SFT print/char
  &char  ( char   -- ) #0f AND DUP #09 GTH #27 MUL ADD #30 ADD #18 DEO
JMP2r
`)
  );

  // Start running at the default offset (0x100)
  uxn.eval();
})();
```

### Uxn5 example

```
const uxn = new Uxn()
uxn.load(program).eval(0x0100)
```
