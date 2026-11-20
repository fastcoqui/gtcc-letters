export function bdeLabel(bde) {
  if (bde === '259' || bde === '336' || bde === '505') return `${bde}th MI BDE`;
  return bde || 'UNKNOWN';
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function dashboardStats(rows) {
  const current = (rows || []).filter((row) => row.onReport === 'Y');
  const bdes = new Map();
  const buckets = [
    { key: '30', label: '30 days', dollars: 0, count: 0 },
    { key: '60', label: '60 days', dollars: 0, count: 0 },
    { key: '90', label: '90 days', dollars: 0, count: 0 },
    { key: '120+', label: '120+ days', dollars: 0, count: 0 },
  ];
  let delinquentDollars = 0;
  let openBalance = 0;
  let suspended = 0;
  let closedWithBalance = 0;
  let withEmail = 0;
  for (const row of current) {
    delinquentDollars += num(row.delinquent);
    openBalance += num(row.balance);
    if (String(row.qualifier || '').toLowerCase() === 'suspended') suspended += 1;
    if (String(row.accountStatus || '').toLowerCase() === 'closed') closedWithBalance += 1;
    if (String(row.email || '').trim()) withEmail += 1;
    const name = row.bde || row.hier5 || 'UNKNOWN';
    if (!bdes.has(name)) {
      bdes.set(name, {
        name,
        label: bdeLabel(name),
        delinquent: 0,
        count: 0,
        balance: 0,
        suspended: 0,
        n120: 0,
        d30: 0,
        d60: 0,
        d90: 0,
        b120: 0,
      });
    }
    const entry = bdes.get(name);
    entry.delinquent += num(row.delinquent);
    entry.count += 1;
    entry.balance += num(row.balance);
    entry.d30 += num(row.d30);
    entry.d60 += num(row.d60);
    entry.d90 += num(row.d90);
    entry.b120 += num(row.b120);
    if (row.category === '120+') {
      entry.n120 += 1;
    }
    if (String(row.qualifier || '').toLowerCase() === 'suspended') entry.suspended += 1;
    buckets[0].dollars += num(row.d30);
    buckets[1].dollars += num(row.d60);
    buckets[2].dollars += num(row.d90);
    buckets[3].dollars += num(row.b120);
    const slot = buckets.find((bucket) => bucket.key === row.category) || buckets[3];
    slot.count += 1;
  }
  const ranking = [...bdes.values()].sort((a, b) => b.delinquent - a.delinquent || a.label.localeCompare(b.label));
  const openByBde = [...bdes.values()].sort((a, b) => b.balance - a.balance || a.label.localeCompare(b.label));
  return {
    cardholders: current.length,
    delinquentDollars,
    openBalance,
    suspended,
    closedWithBalance,
    withEmail,
    matchRate: current.length ? withEmail / current.length : 0,
    byCategory: buckets,
    ranking,
    openByBde,
  };
}
