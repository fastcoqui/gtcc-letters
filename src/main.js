import './style.css';
import Chart from 'chart.js/auto';
import * as XLSX from 'xlsx';
import { analyzeReport } from './logic/analyze.js';
import { dashboardStats } from './logic/dashboard.js';
import { milDate } from './logic/dates.js';
import { buildEml, ccAddresses, emailBody, emailSubject } from './logic/eml.js';
import { buildOneDraft, buildZip } from './logic/files.js';
import { buildLetterBlocks, letterPlain, suspenseISO } from './logic/letter.js';
import { moneyText } from './logic/normalize.js';
import {
  CONTACT_FIELDS,
  REPORT_FIELDS,
  extractRows,
  readWorkbook,
  sheetToMatrix,
} from './logic/parse.js';
import {
  SAMPLE_ROOT,
  SAMPLE_UNIT_MAP,
  sampleContactsMatrix,
  sampleReportMatrix,
} from './logic/sample.js';
import { loadSettings, prepareSettings, saveSettings } from './logic/settings.js';
import {
  effectiveRank,
  loadTracker,
  saveTracker,
  trackerFromMatrix,
  trackerToAoa,
} from './logic/tracker.js';

const state = {
  sample: false,
  settings: loadSettings(localStorage),
  tracker: loadTracker(localStorage),
  reportRows: null,
  contactRows: null,
  current: [],
};

