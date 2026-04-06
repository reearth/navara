import folderTranslationsJson from "../data/folderTranslations.json";

const folderTranslations: Record<string, Record<string, string>> = folderTranslationsJson;

/**
 * Translate a folder name for the given locale.
 * Returns the original name for root/English or if no translation exists.
 */
export function translateFolderName(
  folderName: string,
  locale: string | undefined
): string {
  if (!locale) return folderName;
  return folderTranslations[locale]?.[folderName] ?? folderName;
}

/**
 * Get a localized field from an object with a `translations` map.
 * Falls back to the top-level English field if no translation exists.
 */
export function getLocalizedField(
  item: {
    [key: string]: unknown;
    translations?: Record<string, Record<string, string>>;
  },
  field: string,
  locale: string | undefined
): string {
  if (locale && item.translations?.[locale]?.[field]) {
    return item.translations[locale][field];
  }
  return (item[field] as string) ?? "";
}
