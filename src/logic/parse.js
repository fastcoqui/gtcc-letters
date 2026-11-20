import * as XLSX from 'xlsx';
import { digitsOnly, normHeader, parseNumber } from './normalize.js';

function field(id, canon, aliases, extra = {}) {
  return { id, canon, aliases, ...extra };
}

export const REPORT_FIELDS = [
  field('hier4', 'Hierarchy Name (Level 4)', ['Level 4', 'Hierarchy Level 4']),
  field('hier5', 'Hierarchy Name (Level 5)', ['Level 5', 'Hierarchy Level 5']),
  field('hier6', 'Hierarchy Name (Level 6)', ['Level 6', 'Hierarchy Level 6']),
  field('billing', 'Billing Type', ['Billing']),
  field('account', 'Account Number', ['Account #', 'Acct Number', 'Card Number'], { account: true }),
  field('last', 'Cardholder Last Name', ['Last Name', 'Cardholder Last'], { required: true }),
  field('first', 'Cardholder First Name', ['First Name', 'Cardholder First'], { required: true }),
  field('middle', 'Cardholder Middle Name', ['Middle Name', 'Cardholder Middle']),
  field('ssn', 'SSN', ['Social Security Number', 'Social Security'], { sensitive: true }),
  field('accountStatus', 'Account Status', ['Status']),
  field('qualifier', 'Qualifier', []),
  field('lastPayment', 'Last Payment Date', []),
  field('dueDate', 'Payment Due Date', []),
  field('balance', 'Current Balance', ['Balance'], { number: true }),
  field('pastDue', 'Past Due Amount', ['Past Due'], { number: true }),
  field('payCtd', 'Payment Amount CTD', [], { number: true }),
  field('payDue', 'Payment Due Amount', [], { number: true }),
  field('d30', '30 Day Past Due', ['30 Days Past Due'], { number: true, required: true }),
  field('d60', '60 Day Past Due', ['60 Days Past Due'], { number: true, required: true }),
  field('d90', '90 Day Past Due', ['90 Days Past Due'], { number: true, required: true }),
  field('d120', '120 Day Past Due', ['120 Days Past Due'], { number: true, required: true }),
  field('d150', '150 Days Past Due', ['150 Day Past Due'], { number: true, required: true }),
  field('d180', '180+ Days Past Due', ['180+ Day Past Due', '180 Days Past Due', '180 Day Past Due'], { number: true, required: true }),
  field('bde', 'BDE', ['Brigade', 'BDE Name']),
];

export const CONTACT_FIELDS = [
  field('first', 'First Name', []),
  field('mi', 'Middle Initial', ['MI', 'Middle Name']),
  field('last', 'Last Name', []),
  field('org', 'Organization Name', ['Organization', 'Org']),
  field('email', 'Email Address', ['Email', 'E-mail Address', 'E-mail']),
  field('perm', 'Permission Levels', ['Permission Level', 'Permissions']),
  field('civmil', 'Civilian/Military Status', ['Civilian Military Status']),
  field('rank', 'Title/Rank', ['Rank', 'Title', 'Grade']),
  field('porg', 'Printed Organization Name', ['Printed Organization']),
  field('govccHolder', 'Government Charge Card (GOVCC) Holder', ['GOVCC Holder']),
  field('govccAccount', 'GOVCC Account Number', ['Government Charge Card Account Number'], { sensitive: true }),
  field('govccExp', 'GOVCC Expiration Date', []),
];

function wantedNorms(fields) {
  const wanted = new Set();
  for (const item of fields) {
    wanted.add(normHeader(item.canon));
    for (const alias of item.aliases) wanted.add(normHeader(alias));
  }
  wanted.delete('');
  return wanted;
}

export function findHeaderRow(matrix, fields, options = {}) {
  const wanted = wantedNorms(fields);
  const need = Math.max(2, Math.floor(fields.length / 2));
  const must = options.mustIncludeNorms || [];
  const max = Math.min(matrix?.length || 0, 15);
  for (let r = 0; r < max; r += 1) {
    const seen = new Set();
    let hits = 0;
    for (const cell of matrix[r] || []) {
      const norm = normHeader(cell);
      if (norm && wanted.has(norm) && !seen.has(norm)) {
        seen.add(norm);
        hits += 1;
      }
    }
    if (hits < need) continue;
    if (must.length) {
      const rowNorms = (matrix[r] || []).map((cell) => normHeader(cell));
      if (!must.some((req) => rowNorms.includes(req))) continue;
    }
    return r;
  }
  return -1;
}

