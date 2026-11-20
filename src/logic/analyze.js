import { categorize } from './category.js';
import { dtasFor, indexContacts, matchContact } from './match.js';
import { nameKey } from './normalize.js';
import { orgFor, parseOrgMap } from './orgmap.js';
import { rankAmbiguity, rankOf } from './ranks.js';
import { collectManuals, mergeTracker, sanitizeTrackerRow } from './tracker.js';

function appendReason(reasons, text) {
  if (!text) return;
  reasons.push(text);
}

function assignKey(seen, last, first, middle, acctLast4) {
  const base = `${nameKey(last)}_${nameKey(first)}_${nameKey(middle).slice(0, 1)}`;
  seen[base] = (seen[base] || 0) + 1;
  if (seen[base] > 1) return acctLast4 ? `${base}_${acctLast4}` : `${base}_${seen[base]}`;
  return base;
}

function buildRow(raw, cat, contactIndex, orgMap, settings, seen, asOf, manual) {
  const expOrg = orgFor(raw.hier6, orgMap) || orgFor(raw.hier5, orgMap);
  const bdeOrg = orgFor(raw.hier5, orgMap);
  const matched = matchContact(contactIndex, raw.last, raw.first, raw.middle, expOrg, bdeOrg);
  let email = '';
  let confidence = matched.confidence;
  let note = matched.note;
  if (matched.index >= 0 && (confidence === 'HIGH' || confidence === 'MEDIUM' || confidence === 'LOW')) {
    email = contactIndex.contacts[matched.index].email;
  }
  const key = assignKey(seen, raw.last, raw.first, raw.middle, raw.acctLast4);
  let emailEdited = false;
  let emailOverride = '';
  let rankEdited = false;
  let rankOverride = '';
  if (manual?.emailEdited) {
    emailEdited = true;
    emailOverride = manual.emailOverride || '';
    email = emailOverride;
    confidence = 'OVERRIDE';
    note = `Email override (manual) from tracker; ${note}`;
  }
  if (manual?.rankEdited) {
    rankEdited = true;
    rankOverride = manual.rankOverride || '';
  }
  let startOrg = '';
  if (matched.index >= 0 && matched.confidence === 'HIGH') startOrg = contactIndex.contacts[matched.index].org;
  if (!startOrg) startOrg = expOrg;
  if (!startOrg && matched.index >= 0) startOrg = contactIndex.contacts[matched.index].org;
  const dtaIndexes = startOrg ? dtasFor(contactIndex, startOrg, email) : [];
  const maxListed = Number(settings.maxDtasListed) || 3;
  const dtaCc = dtaIndexes.map((i) => contactIndex.contacts[i].email).join('; ');
  const dtaText = dtaIndexes.slice(0, maxListed).map((i) => {
    const contact = contactIndex.contacts[i];
    const rank = rankOf(contact.rank);
    return `${rank ? `${rank} ` : ''}${contact.first} ${contact.last}, ${contact.email}`;
  }).join('; ');
  const grade = matched.index >= 0 ? contactIndex.contacts[matched.index].rank : '';
  let rank = '';
  if (rankEdited) rank = rankOverride;
  else if (settings.useDtsRank !== false) rank = rankOf(grade);
  const reasons = [];
  if (confidence === 'NONE' || confidence === 'AMBIGUOUS' || confidence === 'LOW') {
    appendReason(reasons, `Email match ${confidence}`);
  }
  if (confidence === 'MEDIUM') appendReason(reasons, 'DTS org outside report BDE - verify person/unit');
  if (email && !email.toLowerCase().endsWith('.mil')) {
    appendReason(reasons, 'Personal (non-.mil) email - confirm before sending PII');
  }
  if (!dtaIndexes.length) appendReason(reasons, 'No DTA found');
  if (rank && !rankEdited) {
    const ambiguity = rankAmbiguity(grade);
    if (ambiguity) appendReason(reasons, `Rank ${rank} from DTS grade ${grade} (could be ${ambiguity})`);
  }
  if (!rank) appendReason(reasons, 'Rank unknown');
  if (String(raw.accountStatus || '').toLowerCase() === 'closed') appendReason(reasons, 'Account closed');
  const needsReview = confidence === 'NONE' || confidence === 'AMBIGUOUS' || confidence === 'LOW' || dtaIndexes.length === 0;
  const status = confidence === 'NONE' || confidence === 'AMBIGUOUS' || !email ? 'Needs Review' : 'Ready';
  const miSource = String(raw.middle || '').trim();
  return sanitizeTrackerRow({
    key,
    asOf,
    last: raw.last || '',
    first: raw.first || '',
    mi: miSource ? miSource.charAt(0) : '',
    bde: raw.bde || '',
    hier5: raw.hier5 || '',
    hier6: raw.hier6 || '',
    acctLast4: raw.acctLast4 || '',
    accountStatus: raw.accountStatus || '',
    qualifier: raw.qualifier || '',
    category: cat.category,
    oldest: cat.oldest,
    d30: cat.d30,
    d60: cat.d60,
    d90: cat.d90,
    d120: cat.d120,
    d150: cat.d150,
    d180: cat.d180,
    b120: cat.b120,
    delinquent: cat.delinquent,
    pastDue: raw.pastDue ?? null,
    balance: raw.balance ?? null,
    email,
    confidence,
    matchNote: note,
    needsReview,
    reviewReason: reasons.join('; '),
    status,
    dtsOrg: matched.index >= 0 ? contactIndex.contacts[matched.index].org : '',
    grade,
    rank,
    rankEdited,
    rankOverride,
    emailEdited,
    emailOverride,
    dtaCc,
    dtaText,
    phone: manual?.phone || '',
    supervisor: manual?.supervisor || '',
    notes: manual?.notes || '',
    letterCreated: '',
    draftCreated: '',
    emailedDate: '',
    onReport: 'Y',
    priorLetterCount: 0,
    priorCycles: 0,
    priorCategory: '',
  });
}

export function analyzeReport({ reportRows, contactRows, settings, existingTracker }) {
  const contactIndex = indexContacts(contactRows || []);
  const orgMap = parseOrgMap(settings.unitMap || '', settings.dtsRoot || '');
  const asOf = settings.reportAsOf || settings.letterDate;
  const manuals = collectManuals(existingTracker);
  const seen = {};
  const incoming = [];
  for (const raw of reportRows || []) {
    if (!raw?.last && !raw?.first) continue;
    const cat = categorize(raw);
    if (!cat) continue;
    const keyPreview = `${nameKey(raw.last)}_${nameKey(raw.first)}_${nameKey(raw.middle).slice(0, 1)}`;
    const seenCount = (seen[keyPreview] || 0) + 1;
    const manualKey = seenCount > 1
      ? (raw.acctLast4 ? `${keyPreview}_${raw.acctLast4}` : `${keyPreview}_${seenCount}`)
      : keyPreview;
    const manual = manuals.get(manualKey);
    incoming.push(buildRow(raw, cat, contactIndex, orgMap, settings, seen, asOf, manual));
  }
  const tracker = mergeTracker(existingTracker || [], incoming, asOf);
  const current = tracker.filter((row) => row.onReport === 'Y' && row.asOf === asOf);
  return {
    tracker,
    current,
    contactCount: contactIndex.contacts.length,
    asOf,
  };
}
