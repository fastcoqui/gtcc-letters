import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeReport } from '../src/logic/analyze.js';
import { dashboardStats } from '../src/logic/dashboard.js';
import { CONTACT_FIELDS, REPORT_FIELDS, extractRows } from '../src/logic/parse.js';
import {
  BLANK_SENTINEL,
  GOVCC_SENTINEL,
  SAMPLE_ROOT,
  SAMPLE_UNIT_MAP,
  SSN_SENTINEL,
  sampleContactsMatrix,
  sampleReportMatrix,
} from '../src/logic/sample.js';
import { prepareSettings } from '../src/logic/settings.js';

function sampleRun() {
  const settings = prepareSettings({
    letterDate: '2026-10-01',
    reportAsOf: '2026-10-01',
    unitMap: SAMPLE_UNIT_MAP,
    dtsRoot: SAMPLE_ROOT,
  }, '2026-10-01');
  const report = extractRows(sampleReportMatrix(), REPORT_FIELDS);
  const contacts = extractRows(sampleContactsMatrix(), CONTACT_FIELDS, { mustIncludeNorms: ['emailaddress'] });
  return analyzeReport({
    reportRows: report.rows,
    contactRows: contacts.rows,
    settings,
    existingTracker: [],
  });
}

test('synthetic sample matches cardholders, DTAs, categories, and dashboard totals', () => {
  const { current, tracker } = sampleRun();
  const blob = JSON.stringify(tracker);
  assert.equal(blob.includes(SSN_SENTINEL), false);
  assert.equal(blob.includes(GOVCC_SENTINEL), false);
  assert.equal(blob.includes(BLANK_SENTINEL), false);
  assert.equal(blob.includes('4485123456789012'), false);
  assert.equal(current.some((row) => row.last === 'Zero'), false);
  assert.equal(current.length, 10);

  const byKey = Object.fromEntries(current.map((row) => [row.key, row]));
  const rivera = byKey.RIVERA_JORDAN_A;
  assert.equal(rivera.category, '30');
  assert.equal(rivera.acctLast4, '9012');
  assert.equal(rivera.email, 'jordan.a.rivera@unit.example.mil');
  assert.equal(rivera.rank, 'SGT');
  assert.equal(rivera.confidence, 'HIGH');
  assert.equal(rivera.dtaCc, 'dana.cho@unit.example.mil');
  assert.equal(rivera.needsReview, false);

  assert.equal(byKey.RIVERA_JORDAN_A_9999.category, '90');
  assert.equal(byKey.RIVERA_JORDAN_A_9999.acctLast4, '9999');

  const chen = current.find((row) => row.last === 'Chen');
  assert.equal(chen.category, '60');
  assert.equal(chen.email, 'morgan.p.chen@unit.example.mil');
  assert.equal(chen.dtaCc, 'samir.cole@unit.example.mil');
  assert.match(chen.matchNote, /MI tie-break/);

  const patel = current.find((row) => row.last === 'Patel');
  assert.equal(patel.category, '90');
  assert.equal(patel.confidence, 'MEDIUM');
  assert.match(patel.reviewReason, /non-\.mil/);
  assert.equal(patel.dtaCc, 'samir.cole@unit.example.mil');
  assert.equal(patel.status, 'Ready');

  const nguyen = current.find((row) => row.last === 'Nguyen');
  assert.equal(nguyen.category, '120+');
  assert.equal(nguyen.oldest, '150');
  assert.equal(nguyen.rank, 'CPT');

  const diaz = current.find((row) => row.last === 'Diaz');
  assert.equal(diaz.category, '120+');
  assert.equal(diaz.oldest, '180+');
  assert.equal(diaz.dtaCc, 'remy.santos@unit.example.mil');
  assert.equal(diaz.qualifier, 'Suspended');

  const brooks = current.find((row) => row.last === 'Brooks');
  assert.equal(brooks.confidence, 'AMBIGUOUS');
  assert.equal(brooks.email, '');
  assert.equal(brooks.status, 'Needs Review');
  assert.equal(brooks.dtaCc, 'remy.santos@unit.example.mil');

  const okonkwo = current.find((row) => row.last === 'Okonkwo');
  assert.equal(okonkwo.confidence, 'NONE');
  assert.equal(okonkwo.dtaCc, 'dana.cho@unit.example.mil');

  const hale = current.find((row) => row.last === 'Hale');
  assert.equal(hale.confidence, 'LOW');
  assert.match(hale.reviewReason, /could be CPL/);
  assert.equal(hale.needsReview, true);
  assert.equal(hale.status, 'Ready');

  const shah = current.find((row) => row.last === 'Shah');
  assert.match(shah.reviewReason, /Account closed/);
  assert.equal(shah.needsReview, false);

  assert.equal(current.some((row) => String(row.dtaCc).includes('pat.lee@')), false);

  const stats = dashboardStats(current);
  assert.equal(stats.cardholders, 10);
  assert.equal(stats.suspended, 1);
  assert.equal(stats.closedWithBalance, 1);
  assert.equal(stats.matchRate, 0.8);
  assert.equal(Number(stats.delinquentDollars.toFixed(2)), 5420.25);
  assert.equal(Number(stats.openBalance.toFixed(2)), 6060.5);
  assert.deepEqual(stats.ranking.map((row) => row.name), ['505', '336', '259']);
});
