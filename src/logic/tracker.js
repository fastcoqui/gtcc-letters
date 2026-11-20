export const TRACKER_KEY = 'gtcc-letters-tracker-v1';

export const TRACKER_FIELDS = [
  'key', 'asOf', 'last', 'first', 'mi', 'bde', 'hier5', 'hier6', 'acctLast4',
  'accountStatus', 'qualifier', 'category', 'oldest', 'd30', 'd60', 'd90', 'd120',
  'd150', 'd180', 'b120', 'delinquent', 'pastDue', 'balance', 'email', 'confidence',
  'matchNote', 'needsReview', 'reviewReason', 'status', 'dtsOrg', 'grade', 'rank',
  'rankEdited', 'rankOverride', 'emailEdited', 'emailOverride', 'dtaCc', 'dtaText',
  'phone', 'supervisor', 'notes', 'letterCreated', 'draftCreated', 'emailedDate',
  'onReport', 'priorLetterCount', 'priorCycles', 'priorCategory',
];

const EXPORT_HEADERS = [
  ['key', 'Key'],
  ['asOf', 'As Of'],
  ['last', 'Last Name'],
  ['first', 'First Name'],
  ['mi', 'MI'],
  ['bde', 'BDE'],
  ['category', 'Category'],
  ['oldest', 'Oldest Bucket'],
  ['delinquent', 'Delinquent Amount'],
  ['pastDue', 'Past Due Amount'],
  ['balance', 'Current Balance'],
  ['acctLast4', 'Account Last 4'],
  ['email', 'Email'],
  ['rank', 'Rank'],
  ['dtaCc', 'DTA CC'],
  ['status', 'Status'],
  ['letterCreated', 'Letter Created'],
  ['emailedDate', 'Emailed Date'],
  ['priorLetterCount', 'Prior Letter Count'],
  ['priorCycles', 'Prior Cycles'],
  ['priorCategory', 'Prior Category'],
  ['onReport', 'On Report'],
  ['needsReview', 'Needs Review'],
  ['reviewReason', 'Review Reason'],
  ['confidence', 'Match'],
  ['phone', 'Phone'],
  ['supervisor', 'Supervisor Email'],
  ['notes', 'Notes'],
];

export function effectiveEmail(row) {
  if (row?.emailEdited) return String(row.emailOverride ?? '').trim();
  return String(row?.email ?? '').trim();
}

export function effectiveRank(row) {
  if (row?.rankEdited) return String(row.rankOverride ?? '').trim();
  return String(row?.rank ?? '').trim();
}

