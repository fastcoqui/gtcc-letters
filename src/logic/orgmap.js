import { unitKey } from './normalize.js';

/**
 * Lines of `Unit name = org suffix`.
 * A suffix that does not already start with the DTS root is prefixed with it.
 * The original Lists-sheet unit crosswalk was not in the uploaded workbook;
 * the user pastes their own list here. Sample data ships a synthetic map only.
 */
export function parseOrgMap(text, root) {
  const map = new Map();
  const rootOrg = String(root ?? '').trim().toUpperCase();
  for (const line of String(text ?? '').split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const name = unitKey(trimmed.slice(0, eq));
    let suffix = trimmed.slice(eq + 1).trim().toUpperCase();
    if (!name || !suffix) continue;
    if (rootOrg && !suffix.startsWith(rootOrg)) suffix = `${rootOrg}${suffix}`;
    map.set(name, suffix);
  }
  return map;
}

export function orgFor(unitName, orgMap) {
  const key = unitKey(unitName);
  if (!key || !orgMap) return '';
  return orgMap.get(key) || '';
}
