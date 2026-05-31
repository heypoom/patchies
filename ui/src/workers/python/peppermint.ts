import type { PyodideAPI } from 'pyodide';

const PEPPERMINT_PACKAGE = 'peppermint-lang==0.4.0a2';

const EXECUTE_PEPPERMINT_CODE = `
from peppermint.interpreter import Interpreter, Ok, Err
from peppermint.parser import parse
from peppermint.stdlib import build_global_env
from peppermint.context import Context
from pyodide.ffi import to_js
from js import Object
import patch

def __patchies_unwrap(value):
    if isinstance(value, Ok):
        return __patchies_unwrap(value.value)
    if isinstance(value, Err):
        return {"type": "Err", "message": value.msg}
    if isinstance(value, Context):
        return value.data
    return value

def __patchies_input(*_args, **_kwargs):
    return __patchies_pep_input

def __patchies_print(value=None, *_args, **_kwargs):
    output = __patchies_unwrap(value)
    patch.send(
        to_js(output, dict_converter=Object.fromEntries),
        to_js({"to": 0}, dict_converter=Object.fromEntries),
    )
    return value

env = build_global_env()
env.set("input", __patchies_input)
env.set("print", __patchies_print)
interp = Interpreter(env, quiet=True)
__patchies_result = interp.run(parse(__patchies_pep_src))
None if __patchies_result is None else repr(__patchies_result)
`;

export class PeppermintPyodideRuntime {
  private readyNodeIds = new Set<string>();

  async execute(pyodide: PyodideAPI, nodeId: string, code: string, input: unknown) {
    await this.ensureReady(pyodide, nodeId);

    pyodide.globals.set('__patchies_pep_src', code);
    pyodide.globals.set('__patchies_pep_input', pyodide.toPy(input));

    return pyodide.runPythonAsync(EXECUTE_PEPPERMINT_CODE);
  }

  delete(nodeId: string) {
    this.readyNodeIds.delete(nodeId);
  }

  private async ensureReady(pyodide: PyodideAPI, nodeId: string) {
    if (this.readyNodeIds.has(nodeId)) {
      return;
    }

    await pyodide.loadPackage(['micropip', 'pandas'], {
      messageCallback: () => {},
      errorCallback: () => {},
      checkIntegrity: false
    });

    await pyodide.runPythonAsync(`
import micropip
await micropip.install("${PEPPERMINT_PACKAGE}")
`);

    this.readyNodeIds.add(nodeId);
  }
}
