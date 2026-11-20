import { nameKey } from './normalize.js';

export function isDtaPermission(value) {
  const tokens = String(value ?? '').replace(/ /g, ',').split(',');
  return tokens.some((token) => token.trim() === '5');
}

function dedupeByEmail(contacts, indexes) {
  const seen = new Set();
  const out = [];
  for (const index of indexes) {
    const email = (contacts[index].email || '').toLowerCase();
    if (!email) {
      out.push(index);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(index);
  }
  return out;
}

export function indexContacts(rows) {
  const contacts = [];
  const byName = new Map();
  const orgDta = new Map();
  const orgSet = new Set();
  for (const raw of rows || []) {
    const first = String(raw?.first ?? '').trim();
    const last = String(raw?.last ?? '').trim();
    const emailRaw = String(raw?.email ?? '').trim();
    if (!first && !last && !emailRaw) continue;
    const contact = {
      first,
      miRaw: String(raw?.mi ?? '').trim(),
      last,
      org: String(raw?.org ?? '').trim().toUpperCase(),
      email: emailRaw.includes('@') ? emailRaw : '',
      rank: String(raw?.rank ?? '').trim().toUpperCase(),
      dta: isDtaPermission(raw?.perm),
    };
    contact.lk = nameKey(contact.last);
    contact.fk = nameKey(contact.first);
    contact.mik = nameKey(contact.miRaw);
    contact.mk = contact.mik.slice(0, 1);
    const index = contacts.length;
    contacts.push(contact);
    if (contact.lk || contact.fk) {
      const key = `${contact.lk}_${contact.fk}`;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(index);
    }
    if (contact.org) {
      orgSet.add(contact.org);
      if (contact.dta && contact.email) {
        if (!orgDta.has(contact.org)) orgDta.set(contact.org, []);
        orgDta.get(contact.org).push(index);
      }
    }
  }
  return { contacts, byName, orgDta, orgs: [...orgSet] };
}

export function parentOrg(org, orgs) {
  let best = '';
  for (const candidate of orgs || []) {
    if (candidate !== org && candidate.length < org.length && org.startsWith(candidate)) {
      if (candidate.length > best.length) best = candidate;
    }
  }
  return best;
}

/** Permission Level 5 at the org, walking up to the longest known parent prefix until one is found. */
export function dtasFor(index, startOrg, excludeEmail) {
  const exclude = String(excludeEmail ?? '').toLowerCase();
  let current = startOrg || '';
  let guard = 0;
  while (current && guard < 50) {
    guard += 1;
    const list = index.orgDta.get(current) || [];
    const seen = new Set();
    const found = [];
    for (const contactIndex of list) {
      const email = index.contacts[contactIndex].email.toLowerCase();
      if (email !== exclude && !seen.has(email)) {
        seen.add(email);
        found.push(contactIndex);
      }
    }
    if (found.length) return found;
    current = parentOrg(current, index.orgs);
  }
  return [];
}

/**
 * Last + first name, then middle-initial, BDE-org, and unit-org tie-breaks.
 * Ambiguous leftovers are returned unmatched so a person can type the email.
 */
export function matchContact(index, lastName, firstName, middleName, expOrg, bdeOrg) {
  const contacts = index.contacts;
  const lastKey = nameKey(lastName);
  const firstKey = nameKey(firstName);
  const middleKey = nameKey(middleName).slice(0, 1);
  let candidates = [];
  let fuzzy = false;
  let method = 'exact last+first';
  const exact = index.byName.get(`${lastKey}_${firstKey}`);
  if (exact?.length) candidates = dedupeByEmail(contacts, exact);
  if (!candidates.length) {
    fuzzy = true;
    method = 'fuzzy name';
    for (let i = 0; i < contacts.length; i += 1) {
      const contact = contacts[i];
      if (contact.lk === lastKey && contact.fk && firstKey && firstKey.length >= 3 && contact.fk.length >= 3) {
        const mashed = contact.fk + contact.mik;
        if (
          contact.fk.startsWith(firstKey)
          || firstKey.startsWith(contact.fk)
          || (contact.fk + contact.mk) === firstKey
          || (mashed && firstKey.startsWith(mashed))
        ) {
          candidates.push(i);
        }
      }
    }
    if (!candidates.length && lastKey && firstKey) {
      for (let i = 0; i < contacts.length; i += 1) {
        const contact = contacts[i];
        if (contact.fk === firstKey && contact.lk.length >= 4) {
          if (contact.lk.startsWith(lastKey) || lastKey.startsWith(contact.lk)) candidates.push(i);
        }
      }
    }
    candidates = dedupeByEmail(contacts, candidates);
  }
  if (!candidates.length) {
    return {
      index: -1,
      confidence: 'NONE',
      note: 'No DTS record with this last/first name',
      candidateCount: 0,
    };
  }
  const initialCount = candidates.length;
  let notes = '';
  if (candidates.length > 1 && middleKey) {
    const narrowed = candidates.filter((i) => contacts[i].mk === middleKey);
    if (narrowed.length) {
      candidates = narrowed;
      notes += '; MI tie-break';
    }
  }
  if (candidates.length > 1 && bdeOrg) {
    const narrowed = candidates.filter((i) => contacts[i].org.startsWith(bdeOrg));
    if (narrowed.length) {
      candidates = narrowed;
      notes += '; BDE-org tie-break';
    }
  }
  if (candidates.length > 1 && expOrg) {
    const narrowed = candidates.filter((i) => contacts[i].org === expOrg);
    if (narrowed.length) {
      candidates = narrowed;
      notes += '; unit-org tie-break';
    }
  }
  if (candidates.length > 1) {
    const first = contacts[candidates[0]];
    const allSame = candidates.every((i) => {
      const contact = contacts[i];
      return contact.fk === first.fk && contact.mk === first.mk && contact.lk === first.lk && contact.org === first.org;
    });
    if (allSame) {
      let pick = candidates[0];
      for (const i of candidates) {
        if (contacts[i].email.toLowerCase().endsWith('.mil')) {
          pick = i;
          break;
        }
      }
      const others = candidates.filter((i) => i !== pick).map((i) => contacts[i].email).join(', ');
      return {
        index: pick,
        confidence: 'MEDIUM',
        note: `duplicate DTS profiles for same person/org; used ${contacts[pick].email} (also: ${others})`,
        candidateCount: candidates.length,
      };
    }
    const listed = candidates.slice(0, 4).map((i) => {
      const contact = contacts[i];
      return `${contact.first} ${contact.miRaw} ${contact.last} (${contact.org}, ${contact.email})`;
    }).join('; ');
    return {
      index: -1,
      confidence: 'AMBIGUOUS',
      note: `${candidates.length} DTS records remain for ${lastName}, ${firstName}: ${listed}`,
      candidateCount: candidates.length,
    };
  }
  const contact = contacts[candidates[0]];
  let confidence = 'HIGH';
  if (fuzzy) {
    confidence = 'LOW';
    notes = `; fuzzy: DTS name ${contact.first} ${contact.miRaw} ${contact.last}${notes}`;
  } else if (middleKey && contact.mk && middleKey !== contact.mk) {
    confidence = 'LOW';
    notes += `; MI differs (report ${middleKey}, DTS ${contact.mk})`;
  } else if (!bdeOrg) {
    confidence = 'HIGH';
  } else if (contact.org.startsWith(bdeOrg)) {
    confidence = 'HIGH';
  } else {
    confidence = 'MEDIUM';
    notes += `; DTS org ${contact.org} is outside report BDE org ${bdeOrg}`;
  }
  if (!contact.email) {
    confidence = 'NONE';
    notes += '; DTS record has no email';
  }
  return {
    index: candidates[0],
    confidence,
    note: method + notes,
    candidateCount: initialCount,
  };
}
