import type { StarlightRouteData } from "@astrojs/starlight/route-data";

export type LinkEntry = Extract<StarlightRouteData["sidebar"][number], { type: "link" }>;
export type GroupEntry = Extract<StarlightRouteData["sidebar"][number], { type: "group" }>;
export type SidebarEntry = LinkEntry | GroupEntry;

/**
 * Get the top-level Sidebar group corresponding to the current path
 */
export function findActiveGroup(entries: SidebarEntry[], path: string): GroupEntry | null {
  for (const entry of entries) {
    if (entry.type === "group") {
      const hasMatch = entry.entries.some(
        (e): e is LinkEntry => e.type === "link" && typeof e.href === "string" && path.startsWith(e.href)
      );

      if (hasMatch) return entry;

      const subGroup = findActiveGroup(entry.entries, path);
      if (subGroup) return entry;
    }
  }
  return null;
}

/**
 * Get all link entries from sidebar entries (flattened)
 */
export function getAllLinks(entries: SidebarEntry[]): LinkEntry[] {
  const links: LinkEntry[] = [];
  for (const entry of entries) {
    if (entry.type === "link") {
      links.push(entry);
    } else if (entry.type === "group") {
      links.push(...getAllLinks(entry.entries));
    }
  }
  return links;
}

/**
 * Get filtered sidebar entries for the current path
 */
export function getFilteredSidebar(sidebar: SidebarEntry[], pathname: string): SidebarEntry[] {
  const activeGroup = findActiveGroup(sidebar, pathname);
  return activeGroup ? activeGroup.entries : [];
}

/**
 * Flatten sidebar entries to a simple array of links with current page info
 */
export function flattenSidebar(
  entries: SidebarEntry[],
  currentPath: string
): Array<LinkEntry & { isCurrent: boolean }> {
  const links: Array<LinkEntry & { isCurrent: boolean }> = [];

  function flatten(items: SidebarEntry[]) {
    for (const item of items) {
      if (item.type === "link") {
        links.push({
          ...item,
          isCurrent: item.href === currentPath,
        });
      } else if (item.type === "group") {
        flatten(item.entries);
      }
    }
  }

  flatten(entries);
  return links;
}