const charts = [];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'value') node.value = value;
    else if (key === 'checked') node.checked = Boolean(value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function val(id) {
  return document.getElementById(id).value;
}

function fillForm(settings) {
  const set = (id, value) => {
    const node = document.getElementById(id);
    if (node.type === 'checkbox') node.checked = Boolean(value);
    else node.value = value ?? '';
  };
  set('as-of', settings.reportAsOf);
  set('letter-date', settings.letterDate);
  set('set-office', settings.officeSymbol);
  set('set-suspense', settings.suspenseBusinessDays);
  set('set-root', settings.dtsRoot);
  set('set-max-dtas', settings.maxDtasListed);
  set('set-letterhead', settings.letterhead);
  set('set-holidays', (settings.federalHolidays || []).join('\n'));
  set('set-apc-name', settings.apcName);
  set('set-apc-email', settings.apcEmail);
  set('set-apc-phone', settings.apcPhone);
  set('set-poc-name', settings.pocName);
  set('set-poc-position', settings.pocPosition);
  set('set-poc-phone', settings.pocPhone);
  set('set-poc-email', settings.pocEmail);
  set('set-sig-name', settings.signatureName);
  set('set-sig-rank', settings.signatureRank);
  set('set-sig-title', settings.signatureTitle);
  set('set-sender', settings.senderEmail);
  set('set-cc-apc', settings.ccApc);
  set('set-cc-dtas', settings.ccDtas);
  set('set-use-rank', settings.useDtsRank);
  set('set-unit-map', settings.unitMap);
}

function readForm() {
  return prepareSettings({
    reportAsOf: val('as-of'),
    letterDate: val('letter-date'),
    officeSymbol: val('set-office'),
    suspenseBusinessDays: val('set-suspense'),
    dtsRoot: val('set-root'),
    maxDtasListed: val('set-max-dtas'),
    letterhead: val('set-letterhead'),
    federalHolidays: val('set-holidays'),
    apcName: val('set-apc-name'),
    apcEmail: val('set-apc-email'),
    apcPhone: val('set-apc-phone'),
    pocName: val('set-poc-name'),
    pocPosition: val('set-poc-position'),
    pocPhone: val('set-poc-phone'),
    pocEmail: val('set-poc-email'),
    signatureName: val('set-sig-name'),
    signatureRank: val('set-sig-rank'),
    signatureTitle: val('set-sig-title'),
    senderEmail: val('set-sender'),
    ccApc: document.getElementById('set-cc-apc').checked,
    ccDtas: document.getElementById('set-cc-dtas').checked,
    useDtsRank: document.getElementById('set-use-rank').checked,
    unitMap: val('set-unit-map'),
  });
}

function activeSettings() {
  const settings = readForm();
  state.settings = settings;
  if (state.sample) return { ...settings, unitMap: SAMPLE_UNIT_MAP, dtsRoot: SAMPLE_ROOT };
  return settings;
}

function persistSettings() {
  state.settings = saveSettings(localStorage, readForm());
}

function persistTracker() {
  if (!state.sample) saveTracker(localStorage, state.tracker);
}

function setNote(text) {
  document.getElementById('file-note').textContent = text || '';
}

function setGen(text) {
  document.getElementById('gen-status').textContent = text || '';
}

function downloadBytes(bytes, filename, type) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function reanalyze() {
  if (!state.reportRows) {
    render();
    return;
  }
  const result = analyzeReport({
    reportRows: state.reportRows,
    contactRows: state.contactRows || [],
    settings: activeSettings(),
    existingTracker: state.tracker,
  });
  state.tracker = result.tracker;
  state.current = result.current;
  persistTracker();
  render();
}

function visibleRows() {
  const mode = document.getElementById('filter-status').value;
  const query = document.getElementById('filter-text').value.trim().toLowerCase();
  const rank = { '120+': 0, 90: 1, 60: 2, 30: 3 };
  return state.current.filter((row) => {
    if (mode === 'review' && !row.needsReview) return false;
    if (mode === 'ready' && (row.needsReview || row.status === 'Emailed')) return false;
    if (mode === 'emailed' && row.status !== 'Emailed') return false;
    if (!query) return true;
    const hay = `${row.last} ${row.first} ${row.bde} ${row.email}`.toLowerCase();
    return hay.includes(query);
  }).sort((a, b) => Number(b.needsReview) - Number(a.needsReview)
    || (rank[a.category] ?? 9) - (rank[b.category] ?? 9)
    || String(a.last).localeCompare(String(b.last)));
}

function renderSummary() {
  const summary = document.getElementById('summary');
  const button = document.getElementById('generate');
  if (!state.reportRows) {
    summary.textContent = 'No report loaded yet.';
    button.disabled = true;
    return;
  }
  const review = state.current.filter((row) => row.needsReview).length;
  const suspense = milDate(suspenseISO(activeSettings()));
  const where = state.sample ? 'Synthetic sample, not saved on this computer.' : 'Tracker updated in this browser only.';
  summary.textContent = `${state.current.length} delinquent cardholder${state.current.length === 1 ? '' : 's'}. ${review} need review. Suspense ${suspense}. ${where}`;
  button.disabled = state.current.length === 0;
}

function renderReview() {
  const body = document.getElementById('review-body');
  body.replaceChildren();
  const rows = visibleRows();
  document.getElementById('empty-review').hidden = rows.length > 0 || !state.reportRows;
  if (state.reportRows && rows.length === 0) {
    document.getElementById('empty-review').hidden = false;
    document.getElementById('empty-review').textContent = 'No rows match this filter.';
  } else if (!state.reportRows) {
    document.getElementById('empty-review').textContent = 'Drop a report or load the sample to see delinquent cardholders.';
  }
  for (const row of rows) {
    const who = el('div', { class: 'who' }, [
      el('strong', { text: `${row.last}, ${row.first}${row.mi ? ` ${row.mi}.` : ''}` }),
    ]);
    if (row.priorLetterCount) {
      who.append(el('div', { class: 'sub', text: `Prior letters: ${row.priorLetterCount}${row.priorCategory ? ` (was ${row.priorCategory})` : ''}` }));
    }
    if (row.reviewReason) who.append(el('div', { class: 'reason', text: row.reviewReason }));
    const rank = el('input', {
      class: 'cell-input rank',
      value: effectiveRank(row),
      'aria-label': `Rank for ${row.last}`,
    });
    rank.addEventListener('change', () => {
      row.rankEdited = true;
      row.rankOverride = rank.value.trim();
      row.rank = rank.value.trim();
      persistTracker();
    });
    const email = el('input', {
      class: 'cell-input',
      type: 'email',
      value: row.email || '',
      'aria-label': `Email for ${row.last}`,
    });
    email.addEventListener('change', () => {
      row.emailEdited = true;
      row.emailOverride = email.value.trim();
      row.email = email.value.trim();
      persistTracker();
    });
    const mailed = el('input', {
      type: 'checkbox',
      checked: row.status === 'Emailed',
      'aria-label': `Mark ${row.last} emailed`,
    });
    mailed.addEventListener('change', () => {
      if (mailed.checked) {
        row.emailedDate = state.settings.letterDate || new Date().toISOString().slice(0, 10);
        row.status = 'Emailed';
      } else {
        row.emailedDate = '';
        row.status = row.letterCreated ? 'Letter created' : (row.email && row.confidence !== 'NONE' && row.confidence !== 'AMBIGUOUS' ? 'Ready' : 'Needs Review');
      }
      persistTracker();
      renderSummary();
      renderTracker();
    });
    const dtaCount = row.dtaCc ? row.dtaCc.split(';').filter(Boolean).length : 0;
    const tr = el('tr', { class: row.needsReview ? 'review' : '' }, [
      el('td', {}, [who]),
      el('td', { text: row.bde || '' }),
      el('td', {}, [el('span', { class: 'pill', 'data-cat': row.category, text: row.category })]),
      el('td', { class: 'money' }, [
        el('div', { text: `$${moneyText(row.delinquent)}` }),
        el('div', { class: 'sub', text: row.balance == null ? 'Balance blank' : `Bal $${moneyText(row.balance)}` }),
      ]),
      el('td', { text: row.acctLast4 || '' }),
      el('td', {}, [rank]),
      el('td', {}, [email]),
      el('td', {}, [el('span', { class: 'pill', 'data-match': row.confidence, text: row.confidence || '' })]),
      el('td', { title: row.dtaText || 'No DTA found' }, [
        el('span', { class: dtaCount ? '' : 'missing', text: dtaCount ? `${dtaCount} DTA${dtaCount === 1 ? '' : 's'}` : 'No DTA' }),
      ]),
      el('td', {}, [mailed]),
      el('td', {}, [
        el('button', { type: 'button', class: 'mini', text: 'Preview', onClick: () => openPreview(row) }),
        document.createTextNode(' '),
        el('button', { type: 'button', class: 'mini', text: 'Draft', onClick: () => downloadOne(row) }),
      ]),
    ]);
    const mail = mailtoHref(row);
    tr.lastChild.append(document.createTextNode(' '));
    tr.lastChild.append(el('a', {
      href: mail,
      title: 'Opens a mail window without the letter attached',
      text: 'Mailto',
    }));
    body.append(tr);
  }
}

function mailtoHref(row) {
  const settings = activeSettings();
  const params = new URLSearchParams();
  const cc = ccAddresses(row, settings);
  if (cc) params.set('cc', cc);
  params.set('subject', emailSubject(row));
  params.set('body', emailBody(row, settings).slice(0, 1500));
  return `mailto:${encodeURIComponent(row.email || '')}?${params.toString()}`;
}

function renderTracker() {
  const body = document.getElementById('tracker-body');
  body.replaceChildren();
  const rows = [...state.tracker].sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)) || String(a.last).localeCompare(String(b.last)));
  for (const row of rows) {
    body.append(el('tr', {}, [
      el('td', { text: `${row.last}, ${row.first}` }),
      el('td', { text: row.asOf || '' }),
      el('td', { text: row.category || '' }),
      el('td', { text: `$${moneyText(row.delinquent)}` }),
      el('td', { text: row.letterCreated || '' }),
      el('td', { text: row.emailedDate || '' }),
      el('td', { text: String(row.priorLetterCount || 0) }),
      el('td', { text: row.onReport || '' }),
    ]));
  }
}

