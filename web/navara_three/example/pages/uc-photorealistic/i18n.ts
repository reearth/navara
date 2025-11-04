import { useMemo } from "react";

export type SupportedLanguages = "ja"; // | "zh"

/**
 * Key: Label in `English`
 * Value: Label in `SupportedLanguages`
 */
export type LanguageDictionary = Record<
  string,
  Partial<Record<SupportedLanguages, string>>
>;

/**
 * Detect the current language from the browser
 */
const useLanguageDetection = (): string => {
  return useMemo(() => {
    const lang = navigator.language.toLowerCase();
    return lang.split("-")[0];
  }, []);
};

/**
 * Translate a label based on the current language and dictionary
 */
const translateLanguage = (
  lang: string,
  label: string,
  dictionary: LanguageDictionary,
) => {
  if (lang === "en") return label;
  return dictionary[label]?.[lang as SupportedLanguages] ?? label;
};

/**
 * Hook to use i18n in components
 */
export const useI18n = <D extends LanguageDictionary>(dictionary: D) => {
  const lang = useLanguageDetection();

  const translate = (label: keyof D) => {
    return translateLanguage(lang, label as string, dictionary);
  };

  return { translate, lang };
};
