export const asmPrompt = `## asm Object Instructions

Virtual stack machine assembly interpreter inspired by TIS-100 and Shenzhen I/O.

CRITICAL RULES:
1. Stack-based assembly language
2. Over 50 assembly instructions
3. Line-by-line instruction highlighting
4. External memory cells via asm.mem

Available instructions:
- Stack: PUSH, POP, DUP, SWAP, OVER, ROT
- Arithmetic: ADD, SUB, MUL, DIV, MOD, NEG
- Comparison: EQ, NEQ, LT, GT, LTE, GTE
- Logic: AND, OR, NOT, XOR
- Control: JMP, JZ, JNZ, CALL, RET, HALT
- I/O: IN, OUT, PEEK, POKE
- Memory: LOAD, STORE

HANDLE IDS (Auto-generated):
- LIMITATION: No handles for assembly programs
- Assembly nodes don't have traditional I/O ports
- Configure internally via stack/memory operations

Example - Simple Counter:
\`\`\`json
{
  "type": "asm",
  "data": {
    "code": "PUSH 0\\nLOOP:\\nDUP\\nOUT 0\\nPUSH 1\\nADD\\nJMP LOOP"
  }
}
\`\`\`

Example - Fibonacci:
\`\`\`json
{
  "type": "asm",
  "data": {
    "code": "PUSH 0\\nPUSH 1\\nLOOP:\\nDUP\\nOUT 0\\nSWAP\\nOVER\\nADD\\nJMP LOOP"
  }
}
\`\`\``;