function renderDashboard() {
  const empty = document.getElementById('dash-empty');
  const body = document.getElementById('dash-body');
  if (!state.current.length) {
    empty.hidden = false;
    body.hidden = true;
    clearCharts();
    return;
  }
  empty.hidden = true;
  body.hidden = false;
  const stats = dashboardStats(state.current);
  const money = (n) => `$${moneyText(n)}`;
  document.getElementById('kpi-row').replaceChildren(
    kpi('Cardholders', String(stats.cardholders), 'On this report'),
    kpi('Delinquent $', money(stats.delinquentDollars), 'Sum of aging buckets'),
    kpi('Open balance', money(stats.openBalance), 'Current balance'),
    kpi('Suspended', String(stats.suspended), 'Qualifier'),
    kpi('Closed w/ balance', String(stats.closedWithBalance), 'Account status closed'),
    kpi('Match rate', `${Math.round(stats.matchRate * 100)}%`, `${stats.withEmail} of ${stats.cardholders} have an email`),
  );
  const rankBody = document.getElementById('rank-body');
  rankBody.replaceChildren();
  stats.ranking.forEach((row, index) => {
    rankBody.append(el('tr', {}, [
      el('td', { text: String(index + 1) }),
      el('td', { text: row.label }),
      el('td', { text: money(row.delinquent) }),
      el('td', { text: String(row.count) }),
      el('td', { text: money(row.balance) }),
      el('td', { text: String(row.n120) }),
      el('td', { text: String(row.suspended) }),
    ]));
  });
  const bucketBody = document.getElementById('bucket-body');
  bucketBody.replaceChildren();
  for (const bucket of stats.byCategory) {
    bucketBody.append(el('tr', {}, [
      el('td', { text: bucket.label }),
      el('td', { text: money(bucket.dollars) }),
      el('td', { text: String(bucket.count) }),
    ]));
  }
  drawCharts(stats);
}

