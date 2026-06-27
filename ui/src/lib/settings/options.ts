import type { SettingsOption } from './types';

export function normalizeSettingsOptions(options: SettingsOption[] | string[]): SettingsOption[] {
  if (options.length === 0 || typeof options[0] !== 'string') {
    return options as SettingsOption[];
  }

  return (options as string[]).map((option) => ({ label: option, value: option }));
}

export function filterSettingsOptions(
  options: SettingsOption[],
  query: string,
  limit = options.length
): SettingsOption[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return options.slice(0, limit);

  return options
    .filter((option) => {
      const haystack = normalizeSearchText(
        `${option.label} ${option.value} ${option.description ?? ''}`
      );

      return normalizedQuery
        .split(/\s+/)
        .every((queryPart) => queryPart === '' || haystack.includes(queryPart));
    })
    .slice(0, limit);
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_/-]+/g, ' ')
    .trim();
}
