import { preset as preset0 } from './brainfuck';
import { preset as preset1 } from './conway';
import { preset as preset2 } from './mergesort';
import { preset as preset3 } from './quicksort';
import { preset as preset4 } from './basics';
import { preset as preset5 } from './each';
import { preset as preset6 } from './error-handling';
import { preset as preset7 } from './errors';
import { preset as preset8 } from './interpolation';
import { preset as preset9 } from './namespace';
import { preset as preset10 } from './railway';
import { preset as preset11 } from './strings';
import { preset as preset12 } from './transform';
import { preset as preset13 } from './unary';
import { preset as preset14 } from './aggregation';
import { preset as preset15 } from './collapse-lambda';
import { preset as preset16 } from './context';
import { preset as preset17 } from './each-lambda';
import { preset as preset18 } from './logs';
import { preset as preset19 } from './sales-analysis';

import type { PeppermintPreset } from './types';

export const PEPPERMINT_PRESETS: Record<string, PeppermintPreset> = {
  'brainfuck.pep': preset0,
  'conway.pep': preset1,
  'mergesort.pep': preset2,
  'quicksort.pep': preset3,
  'basics.pep': preset4,
  'each.pep': preset5,
  'error_handling.pep': preset6,
  'errors.pep': preset7,
  'interpolation.pep': preset8,
  'namespace.pep': preset9,
  'railway.pep': preset10,
  'strings.pep': preset11,
  'transform.pep': preset12,
  'unary.pep': preset13,
  'aggregation.pep': preset14,
  'collapse_lambda.pep': preset15,
  'context.pep': preset16,
  'each_lambda.pep': preset17,
  'logs.pep': preset18,
  'sales_analysis.pep': preset19
};

export const PEPPERMINT_PRESET_KEYS = Object.keys(PEPPERMINT_PRESETS);

export type { PeppermintPreset } from './types';