export function mapColumns(headerRow, fields) {
  const norms = (headerRow || []).map((cell) => normHeader(cell));
  return fields.map((item) => {
    const names = [item.canon, ...item.aliases].map((name) => normHeader(name)).filter(Boolean);
    for (const name of names) {
      const index = norms.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  });
}

export function extractRows(matrix, fields, options = {}) {
  const headerRow = findHeaderRow(matrix, fields, options);
  if (headerRow < 0) {
    return { error: 'header', rows: [], headerRow: -1, missing: [], skippedSensitiveHeaders: [] };
  }
  const cols = mapColumns(matrix[headerRow], fields);
  const missing = [];
  const skippedSensitiveHeaders = [];
  fields.forEach((item, index) => {
    if (item.required && cols[index] < 0) missing.push(item.canon);
    if (item.sensitive && cols[index] >= 0) skippedSensitiveHeaders.push(item.canon);
  });
  if (missing.length) {
    return { error: 'columns', rows: [], headerRow, missing, skippedSensitiveHeaders };
  }
  const rows = [];
  for (let r = headerRow + 1; r < matrix.length; r += 1) {
    const line = matrix[r] || [];
    if (line.every((cell) => String(cell ?? '').trim() === '')) continue;
    const obj = {};
    let any = false;
    fields.forEach((item, index) => {
      if (item.sensitive) return;
      const col = cols[index];
      if (col < 0) return;
      const raw = String(line[col] ?? '').trim();
      if (item.account) {
        const digits = digitsOnly(raw);
        obj.acctLast4 = digits ? digits.slice(-4) : '';
        if (digits) any = true;
        return;
      }
      if (item.number) {
        obj[item.id] = parseNumber(raw);
        if (raw) any = true;
        return;
      }
      obj[item.id] = raw;
      if (raw) any = true;
    });
    if (any) rows.push(obj);
  }
  return { error: null, rows, headerRow, missing, skippedSensitiveHeaders };
}

function cellString(cell) {
  if (!cell) return '';
  if (cell.t === 's' || cell.t === 'str' || cell.t === 'inlineStr') return String(cell.v ?? '').trim();
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE';
  if (cell.t === 'd' && cell.v instanceof Date) {
    const date = cell.v;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (cell.t === 'n') {
    const format = String(cell.z || '');
    if (format && /[ydm]/i.test(format) && XLSX.SSF?.parse_date_code) {
      const parsed = XLSX.SSF.parse_date_code(cell.v);
      if (parsed?.y) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      }
    }
    if (cell.w != null) {
      const shown = String(cell.w).trim();
      const digits = shown.replace(/\D/g, '');
      if (digits.length >= 12 && digits.length >= shown.replace(/[^\d.]/g, '').length - 2) return digits;
      if (!/[eE]/.test(shown)) return shown;
    }
    return String(cell.v);
  }
  if (cell.w != null) return String(cell.w).trim();
  return String(cell.v ?? '').trim();
}

export function sheetToMatrix(sheet) {
  if (!sheet || !sheet['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const matrix = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push(cellString(sheet[addr]));
    }
    matrix.push(row);
  }
  return matrix;
}

function blankSensitive(matrix, fields, options) {
  const copy = matrix.map((row) => row.slice());
  const headerRow = findHeaderRow(copy, fields, options);
  if (headerRow < 0) return copy;
  const cols = mapColumns(copy[headerRow], fields);
  const sensitive = [];
  fields.forEach((item, index) => {
    if (item.sensitive && cols[index] >= 0) sensitive.push(cols[index]);
  });
  for (let r = headerRow + 1; r < copy.length; r += 1) {
    for (const col of sensitive) copy[r][col] = '';
  }
  return copy;
}

export function matricesFromWorkbook(workbook) {
  const sheets = (workbook.SheetNames || []).map((name) => ({
    name,
    matrix: sheetToMatrix(workbook.Sheets[name]),
  }));
  const reportOptions = {};
  const contactOptions = { mustIncludeNorms: ['emailaddress', 'email'] };
  const byName = (preferred) => sheets.find((sheet) => sheet.name === preferred);
  let report = byName('IBA and CBA Delinquency Report');
  let contacts = byName('Traveler and DTA Contacts');
  if (!report || findHeaderRow(report.matrix, REPORT_FIELDS, reportOptions) < 0) {
    report = sheets.find((sheet) => findHeaderRow(sheet.matrix, REPORT_FIELDS, reportOptions) >= 0) || null;
  }
  if (!contacts || findHeaderRow(contacts.matrix, CONTACT_FIELDS, contactOptions) < 0) {
    contacts = sheets.find((sheet) => sheet !== report && findHeaderRow(sheet.matrix, CONTACT_FIELDS, contactOptions) >= 0) || null;
  }
  return {
    report: report ? blankSensitive(report.matrix, REPORT_FIELDS, reportOptions) : null,
    contacts: contacts ? blankSensitive(contacts.matrix, CONTACT_FIELDS, contactOptions) : null,
    reportSheet: report?.name || '',
    contactsSheet: contacts?.name || '',
  };
}

export function readWorkbook(data) {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: true, cellText: true });
  return matricesFromWorkbook(workbook);
}

export function workbookFromAoa(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    if (sheet.strings) {
      for (const [addr, value] of Object.entries(sheet.strings)) {
        ws[addr] = { t: 's', v: value };
      }
    }
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
  }
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}
