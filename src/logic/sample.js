/** Synthetic cardholders and DTS contacts. No real names, emails, or account numbers. */

export const SSN_SENTINEL = 'SSN-DO-NOT-READ';
export const GOVCC_SENTINEL = 'GOVCC-DO-NOT-READ';
export const BLANK_SENTINEL = 'BLANK-COL-SENTINEL';
export const SAMPLE_ROOT = 'DA240ARC99DMRC';

export const SAMPLE_UNIT_MAP = [
  '259 MI BDE=259',
  'A CO 259=259301',
  '336 MI BDE=336',
  'HHC 336=336101',
  '505 MI BDE=505',
  'B CO 505=505210',
].join('\n');

const REPORT_HEADERS = [
  'BDE',
  'Cardholder Last Name',
  'SSN',
  '30 Day Past Due',
  'Account Number',
  'Cardholder First Name',
  'Hierarchy Name (Level 6)',
  'Past Due Amount',
  '60 Day Past Due',
  'Account Status',
  '',
  '90 Day Past Due',
  'Cardholder Middle Name',
  'Qualifier',
  'Current Balance',
  '120 Day Past Due',
  '150 Days Past Due',
  'Hierarchy Name (Level 5)',
  '180+ Days Past Due',
  'Hierarchy Name (Level 4)',
  'Billing Type',
];

function reportRow(map) {
  return REPORT_HEADERS.map((header) => {
    if (header === '') return BLANK_SENTINEL;
    if (header === 'SSN') return map.SSN || SSN_SENTINEL;
    return map[header] ?? '';
  });
}

function soldier(map) {
  return reportRow({
    'Hierarchy Name (Level 4)': 'MIRC',
    'Billing Type': 'IBA',
    'Account Status': 'Open',
    Qualifier: '',
    '30 Day Past Due': 0,
    '60 Day Past Due': 0,
    '90 Day Past Due': 0,
    '120 Day Past Due': 0,
    '150 Days Past Due': 0,
    '180+ Days Past Due': 0,
    ...map,
  });
}

export function sampleReportMatrix() {
  return [
    REPORT_HEADERS,
    soldier({
      BDE: '259',
      'Cardholder Last Name': 'Rivera',
      'Cardholder First Name': 'Jordan',
      'Cardholder Middle Name': 'Anthony',
      'Hierarchy Name (Level 5)': '259 MI BDE',
      'Hierarchy Name (Level 6)': 'A CO 259',
      'Account Number': '4485123456789012',
      '30 Day Past Due': 150.25,
      'Past Due Amount': 150.25,
      'Current Balance': 400.5,
    }),
    soldier({
      BDE: '336',
      'Cardholder Last Name': 'Chen',
      'Cardholder First Name': 'Morgan',
      'Cardholder Middle Name': 'Parker',
      'Hierarchy Name (Level 5)': '336 MI BDE',
      'Hierarchy Name (Level 6)': 'HHC 336',
      'Account Number': '4222222222224242',
      '30 Day Past Due': 20,
      '60 Day Past Due': 200,
      'Past Due Amount': 220,
      'Current Balance': 220,
    }),
    soldier({
      BDE: '336',
      'Cardholder Last Name': 'Patel',
      'Cardholder First Name': 'Avery',
      'Cardholder Middle Name': '',
      'Hierarchy Name (Level 5)': '336 MI BDE',
      'Hierarchy Name (Level 6)': 'HHC 336',
      'Account Number': '4333333333334343',
      '30 Day Past Due': 5,
      '90 Day Past Due': 500,
      'Past Due Amount': 505,
      'Current Balance': 505,
    }),
    soldier({
      BDE: '336',
      'Cardholder Last Name': 'Nguyen',
      'Cardholder First Name': 'Quinn',
      'Cardholder Middle Name': 'Lee',
      'Hierarchy Name (Level 5)': '336 MI BDE',
      'Hierarchy Name (Level 6)': 'HHC 336',
      'Account Number': '4444444444444444',
      '30 Day Past Due': 10,
      '150 Days Past Due': 1000,
      'Past Due Amount': 1010,
      'Current Balance': 1200,
    }),
    soldier({
      BDE: '505',
      'Cardholder Last Name': 'Diaz',
      'Cardholder First Name': 'Riley',
      'Cardholder Middle Name': 'James',
      'Hierarchy Name (Level 5)': '505 MI BDE',
      'Hierarchy Name (Level 6)': 'B CO 505',
      'Account Number': '4555555555555555',
      Qualifier: 'Suspended',
      '180+ Days Past Due': 2500,
      'Past Due Amount': 2500,
      'Current Balance': 2600,
    }),
    soldier({
      BDE: '505',
      'Cardholder Last Name': 'Brooks',
      'Cardholder First Name': 'Taylor',
      'Cardholder Middle Name': '',
      'Hierarchy Name (Level 5)': '505 MI BDE',
      'Hierarchy Name (Level 6)': 'B CO 505',
      'Account Number': '4666666666666666',
      '30 Day Past Due': 100,
      'Past Due Amount': 100,
      'Current Balance': 100,
    }),
    soldier({
      BDE: '259',
      'Cardholder Last Name': 'Okonkwo',
      'Cardholder First Name': 'Sam',
      'Cardholder Middle Name': '',
      'Hierarchy Name (Level 5)': '259 MI BDE',
      'Hierarchy Name (Level 6)': 'A CO 259',
      'Account Number': '4777777777777777',
      '30 Day Past Due': 800,
      'Past Due Amount': 800,
      'Current Balance': 900,
    }),
    soldier({
      BDE: '336',
      'Cardholder Last Name': 'Hale',
      'Cardholder First Name': 'Alex',
      'Cardholder Middle Name': 'Quinn',
      'Hierarchy Name (Level 5)': '336 MI BDE',
      'Hierarchy Name (Level 6)': 'HHC 336',
      'Account Number': '4888888888888888',
      '60 Day Past Due': 75,
      'Past Due Amount': 75,
      'Current Balance': 75,
    }),
    soldier({
      BDE: '505',
      'Cardholder Last Name': 'Shah',
      'Cardholder First Name': 'Jamie',
      'Cardholder Middle Name': '',
      'Hierarchy Name (Level 5)': '505 MI BDE',
      'Hierarchy Name (Level 6)': 'B CO 505',
      'Account Number': '4999999999999999',
      'Account Status': 'Closed',
      '30 Day Past Due': 50,
      'Past Due Amount': 50,
      'Current Balance': 50,
    }),
    soldier({
      BDE: '259',
      'Cardholder Last Name': 'Rivera',
      'Cardholder First Name': 'Jordan',
      'Cardholder Middle Name': 'Anthony',
      'Hierarchy Name (Level 5)': '259 MI BDE',
      'Hierarchy Name (Level 6)': 'A CO 259',
      'Account Number': '4000000000009999',
      '90 Day Past Due': 10,
      'Past Due Amount': 10,
      'Current Balance': 10,
    }),
    soldier({
      BDE: '259',
      'Cardholder Last Name': 'Zero',
      'Cardholder First Name': 'Nora',
      'Cardholder Middle Name': '',
      'Hierarchy Name (Level 5)': '259 MI BDE',
      'Hierarchy Name (Level 6)': 'A CO 259',
      'Account Number': '4000000000000001',
      'Current Balance': 0,
    }),
  ];
}

