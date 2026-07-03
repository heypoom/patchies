export function getBorderChromeClass({
  hasError = false,
  selected = false,
  hideBorder = false,
  errorClass,
  selectedClass,
  idleClass,
  borderlessClass
}: {
  hasError?: boolean;
  selected?: boolean;
  hideBorder?: boolean;
  errorClass: string;
  selectedClass: string;
  idleClass: string;
  borderlessClass: string;
}) {
  if (hasError) return errorClass;
  if (hideBorder) return borderlessClass;
  if (selected && !hideBorder) return selectedClass;

  return idleClass;
}

export function getBorderResetDataForRun({ hideBorder = false }: { hideBorder?: boolean }) {
  return hideBorder ? { hideBorder: false } : {};
}
