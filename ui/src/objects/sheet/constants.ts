import type { SheetData } from './sheet-utils';

export const DEFAULT_SHEET_DATA: SheetData = {
  columns: ['column 1', 'column 2'],
  rows: [
    ['', ''],
    ['', '']
  ],
  outputRows: false,
  allowResize: true,
  showFooter: true,
  autoFitHeight: true
};
