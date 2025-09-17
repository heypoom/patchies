import * as wasm from "./machine_bg.wasm";
export * from "./machine_bg.js";
import { __wbg_set_wasm } from "./machine_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
