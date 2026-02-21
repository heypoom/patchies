import { WrappingStack } from './wrapping-stack';

export interface ByteBeatExtra {
  mouseX: number;
  mouseY: number;
  width: number;
  height: number;
  tiltX: number;
  tiltY: number;
  compass: number;
  sampleRate?: number;
}

export interface ByteBeatContext {
  console: {
    Math: {
      log: (...args: unknown[]) => void;
    };
  };
}

export interface CompiledExpression {
  f: (
    t: number,
    i: number,
    stack: WrappingStack,
    ctx: ByteBeatContext,
    extra: ByteBeatExtra
  ) => number | [number, number];
  array: boolean;
  expression: string;
}

export class ByteBeatCompiler {
  static strip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  static removeCommentsAndLineBreaks(x: string): string {
    x = x.replace(/\/\/.*/g, ' ');
    x = x.replace(/\n/g, ' ');
    x = x.replace(/\/\*.*?\*\//g, ' ');
    return x;
  }

  static is2NumberArray(v: unknown): v is [number, number] {
    return (
      Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number'
    );
  }

  static applyPostfixTemplate(params: { exp: string }): string {
    return `
      return function(t, i, stack, window, extra) {
        ${params.exp}
      };
    `;
  }

  static postfixToInfix(x: string): string {
    x = ByteBeatCompiler.removeCommentsAndLineBreaks(x);
    x = x.replace(/(\r\n|\r|\n|\t| )+/gm, ' ');
    const tokens = ByteBeatCompiler.strip(x).split(' ');
    const steps: string[] = [];

    for (let i = 0; i < tokens.length; ++i) {
      const token = tokens[i];
      switch (token.toLowerCase()) {
        case '>':
          steps.push('var v1 = stack.pop();');
          steps.push('var v2 = stack.pop();');
          steps.push('stack.push((v1 < v2) ? 0xFFFFFFFF : 0);');
          break;
        case '<':
          steps.push('var v1 = stack.pop();');
          steps.push('var v2 = stack.pop();');
          steps.push('stack.push((v1 > v2) ? 0xFFFFFFFF : 0);');
          break;
        case '=':
          steps.push('var v1 = stack.pop();');
          steps.push('var v2 = stack.pop();');
          steps.push('stack.push((v2 == v1) ? 0xFFFFFFFF : 0);');
          break;
        case 'drop':
          steps.push('stack.pop();');
          break;
        case 'dup':
          steps.push('stack.push(stack.pick(0));');
          break;
        case 'swap':
          steps.push('var a1 = stack.pop();');
          steps.push('var a0 = stack.pop();');
          steps.push('stack.push(a1);');
          steps.push('stack.push(a0);');
          break;
        case 'pick':
          steps.push('var a0 = stack.pop();');
          steps.push('stack.push(stack.pick(a0));');
          break;
        case 'put':
          steps.push('var a0 = stack.pop();');
          steps.push('var a1 = stack.pick(0);');
          steps.push('stack.put(a0, a1);');
          break;
        case 'abs':
        case 'sqrt':
        case 'round':
        case 'tan':
        case 'log':
        case 'exp':
        case 'sin':
        case 'cos':
        case 'floor':
        case 'ceil':
        case 'int':
          steps.push('var a0 = stack.pop();');
          steps.push('stack.push(' + token + '(a0));');
          break;
        case 'max':
        case 'min':
        case 'pow':
          steps.push('var a0 = stack.pop();');
          steps.push('var a1 = stack.pop();');
          steps.push('stack.push(' + token + '(a1, a0));');
          break;
        case 'random':
          steps.push('stack.push(' + token + '());');
          break;
        case '/':
        case '+':
        case '-':
        case '*':
        case '%':
        case '>>':
        case '<<':
        case '|':
        case '&':
        case '^':
        case '&&':
        case '||':
          steps.push('var a1 = stack.pop();');
          steps.push('var a0 = stack.pop();');
          steps.push('stack.push((a0 ' + token + ' a1) | 0);');
          break;
        case '~':
          steps.push('var a0 = stack.pop();');
          steps.push('stack.push(~a0);');
          break;
        default:
          steps.push('stack.push(' + token + ');');
          break;
      }
    }

    steps.push('return stack.pop();');

    return ByteBeatCompiler.applyPostfixTemplate({
      exp: steps.join('\n')
    });
  }

  static glitchToPostfix(x: string): string {
    const glitchToPostfixConversion: Record<string, string> = {
      a: 't',
      b: 'put',
      c: 'drop',
      d: '*',
      e: '/',
      f: '+',
      g: '-',
      h: '%',
      j: '<<',
      k: '>>',
      l: '&',
      m: '|',
      n: '^',
      o: '~',
      p: 'dup',
      q: 'pick',
      r: 'swap',
      s: '<',
      t: '>',
      u: '=',
      '/': '//',
      '!': '\n',
      '.': ' '
    };

    const isCapitalHex = (c: string): boolean => {
      return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F');
    };

    const postfix: string[] = [];

    x = x.replace('glitch://', '');
    x = ByteBeatCompiler.removeCommentsAndLineBreaks(x);
    x = x.replace('glitch:', '');
    x = x.replace(/^[^!]*!/, '');

    for (let i = 0; i < x.length; ++i) {
      let done = false;
      let imd = '';
      let c: string | undefined;

      while (!done) {
        c = x[i];
        if (c && isCapitalHex(c)) {
          imd = imd + c;
          ++i;
        } else {
          done = true;
          if (imd.length) {
            --i;
            c = '0x' + imd;
          }
        }
      }

      postfix.push(c ? glitchToPostfixConversion[c] || c : '');
    }

    return postfix.join(' ');
  }

  static makeContext(): ByteBeatContext {
    return {
      console: {
        Math: {
          log: console.log.bind(console)
        }
      }
    };
  }

  static makeExtra(): ByteBeatExtra {
    return {
      mouseX: 0,
      mouseY: 0,
      width: 1,
      height: 1,
      tiltX: 0,
      tiltY: 0,
      compass: 0
    };
  }

  static s_fnHeader = ((): string => {
    const windowKeep = new Set(['parseInt', 'parseFloat', 'Array', 'isNaN']);
    const filter = (n: string) => !windowKeep.has(n);
    const keys: Record<string, boolean> = {};

    Object.getOwnPropertyNames(globalThis)
      .filter(filter)
      .forEach((key) => {
        keys[key] = true;
      });
    delete keys['Math'];
    delete keys['window'];

    const mathGlobals = Object.getOwnPropertyNames(Math)
      .map((key) => {
        return `${key} = Math.${key}`;
      })
      .join(',\n');

    return `
      {try { (0['constructor']['constructor'].prototype.constructor = '') } catch (e) {}};
      var ${Object.keys(keys).sort().join(',\n')};
      var console = { log() {}, info() {}, error() {}, warn() {} };
      var ${mathGlobals};
    `;
  })();

  static expressionStringToFn(
    evalExp: string,
    extra: ByteBeatExtra,
    test: boolean
  ): { f: CompiledExpression['f']; array: boolean } {
    const fp = new Function('stack', 'window', 'extra', evalExp);
    let f = fp(undefined, undefined, undefined);
    const ctx = ByteBeatCompiler.makeContext();
    const stack = new WrappingStack();
    const tempExtra = Object.assign({}, extra);

    let v = f.call(ctx, 0, 0, stack, ctx, tempExtra);
    if (typeof v === 'function') {
      f = f();
      v = f.call(ctx, 0, 0, stack, ctx, tempExtra);
    }

    const array = ByteBeatCompiler.is2NumberArray(v);

    if (test) {
      for (let i = 0; i < 1000; i += 100) {
        let s = f(i, i, stack, ctx, tempExtra);
        if (typeof s === 'function') {
          f = f();
          s = 0;
        }
        if (ByteBeatCompiler.is2NumberArray(s)) {
          continue;
        }
        if (typeof s !== 'number') {
          throw new Error('NaN');
        }
      }
    }

    return { f, array };
  }

  static compileExpression(
    x: string,
    expressionType: number,
    extra: ByteBeatExtra
  ): CompiledExpression {
    let evalExp: string = '';

    try {
      if (expressionType === 3) {
        // function
        x = `
          return function(t, i, stack, window, extra) {
            ${ByteBeatCompiler.strip(x)};
          }`;
      } else {
        if (expressionType === 2) {
          // glitch
          x = ByteBeatCompiler.glitchToPostfix(x);
          expressionType = 1;
        }
        if (expressionType === 1) {
          // postfix
          x = ByteBeatCompiler.postfixToInfix(x);
        } else {
          // infix
          x = `
            return function(t, i, stack, window, extra) {
              return 0,${ByteBeatCompiler.strip(x)};
            }`;
        }
      }

      function replacer(str: string, obj: Record<string, unknown>, p1: string, name: string) {
        return Object.prototype.hasOwnProperty.call(obj, p1) ? name + p1 : str;
      }

      x = x.replace(/\bint\b/g, 'floor');
      x = x.replace(/\bimport\b/g, 'notimport');
      x = x.replace(/(?:extra\.)?(\w+)/g, function (substr, p1) {
        return replacer(substr, extra as unknown as Record<string, unknown>, p1, 'extra.');
      });

      evalExp = `${ByteBeatCompiler.s_fnHeader}${x}`;

      const result = ByteBeatCompiler.expressionStringToFn(evalExp, extra, true);
      return {
        ...result,
        expression: evalExp
      };
    } catch (e) {
      if (e instanceof Error && e.stack) {
        const m = /<anonymous>:1:(\d+)/.exec(e.stack);
        if (m) {
          const charNdx = parseInt(m[1]);
          console.error(e.stack);
          console.error(
            evalExp.substring(0, charNdx),
            '-----VVVVV-----\n',
            evalExp.substring(charNdx)
          );
        }
      } else {
        console.error(e);
      }
      throw e;
    }
  }
}
