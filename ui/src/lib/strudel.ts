import * as strudel from '@strudel/core';
import { superdough, doughTrigger } from 'superdough';
const { Pattern } = strudel;

export const hap2value = (hap) => {
	hap.ensureObjectValue();
	return hap.value;
};

// uses more precise, absolute t if available, see https://github.com/tidalcycles/strudel/pull/1004
// TODO: refactor output callbacks to eliminate deadline
export const webaudioOutput = (hap, _deadline, hapDuration, cps, t) => {
	return superdough(hap2value(hap), t, hapDuration, cps, hap.whole?.begin.valueOf());
};

Pattern.prototype.dough = function () {
	return this.onTrigger(doughTrigger, 1);
};
