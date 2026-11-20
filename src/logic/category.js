const LABELS = ['30', '60', '90', '120', '150', '180+'];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Delinquent when any aging bucket is above half a cent.
 * Category is the oldest bucket with a balance. 120, 150, and 180+ all count as 120+.
 */
export function categorize(row) {
  const vals = [row?.d30, row?.d60, row?.d90, row?.d120, row?.d150, row?.d180].map(num);
  let oldest = '';
  for (let i = 0; i < vals.length; i += 1) {
    if (vals[i] > 0.005) oldest = LABELS[i];
  }
  if (!oldest) return null;
  const category = oldest === '120' || oldest === '150' || oldest === '180+' ? '120+' : oldest;
  let delinquent = 0;
  for (const value of vals) {
    if (value > 0) delinquent += value;
  }
  return {
    oldest,
    category,
    delinquent,
    b120: vals[3] + vals[4] + vals[5],
    d30: vals[0],
    d60: vals[1],
    d90: vals[2],
    d120: vals[3],
    d150: vals[4],
    d180: vals[5],
  };
}

export function categoryLabel(category) {
  return String(category ?? '').replace('+', '');
}
