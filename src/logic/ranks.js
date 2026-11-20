/**
 * Paygrade to rank crosswalk.
 * The original workbook Lists sheet (the VBA rank table) was not in the uploaded source.
 * This is a standard Army paygrade map. Ambiguous grades are flagged for review.
 * A DTS Title/Rank that is already a rank abbreviation is used as-is.
 */

const RANK_MAP = {
  E1: ['PV1', ''],
  E2: ['PV2', ''],
  E3: ['PFC', ''],
  E4: ['SPC', 'CPL'],
  E5: ['SGT', ''],
  E6: ['SSG', ''],
  E7: ['SFC', ''],
  E8: ['MSG', '1SG'],
  E9: ['SGM', 'CSM'],
  O1: ['2LT', ''],
  O2: ['1LT', ''],
  O3: ['CPT', ''],
  O4: ['MAJ', ''],
  O5: ['LTC', ''],
  O6: ['COL', ''],
  O7: ['BG', ''],
  O8: ['MG', ''],
  O9: ['LTG', ''],
  O10: ['GEN', ''],
  W1: ['WO1', ''],
  W2: ['CW2', ''],
  W3: ['CW3', ''],
  W4: ['CW4', ''],
  W5: ['CW5', ''],
  CIV: ['CIV', ''],
  GS: ['CIV', ''],
};

const KNOWN_RANKS = new Set(
  Object.values(RANK_MAP).flatMap(([rank, alt]) => [rank, alt].filter(Boolean)),
);

export function rankOf(grade) {
  const key = String(grade ?? '').toUpperCase().trim();
  if (!key) return '';
  if (RANK_MAP[key]) return RANK_MAP[key][0];
  if (KNOWN_RANKS.has(key)) return key;
  return '';
}

export function rankAmbiguity(grade) {
  const key = String(grade ?? '').toUpperCase().trim();
  if (!RANK_MAP[key]) return '';
  return RANK_MAP[key][1] || '';
}
