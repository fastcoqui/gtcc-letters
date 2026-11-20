/** Header and name normalization ported from modGTCC.bas. */

export function normHeader(value) {
  if (value == null) return '';
  const raw = String(value).toLowerCase();
  let out = '';
  for (const ch of raw) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch === '+') out += ch;
  }
  return out.replaceAll('days', 'day');
}

export function nameKey(value) {
  if (value == null || value === '') return '';
  const cleaned = String(value).toUpperCase().replaceAll('.', '').replaceAll(',', ' ').replaceAll('\t', ' ');
  const tokens = cleaned.split(' ').filter(Boolean);
  let out = '';
  for (const token of tokens) {
    if (tokens.length > 1 && (token === 'JR' || token === 'SR' || token === 'II' || token === 'III' || token === 'IV')) {
      continue;
    }
    out += token.replace(/[^A-Z]/g, '');
  }
  return out;
}

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function unitKey(value) {
  return String(value ?? '').toUpperCase().trim().replace(/ {2,}/g, ' ');
}

export function safeName(value) {
  let out = '';
  for (const ch of String(value ?? '')) {
    out += /[A-Za-z0-9]/.test(ch) ? ch : '_';
  }
  out = out.replace(/_+/g, '_').replace(/^_|_$/g, '');
  return out || 'X';
}

export function properCase(value) {
  const s = String(value ?? '');
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function parseNumber(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s) return null;
  let neg = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,]/g, '').trim();
  if (!s || s === '-' || s === '.') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

export function moneyText(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const neg = n < 0;
  const [whole, frac] = Math.abs(n).toFixed(2).split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${withCommas}.${frac}`;
}

export function joinNonBlank(parts, sep) {
  return parts.map((p) => String(p ?? '').trim()).filter(Boolean).join(sep);
}
