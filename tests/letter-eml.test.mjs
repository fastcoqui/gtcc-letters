import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { analyzeReport } from '../src/logic/analyze.js';
import { buildEml } from '../src/logic/eml.js';
import { buildOneDraft, buildZip } from '../src/logic/files.js';
import { letterPlain, buildLetterBlocks, suspenseISO } from '../src/logic/letter.js';
import { CONTACT_FIELDS, REPORT_FIELDS, extractRows } from '../src/logic/parse.js';
import { SAMPLE_ROOT, SAMPLE_UNIT_MAP, sampleContactsMatrix, sampleReportMatrix } from '../src/logic/sample.js';
import { prepareSettings } from '../src/logic/settings.js';

test('a letter and .eml draft are files only: highlighted blanks, the right suspense, and a docx attachment', async () => {
  const settings = prepareSettings({
    letterDate: '2026-10-01',
    reportAsOf: '2026-10-01',
    unitMap: SAMPLE_UNIT_MAP,
    dtsRoot: SAMPLE_ROOT,
    suspenseBusinessDays: 10,
  }, '2026-10-01');
  const report = extractRows(sampleReportMatrix(), REPORT_FIELDS);
  const contacts = extractRows(sampleContactsMatrix(), CONTACT_FIELDS, { mustIncludeNorms: ['emailaddress'] });
  const { current } = analyzeReport({
    reportRows: report.rows,
    contactRows: contacts.rows,
    settings,
    existingTracker: [],
  });
  const rivera = current.find((row) => row.key === 'RIVERA_JORDAN_A');
  assert.equal(suspenseISO(settings), '2026-10-16');
  const plain = letterPlain(buildLetterBlocks(rivera, settings));
  assert.match(plain, /1 October 2026/);
  assert.match(plain, /16 October 2026/);
  assert.match(plain, /SGT Jordan A\. Rivera/);
  assert.match(plain, /30-day delinquent status/);
  assert.match(plain, /30-Day Status/);
  assert.match(plain, /\[POC Name, rank\]/);
  assert.match(plain, /\[SIGNATURE NAME\]/);
  assert.match(plain, /400\.50/);
  assert.match(plain, /150\.25/);
  assert.match(plain, /CIV Dana Cho/);
  assert.equal(plain.includes('4485123456789012'), false);

  const draft = await buildOneDraft(rivera, settings);
  assert.equal(draft.to, 'jordan.a.rivera@unit.example.mil');
  assert.match(draft.cc, /dana\.cho@unit\.example\.mil/);
  assert.equal(draft.cc.includes('pat.lee@'), false);
  assert.match(draft.eml, /X-Unsent: 1/);
  assert.match(draft.eml, /multipart\/mixed/);
  assert.equal(/\bsmtp\b/i.test(draft.eml), false);
  assert.equal(/\.send\s*\(/.test(draft.eml), false);

  const boundary = draft.eml.match(/boundary="([^"]+)"/)[1];
  const attachment = draft.eml.split(`--${boundary}`).find((part) => part.includes('wordprocessingml'));
  const payload = attachment.split(/\r\n\r\n/).pop().replace(/\s+/g, '');
  const bytes = Buffer.from(payload, 'base64');
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const docx = await JSZip.loadAsync(draft.docx);
  const documentXml = await docx.file('word/document.xml').async('string');
  assert.match(documentXml, /Jordan A\. Rivera/);
  assert.match(documentXml, /w:val="yellow"/);
  assert.match(documentXml, /POC Name, rank/);
  const headerXml = await docx.file('word/header1.xml').async('string');
  assert.match(headerXml, /MILITARY INTELLIGENCE READINESS COMMAND/);

  const zipBytes = await buildZip(current, settings);
  const zip = await JSZip.loadAsync(zipBytes.bytes);
  const names = Object.keys(zip.files);
  assert.ok(names.some((name) => name.includes('259/') && name.endsWith('Rivera_Jordan_A.docx')));
  assert.ok(names.some((name) => name.includes('259/') && name.endsWith('Rivera_Jordan_A.eml')));
  assert.equal(names.some((name) => name.includes('4485123456789012')), false);
});