export function sanitizeTrackerRow(row) {
  const out = {};
  for (const key of TRACKER_FIELDS) {
    if (row && Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  }
  return out;
}

export function collectManuals(existing) {
  const manuals = new Map();
  for (const old of existing || []) {
    if (!old?.key) continue;
    const current = manuals.get(old.key) || {};
    if (old.emailEdited) {
      current.emailEdited = true;
      current.emailOverride = old.emailOverride ?? '';
    }
    if (old.rankEdited) {
      current.rankEdited = true;
      current.rankOverride = old.rankOverride ?? '';
    }
    if (old.phone) current.phone = old.phone;
    if (old.supervisor) current.supervisor = old.supervisor;
    if (old.notes) current.notes = old.notes;
    manuals.set(old.key, current);
  }
  return manuals;
}

export function mergeTracker(existing, incoming, asofKey) {
  const incomingKeys = new Set((incoming || []).map((row) => row.key));
  const priorLetters = {};
  const priorCycles = {};
  const priorCat = {};
  const priorAsof = {};
  for (const old of existing || []) {
    if (!old?.key || old.asOf === asofKey) continue;
    priorCycles[old.key] = (priorCycles[old.key] || 0) + 1;
    if (old.letterCreated) priorLetters[old.key] = (priorLetters[old.key] || 0) + 1;
    if (!priorAsof[old.key] || String(old.asOf) >= priorAsof[old.key]) {
      priorAsof[old.key] = String(old.asOf);
      priorCat[old.key] = old.category || '';
    }
  }
  const prevSame = {};
  for (const old of existing || []) {
    if (old?.key && old.asOf === asofKey) prevSame[old.key] = old;
  }
  const kept = [];
  for (const old of existing || []) {
    if (!old?.key) continue;
    if (old.asOf === asofKey && incomingKeys.has(old.key)) continue;
    const copy = sanitizeTrackerRow(old);
    if (incomingKeys.has(old.key)) {
      copy.onReport = 'Superseded';
    } else {
      copy.onReport = 'N';
      if (copy.status !== 'Emailed' && copy.status !== 'Resolved') copy.status = 'Not on latest report';
    }
    kept.push(copy);
  }
  const fresh = (incoming || []).map((row) => {
    const prev = prevSame[row.key];
    const merged = sanitizeTrackerRow({
      ...row,
      priorLetterCount: priorLetters[row.key] || 0,
      priorCycles: priorCycles[row.key] || 0,
      priorCategory: priorCat[row.key] || '',
      notes: prev?.notes || row.notes || '',
      letterCreated: prev?.letterCreated || '',
      draftCreated: prev?.draftCreated || '',
      emailedDate: prev?.emailedDate || '',
      phone: row.phone || prev?.phone || '',
      supervisor: row.supervisor || prev?.supervisor || '',
    });
    if (prev) {
      if (['Emailed', 'Resolved', 'Draft in Outlook', 'Letter created'].includes(prev.status)) {
        merged.status = prev.status;
      }
      if (prev.emailedDate && prev.status !== 'Resolved') merged.status = 'Emailed';
    }
    return merged;
  });
  return [...kept, ...fresh];
}

export function loadTracker(storage) {
  try {
    const raw = storage.getItem(TRACKER_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(sanitizeTrackerRow);
  } catch {
    return [];
  }
}

export function saveTracker(storage, rows) {
  storage.setItem(TRACKER_KEY, JSON.stringify((rows || []).map(sanitizeTrackerRow)));
}

export function trackerToAoa(rows) {
  const header = EXPORT_HEADERS.map(([, label]) => label);
  const body = (rows || []).map((row) => EXPORT_HEADERS.map(([key]) => {
    const value = row[key];
    if (typeof value === 'boolean') return value ? 'Y' : 'N';
    return value ?? '';
  }));
  return [header, ...body];
}

export function trackerFromMatrix(matrix) {
  if (!matrix?.length) return [];
  const header = matrix[0].map((cell) => String(cell ?? '').trim().toLowerCase());
  const indexOf = (...names) => {
    for (const name of names) {
      const found = header.indexOf(name.toLowerCase());
      if (found >= 0) return found;
    }
    return -1;
  };
  const cols = {
    key: indexOf('key'),
    asOf: indexOf('as of', 'as-of', 'asof'),
    last: indexOf('last name', 'last'),
    first: indexOf('first name', 'first'),
    mi: indexOf('mi', 'middle initial'),
    bde: indexOf('bde'),
    category: indexOf('category'),
    oldest: indexOf('oldest bucket', 'oldest'),
    delinquent: indexOf('delinquent amount', 'delinquent'),
    pastDue: indexOf('past due amount', 'past due'),
    balance: indexOf('current balance', 'balance'),
    acctLast4: indexOf('account last 4', 'acct last 4', 'last 4'),
    email: indexOf('email'),
    rank: indexOf('rank'),
    dtaCc: indexOf('dta cc', 'dta'),
    status: indexOf('status'),
    letterCreated: indexOf('letter created'),
    emailedDate: indexOf('emailed date', 'emailed'),
    priorLetterCount: indexOf('prior letter count'),
    priorCycles: indexOf('prior cycles'),
    priorCategory: indexOf('prior category'),
    onReport: indexOf('on report'),
    needsReview: indexOf('needs review'),
    reviewReason: indexOf('review reason'),
    confidence: indexOf('match', 'confidence'),
    phone: indexOf('phone'),
    supervisor: indexOf('supervisor email', 'supervisor'),
    notes: indexOf('notes'),
  };
  const ignored = header.some((name) => name === 'ssn' || name === 'social security number' || name === 'account number');
  const rows = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const line = matrix[r] || [];
    const get = (col) => (col >= 0 ? String(line[col] ?? '').trim() : '');
    const key = get(cols.key);
    if (!key && !get(cols.last) && !get(cols.first)) continue;
    const needs = get(cols.needsReview);
    rows.push(sanitizeTrackerRow({
      key: key || `${get(cols.last)}_${get(cols.first)}`.toUpperCase(),
      asOf: get(cols.asOf),
      last: get(cols.last),
      first: get(cols.first),
      mi: get(cols.mi),
      bde: get(cols.bde),
      category: get(cols.category),
      oldest: get(cols.oldest),
      delinquent: Number(get(cols.delinquent).replace(/[$,]/g, '')) || 0,
      pastDue: get(cols.pastDue) === '' ? null : Number(get(cols.pastDue).replace(/[$,]/g, '')),
      balance: get(cols.balance) === '' ? null : Number(get(cols.balance).replace(/[$,]/g, '')),
      acctLast4: get(cols.acctLast4).replace(/\D/g, '').slice(-4),
      email: get(cols.email),
      rank: get(cols.rank),
      dtaCc: get(cols.dtaCc),
      status: get(cols.status) || 'Ready',
      letterCreated: get(cols.letterCreated),
      emailedDate: get(cols.emailedDate),
      priorLetterCount: Number(get(cols.priorLetterCount)) || 0,
      priorCycles: Number(get(cols.priorCycles)) || 0,
      priorCategory: get(cols.priorCategory),
      onReport: get(cols.onReport) || 'Y',
      needsReview: needs === 'Y' || needs.toLowerCase() === 'true',
      reviewReason: get(cols.reviewReason),
      confidence: get(cols.confidence),
      phone: get(cols.phone),
      supervisor: get(cols.supervisor),
      notes: get(cols.notes),
      ignoredSensitiveColumns: ignored,
    }));
  }
  return rows;
}
