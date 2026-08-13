export function getBorderChromeClass({
  hasError = false,
  selected = false,
  noBorder = false,
  errorClass,
  selectedClass,
  idleClass,
  borderlessClass
}: {
  hasError?: boolean;
  selected?: boolean;
  noBorder?: boolean;
  errorClass: string;
  selectedClass: string;
  idleClass: string;
  borderlessClass: string;
}) {
  if (hasError) return errorClass;
  if (noBorder) return borderlessClass;
  if (selected && !noBorder) return selectedClass;

  return idleClass;
}

export function getBorderResetDataForRun({ noBorder = false }: { noBorder?: boolean }) {
  return noBorder ? { noBorder: false } : {};
}
