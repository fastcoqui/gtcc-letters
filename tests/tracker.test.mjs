import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeReport } from '../src/logic/analyze.js';
import { CONTACT_FIELDS, REPORT_FIELDS, extractRows } from '../src/logic/parse.js';
import { SAMPLE_ROOT, SAMPLE_UNIT_MAP, sampleContactsMatrix, sampleReportMatrix } from '../src/logic/sample.js';
import { prepareSettings } from '../src/logic/settings.js';
import { sanitizeTrackerRow, trackerFromMatrix, trackerToAoa } from '../src/logic/tracker.js';

function run(asOf, tracker, rows) {
  const settings = prepareSettings({
    letterDate: asOf,
    reportAsOf: asOf,
    unitMap: SAMPLE_UNIT_MAP,
    dtsRoot: SAMPLE_ROOT,
  }, asOf);
  const report = extractRows(rows || sampleReportMatrix(), REPORT_FIELDS);
  const contacts = extractRows(sampleContactsMatrix(), CONTACT_FIELDS, { mustIncludeNorms: ['emailaddress'] });
  return analyzeReport({
    reportRows: report.rows,
    contactRows: contacts.rows,
    settings,
    existingTracker: tracker,
  });
}

test('a later as-of date keeps history, counts prior letters, and preserves manual email edits', () => {
  const october = run('2026-10-01', []);
  const first = october.current.find((row) => row.key === 'RIVERA_JORDAN_A');
  first.letterCreated = '2026-10-01';
  first.emailEdited = true;
  first.emailOverride = 'jordan.fixed@unit.example.mil';
  first.email = 'jordan.fixed@unit.example.mil';

  const november = run('2026-11-01', october.tracker);
  const again = november.current.find((row) => row.key === 'RIVERA_JORDAN_A');
  const prior = november.tracker.find((row) => row.key === 'RIVERA_JORDAN_A' && row.asOf === '2026-10-01');
  assert.equal(prior.onReport, 'Superseded');
  assert.equal(prior.letterCreated, '2026-10-01');
  assert.equal(again.priorLetterCount, 1);
  assert.equal(again.priorCycles, 1);
  assert.equal(again.priorCategory, '30');
  assert.equal(again.email, 'jordan.fixed@unit.example.mil');
  assert.equal(again.confidence, 'OVERRIDE');
  assert.equal(november.tracker.filter((row) => row.key === 'RIVERA_JORDAN_A' && row.asOf === '2026-11-01').length, 1);

  again.letterCreated = '2026-11-01';
  const rerun = run('2026-11-01', november.tracker);
  const kept = rerun.current.filter((row) => row.key === 'RIVERA_JORDAN_A');
  assert.equal(kept.length, 1);
  assert.equal(kept[0].letterCreated, '2026-11-01');
  assert.equal(kept[0].email, 'jordan.fixed@unit.example.mil');
});

test('someone missing from the new report is kept and marked off the latest report', () => {
  const october = run('2026-10-01', []);
  const hale = october.current.find((row) => row.last === 'Hale');
  const withoutHale = sampleReportMatrix().filter((row, index) => index === 0 || row[1] !== 'Hale');
  const november = run('2026-11-01', october.tracker, withoutHale);
  const old = november.tracker.find((row) => row.key === hale.key);
  assert.equal(old.onReport, 'N');
  assert.equal(old.status, 'Not on latest report');
  assert.equal(november.current.some((row) => row.last === 'Hale'), false);
});

test('tracker import and export never keep an SSN or a full account number', () => {
  const poisoned = sanitizeTrackerRow({
    key: 'RIVERA_JORDAN_A',
    last: 'Rivera',
    ssn: 'SSN-DO-NOT-READ',
    accountNumber: '4485123456789012',
    acctLast4: '9012',
  });
  assert.equal(JSON.stringify(poisoned).includes('SSN-DO-NOT-READ'), false);
  assert.equal(JSON.stringify(poisoned).includes('4485123456789012'), false);
  assert.equal(poisoned.acctLast4, '9012');

  const matrix = [
    ['Key', 'Last Name', 'SSN', 'Account Number', 'Account Last 4', 'As Of', 'Category'],
    ['RIVERA_JORDAN_A', 'Rivera', 'SSN-DO-NOT-READ', '4485123456789012', '9012', '2026-10-01', '30'],
  ];
  const imported = trackerFromMatrix(matrix);
  const blob = JSON.stringify(imported);
  assert.equal(blob.includes('SSN-DO-NOT-READ'), false);
  assert.equal(blob.includes('4485123456789012'), false);
  assert.equal(imported[0].acctLast4, '9012');
  const exported = JSON.stringify(trackerToAoa([poisoned]));
  assert.equal(exported.includes('4485123456789012'), false);
  assert.equal(exported.includes('SSN-DO-NOT-READ'), false);
});
