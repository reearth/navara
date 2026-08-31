import sectionsData from "../data/sections.json";

/**
 * Public top-level documentation sections and their families, powering the
 * sidebar section switcher. Data lives in `../data/sections.json` — add a
 * section (and optionally a `family`) there. `engine` is intentionally omitted
 * while it is non-public; locale directories (e.g. `ja`) are not sections.
 */
export interface SectionDef {
  /** Top-level directory name under `src/content/docs/` and first URL segment. */
  slug: string;
  /** Display label (English / root locale). */
  label: string;
  /** Display label for the `ja` locale. */
  labelJa: string;
  /** Landing page path for the section (root locale, leading slash). */
  href: string;
  /** Optional family id (see `families`) used to group sections in the switcher. */
  family?: string;
}

export interface FamilyDef {
  id: string;
  label: string;
  labelJa: string;
}

export const families: FamilyDef[] = sectionsData.families;
export const sections: SectionDef[] = sectionsData.sections;

/** Localized display label for a section slug. Falls back to the raw slug. */
export function sectionLabel(slug: string | undefined, locale: string | undefined): string {
  const section = sections.find((s) => s.slug === slug);
  if (!section) return slug ?? "";
  return locale === "ja" ? section.labelJa : section.label;
}

/** Localized display label for a family id. Falls back to the raw id. */
export function familyLabel(id: string, locale: string | undefined): string {
  const family = families.find((f) => f.id === id);
  if (!family) return id;
  return locale === "ja" ? family.labelJa : family.label;
}

/** Site base path without a trailing slash (e.g. `/docs`), `""` when serving at the root. */
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Landing href for a section, prefixed with the site base and the current locale. */
export function localizedHref(href: string, locale: string | undefined): string {
  return locale === "ja" ? `${base}/ja${href}` : `${base}${href}`;
}

/** URL path segments with the site base stripped (e.g. `/docs/ja/three/` → `["ja", "three"]`). */
export function pathSegmentsWithoutBase(pathname: string): string[] {
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return path.split("/").filter(Boolean);
}