function kpi(label, value, sub) {
  return el('article', { class: 'kpi' }, [
    el('p', { class: 'kpi-label', text: label }),
    el('p', { class: 'kpi-value', text: value }),
    el('p', { class: 'kpi-sub', text: sub }),
  ]);
}

function clearCharts() {
  while (charts.length) charts.pop().destroy();
}

function drawCharts(stats) {
  clearCharts();
  const balance = document.getElementById('chart-bde');
  const category = document.getElementById('chart-cat');
  charts.push(new Chart(balance, {
    type: 'bar',
    data: {
      labels: stats.openByBde.map((row) => row.label),
      datasets: [{ label: 'Open balance', data: stats.openByBde.map((row) => row.balance), backgroundColor: '#314732' }],
    },
    options: chartOptions(),
  }));
  charts.push(new Chart(category, {
    type: 'bar',
    data: {
      labels: stats.byCategory.map((row) => row.label),
      datasets: [{
        label: 'Delinquent dollars',
        data: stats.byCategory.map((row) => row.dollars),
        backgroundColor: ['#c4a35a', '#d08a3a', '#b85c38', '#8c3a2f'],
      }],
    },
    options: chartOptions(),
  }));
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#5e584e' }, grid: { display: false } },
      y: { ticks: { color: '#5e584e' }, beginAtZero: true },
    },
  };
}

function render() {
  renderSummary();
  renderReview();
  renderTracker();
  if (!document.getElementById('view-dashboard').hidden) renderDashboard();
}

function openPreview(row) {
  const settings = activeSettings();
  const blocks = buildLetterBlocks(row, settings);
  document.getElementById('preview-title').textContent = `${row.last}, ${row.first}`;
  document.getElementById('preview-mail').textContent = `To ${row.email || '(no address)'} · CC ${ccAddresses(row, settings) || '(none)'} · ${emailSubject(row)}. Mailto does not attach the letter; use Draft for the .eml file.`;
  document.getElementById('preview-letter').textContent = letterPlain(blocks);
  document.getElementById('preview').showModal();
}

async function downloadOne(row) {
  const settings = activeSettings();
  setGen(`Preparing a draft for ${row.last}…`);
  const draft = await buildOneDraft(row, settings);
  downloadBytes(draft.eml, draft.emlName, 'message/rfc822');
  if (!row.letterCreated) row.letterCreated = settings.letterDate;
  row.draftCreated = new Date().toISOString();
  if (row.status !== 'Emailed' && row.status !== 'Resolved') row.status = 'Letter created';
  persistTracker();
  setGen(`Downloaded ${draft.emlName}. Nothing was sent.`);
  render();
}

