import assert from 'node:assert/strict';
import test from 'node:test';
import { normHeader } from '../src/logic/normalize.js';
import {
  CONTACT_FIELDS,
  REPORT_FIELDS,
  extractRows,
  readWorkbook,
  workbookFromAoa,
} from '../src/logic/parse.js';
import {
  BLANK_SENTINEL,
  GOVCC_SENTINEL,
  SSN_SENTINEL,
  sampleContactsMatrix,
  sampleReportMatrix,
} from '../src/logic/sample.js';

const OFFICIAL_REPORT = [
  'Hierarchy Name (Level 4)',
  'Hierarchy Name (Level 5)',
  'Hierarchy Name (Level 6)',
  'Billing Type',
  'Account Number',
  'Cardholder Last Name',
  'Cardholder First Name',
  'Cardholder Middle Name',
  'SSN',
  'Account Status',
  '',
  'Qualifier',
  'Last Payment Date',
  'Payment Due Date',
  'Current Balance',
  'Past Due Amount',
  'Payment Amount CTD',
  'Payment Due Amount',
  '30 Day Past Due',
  '60 Day Past Due',
  '90 Day Past Due',
  '120 Day Past Due',
  '150 Days Past Due',
  '180+ Days Past Due',
  'BDE',
];

test('header names normalize Day and Days to the same key', () => {
  assert.equal(normHeader('30 Day Past Due'), normHeader('30 Days Past Due'));
  assert.equal(normHeader('150 Days Past Due'), '150daypastdue');
  assert.equal(normHeader('180+ Days Past Due'), '180+daypastdue');
});

test('columns are found by header name, and SSN, GOVCC, and blank columns are not read', () => {
  const report = extractRows(sampleReportMatrix(), REPORT_FIELDS);
  const contacts = extractRows(sampleContactsMatrix(), CONTACT_FIELDS, {
    mustIncludeNorms: ['emailaddress', 'email'],
  });
  assert.equal(report.error, null);
  assert.equal(report.headerRow, 0);
  assert.equal(contacts.error, null);
  assert.equal(contacts.headerRow, 2);
  assert.ok(report.skippedSensitiveHeaders.includes('SSN'));
  assert.ok(contacts.skippedSensitiveHeaders.includes('GOVCC Account Number'));
  const blob = JSON.stringify({ report: report.rows, contacts: contacts.rows });
  assert.equal(blob.includes(SSN_SENTINEL), false);
  assert.equal(blob.includes(GOVCC_SENTINEL), false);
  assert.equal(blob.includes(BLANK_SENTINEL), false);
  assert.equal(blob.includes('4485123456789012'), false);
  assert.equal(blob.includes('4000000000000001'), false);
  const rivera = report.rows.find((row) => row.first === 'Jordan' && row.acctLast4 === '9012');
  assert.equal(rivera.last, 'Rivera');
  assert.equal(rivera.bde, '259');
  assert.equal(rivera.d30, 150.25);
  const chen = contacts.rows.find((row) => row.email === 'morgan.p.chen@unit.example.mil');
  assert.equal(chen.last, 'Chen');
  assert.equal(chen.mi, 'P');
  assert.equal(chen.org.endsWith('336101'), true);
});

test('an xlsx account number stored as text keeps all 16 digits and only the last 4 is returned', () => {
  const data = OFFICIAL_REPORT.map(() => '');
  data[0] = 'MIRC';
  data[1] = '259 MI BDE';
  data[2] = 'A CO 259';
  data[3] = 'IBA';
  data[5] = 'Rivera';
  data[6] = 'Jordan';
  data[7] = 'Anthony';
  data[8] = SSN_SENTINEL;
  data[9] = 'Open';
  data[10] = BLANK_SENTINEL;
  data[14] = 400.5;
  data[15] = 150.25;
  data[18] = 150.25;
  data[24] = '259';
  const contacts = [
    'First Name', 'Middle Initial', 'Last Name', 'Organization Name', 'Email Address',
    'Permission Levels', 'Civilian/Military Status', 'Title/Rank', 'Printed Organization Name',
    'Government Charge Card (GOVCC) Holder', 'GOVCC Account Number', 'GOVCC Expiration Date',
  ];
  const contactData = [
    'Jordan', 'A', 'Rivera', 'DA240ARC99DMRC259301', 'jordan.a.rivera@unit.example.mil',
    '0', 'Military', 'E5', 'Sample Unit', 'Y', GOVCC_SENTINEL, '2030-01',
  ];
  const bytes = workbookFromAoa([
    { name: 'IBA and CBA Delinquency Report', rows: [OFFICIAL_REPORT, data], strings: { E2: '4485123456789012' } },
    {
      name: 'Traveler and DTA Contacts',
      rows: [
        ['Complete Traveler Information List Report'],
        ['Organization: DA240ARC99DMRC'],
        contacts,
        contactData,
      ],
    },
  ]);
  const picked = readWorkbook(bytes);
  assert.equal(picked.reportSheet, 'IBA and CBA Delinquency Report');
  assert.equal(picked.contactsSheet, 'Traveler and DTA Contacts');
  const report = extractRows(picked.report, REPORT_FIELDS);
  const contactRows = extractRows(picked.contacts, CONTACT_FIELDS, { mustIncludeNorms: ['emailaddress'] });
  const parsed = JSON.stringify({ report: report.rows, contacts: contactRows.rows });
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].acctLast4, '9012');
  assert.equal(report.rows[0].last, 'Rivera');
  assert.equal(parsed.includes('4485123456789012'), false);
  assert.equal(parsed.includes(SSN_SENTINEL), false);
  assert.equal(parsed.includes(GOVCC_SENTINEL), false);
  assert.equal(parsed.includes(BLANK_SENTINEL), false);
  assert.equal(JSON.stringify(picked.report).includes(SSN_SENTINEL), false);
  assert.equal(JSON.stringify(picked.contacts).includes(GOVCC_SENTINEL), false);
});