const CONTACT_HEADERS = [
  'Email Address',
  'Last Name',
  'Permission Levels',
  'GOVCC Account Number',
  'First Name',
  'Organization Name',
  'Title/Rank',
  'Middle Initial',
  'Civilian/Military Status',
  'Printed Organization Name',
  'Government Charge Card (GOVCC) Holder',
  'GOVCC Expiration Date',
];

function contactRow(map) {
  return CONTACT_HEADERS.map((header) => {
    if (header === 'GOVCC Account Number') return GOVCC_SENTINEL;
    return map[header] ?? '';
  });
}

export function sampleContactsMatrix() {
  const root = SAMPLE_ROOT;
  const people = [
    ['Jordan', 'A', 'Rivera', `${root}259301`, 'jordan.a.rivera@unit.example.mil', '0', 'E5'],
    ['Dana', 'Q', 'Cho', `${root}259`, 'dana.cho@unit.example.mil', '0, 5', 'CIV'],
    ['Morgan', 'L', 'Chen', `${root}505210`, 'morgan.l.chen@unit.example.mil', '0', 'SSG'],
    ['Morgan', 'P', 'Chen', `${root}336101`, 'morgan.p.chen@unit.example.mil', '0', 'SSG'],
    ['Samir', 'J', 'Cole', `${root}336101`, 'samir.cole@unit.example.mil', '5', 'CIV'],
    ['Pat', 'K', 'Lee', root, 'pat.lee@unit.example.mil', '5', 'CIV'],
    ['Avery', '', 'Patel', root, 'avery.patel@personal.example.com', '0', 'GS11'],
    ['Quinn', 'L', 'Nguyen', `${root}336101`, 'quinn.l.nguyen@unit.example.mil', '0', 'O3'],
    ['Riley', 'J', 'Diaz', `${root}505210`, 'riley.j.diaz@unit.example.mil', '0', 'E7'],
    ['Remy', 'A', 'Santos', `${root}505`, 'remy.santos@unit.example.mil', '5', 'CIV'],
    ['Taylor', 'S', 'Brooks', `${root}505210`, 'taylor.s.brooks@unit.example.mil', '0', 'E6'],
    ['Taylor', 'R', 'Brooks', `${root}505210`, 'taylor.r.brooks@unit.example.mil', '0', 'E6'],
    ['Alexander', 'Q', 'Hale', `${root}336101`, 'alexander.q.hale@unit.example.mil', '0', 'E4'],
    ['Jamie', '', 'Shah', `${root}505210`, 'jamie.shah@unit.example.mil', '0', 'E6'],
  ];
  const rows = people.map(([first, mi, last, org, email, perm, rank]) => contactRow({
    'First Name': first,
    'Middle Initial': mi,
    'Last Name': last,
    'Organization Name': org,
    'Email Address': email,
    'Permission Levels': perm,
    'Title/Rank': rank,
    'Civilian/Military Status': rank === 'CIV' ? 'Civilian' : 'Military',
    'Printed Organization Name': 'Sample Unit',
    'Government Charge Card (GOVCC) Holder': 'Y',
    'GOVCC Expiration Date': '2030-01',
  }));
  return [
    ['Complete Traveler Information List Report'],
    [`Organization: ${root}`],
    CONTACT_HEADERS,
    ...rows,
  ];
}