async function generateAll() {
  const settings = activeSettings();
  const rows = state.current.slice();
  if (!rows.length) return;
  const button = document.getElementById('generate');
  button.disabled = true;
  setGen(`Preparing ${rows.length} letters…`);
  try {
    const zip = await buildZip(rows, settings);
    for (const row of rows) {
      if (!row.letterCreated) row.letterCreated = settings.letterDate;
      row.draftCreated = new Date().toISOString();
      if (row.status !== 'Emailed' && row.status !== 'Resolved') row.status = 'Letter created';
    }
    persistTracker();
    downloadBytes(zip.bytes, `${zip.folderName}.zip`, 'application/zip');
    const review = rows.filter((row) => row.needsReview).length;
    setGen(`Downloaded ${rows.length} letters and ${rows.length} drafts in ${zip.folderName}.zip. ${review} still need review. Nothing was sent.`);
  } catch (error) {
    setGen(`Could not build the letters: ${error.message || error}`);
  }
  render();
}

function applyParsedReport(report, note) {
  if (report.error === 'header') {
    setNote('Could not find the report header row. Expected headers such as Cardholder Last Name and 30 Day Past Due.');
    return false;
  }
  if (report.error === 'columns') {
    setNote(`The report is missing required columns: ${report.missing.join(', ')}.`);
    return false;
  }
  state.sample = false;
  state.reportRows = report.rows;
  state.tracker = loadTracker(localStorage);
  setNote(note);
  return true;
}

function applyParsedContacts(contacts) {
  if (contacts.error) {
    setNote(contacts.error === 'header'
      ? 'Could not find the contacts header row (the row containing Email Address).'
      : `The contacts sheet is missing columns: ${contacts.missing.join(', ')}.`);
    return false;
  }
  state.contactRows = contacts.rows;
  return true;
}

async function readBuffer(file) {
  return file.arrayBuffer();
}

async function onReportFile(file) {
  const picked = readWorkbook(await readBuffer(file));
  if (!picked.report && picked.contacts) {
    if (applyParsedContacts(extractRows(picked.contacts, CONTACT_FIELDS, { mustIncludeNorms: ['emailaddress', 'email'] }))) {
      setNote(`No delinquency sheet in ${file.name}. Loaded ${state.contactRows.length} contacts instead.`);
      reanalyze();
    }
    return;
  }
  if (!picked.report) {
    setNote('No delinquency report sheet was found in that file.');
    return;
  }
  const report = extractRows(picked.report, REPORT_FIELDS);
  if (!applyParsedReport(report, '')) return;
  let note = `Report loaded from “${picked.reportSheet}” (${report.rows.length} rows).`;
  if (picked.contacts) {
    const contacts = extractRows(picked.contacts, CONTACT_FIELDS, { mustIncludeNorms: ['emailaddress', 'email'] });
    if (!contacts.error) {
      state.contactRows = contacts.rows;
      note += ` Contacts loaded from “${picked.contactsSheet}” (${contacts.rows.length} people).`;
    } else {
      note += ' The contacts sheet was present but its headers could not be mapped.';
    }
  } else if (!state.contactRows) {
    note += ' No contacts sheet found. Drop the DTS contacts file, or continue and fill emails by hand.';
  }
  setNote(note);
  reanalyze();
}

async function onContactsFile(file) {
  const picked = readWorkbook(await readBuffer(file));
  const matrix = picked.contacts || picked.report;
  if (!matrix) {
    setNote('No contacts sheet was found in that file.');
    return;
  }
  const contacts = extractRows(matrix, CONTACT_FIELDS, { mustIncludeNorms: ['emailaddress', 'email'] });
  if (!applyParsedContacts(contacts)) return;
  setNote(`Contacts loaded (${contacts.rows.length} people).`);
  reanalyze();
}

function loadSample() {
  const report = extractRows(sampleReportMatrix(), REPORT_FIELDS);
  const contacts = extractRows(sampleContactsMatrix(), CONTACT_FIELDS, { mustIncludeNorms: ['emailaddress', 'email'] });
  state.sample = true;
  state.reportRows = report.rows;
  state.contactRows = contacts.rows;
  state.tracker = [];
  setNote('Sample data is synthetic. Its unit crosswalk is used only for this demo and is not written into Settings.');
  reanalyze();
}

function exportTracker(kind) {
  const aoa = trackerToAoa(state.tracker);
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Tracker');
  const bytes = XLSX.write(book, { bookType: kind, type: 'array' });
  const type = kind === 'csv'
    ? 'text/csv'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  downloadBytes(bytes, `gtcc-tracker.${kind}`, type);
}

async function importTracker(file) {
  const book = XLSX.read(await readBuffer(file), { type: 'array' });
  const matrix = sheetToMatrix(book.Sheets[book.SheetNames[0]]);
  const rows = trackerFromMatrix(matrix);
  if (!rows.length) {
    setNote('That tracker file had no recognizable rows.');
    return;
  }
  state.sample = false;
  state.tracker = rows;
  persistTracker();
  if (state.reportRows) reanalyze();
  else render();
  setNote(`Imported ${rows.length} tracker rows into this browser.`);
}

function bindDrop(zoneId, inputId, handler) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (file) handler(file);
    input.value = '';
  });
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('hot');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('hot'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('hot');
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handler(file);
  });
}

function showTab(name) {
  const letters = name === 'letters';
  document.getElementById('view-letters').hidden = !letters;
  document.getElementById('view-dashboard').hidden = letters;
  document.getElementById('tab-letters').setAttribute('aria-selected', letters ? 'true' : 'false');
  document.getElementById('tab-dashboard').setAttribute('aria-selected', letters ? 'false' : 'true');
  if (!letters) renderDashboard();
}

function bindSettings() {
  const ids = [
    'as-of', 'letter-date', 'set-office', 'set-suspense', 'set-root', 'set-max-dtas', 'set-letterhead',
    'set-holidays', 'set-apc-name', 'set-apc-email', 'set-apc-phone', 'set-poc-name', 'set-poc-position',
    'set-poc-phone', 'set-poc-email', 'set-sig-name', 'set-sig-rank', 'set-sig-title', 'set-sender',
    'set-cc-apc', 'set-cc-dtas', 'set-use-rank', 'set-unit-map',
  ];
  for (const id of ids) {
    document.getElementById(id).addEventListener('change', () => {
      persistSettings();
      if (id === 'as-of' || id === 'set-root' || id === 'set-unit-map' || id === 'set-use-rank' || id === 'set-max-dtas') {
        reanalyze();
      } else {
        renderSummary();
      }
    });
  }
}

fillForm(state.settings);
persistSettings();
bindDrop('drop-report', 'file-report', onReportFile);
bindDrop('drop-contacts', 'file-contacts', onContactsFile);
document.getElementById('load-sample').addEventListener('click', loadSample);
document.getElementById('generate').addEventListener('click', generateAll);
document.getElementById('filter-status').addEventListener('change', renderReview);
document.getElementById('filter-text').addEventListener('input', renderReview);
document.getElementById('tab-letters').addEventListener('click', () => showTab('letters'));
document.getElementById('tab-dashboard').addEventListener('click', () => showTab('dashboard'));
document.getElementById('preview-close').addEventListener('click', () => document.getElementById('preview').close());
document.getElementById('export-xlsx').addEventListener('click', () => exportTracker('xlsx'));
document.getElementById('export-csv').addEventListener('click', () => exportTracker('csv'));
document.getElementById('import-tracker').addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) importTracker(file);
  event.target.value = '';
});
document.getElementById('clear-tracker').addEventListener('click', () => {
  if (!window.confirm('Clear the tracker stored in this browser?')) return;
  state.tracker = [];
  if (!state.sample) persistTracker();
  if (state.reportRows) reanalyze();
  else render();
});
bindSettings();
render();
