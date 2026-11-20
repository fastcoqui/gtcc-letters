import assert from 'node:assert/strict';
import test from 'node:test';
import { dtasFor, indexContacts, matchContact, parentOrg } from '../src/logic/match.js';

const root = 'DA240ARC99DMRC';
const parent = `${root}259`;
const unit = `${root}259301`;
const other = `${root}336`;

function emails(index, indexes) {
  return indexes.map((i) => index.contacts[i].email).sort();
}

test('DTA lookup walks to the longest parent prefix and stops there', () => {
  const index = indexContacts([
    { first: 'Ada', last: 'Root', org: root, email: 'ada.root@unit.example.mil', perm: '5', rank: 'CIV' },
    { first: 'Bea', last: 'Parent', org: parent, email: 'bea.parent@unit.example.mil', perm: '5', rank: 'CIV' },
    { first: 'Dee', last: 'Also', org: parent, email: 'dee.also@unit.example.mil', perm: '0, 5', rank: 'CIV' },
    { first: 'Cam', last: 'Holder', org: unit, email: 'cam.holder@unit.example.mil', perm: '0', rank: 'E5' },
    { first: 'Gus', last: 'Other', org: other, email: 'gus.other@unit.example.mil', perm: '5', rank: 'CIV' },
  ]);
  assert.equal(parentOrg(unit, index.orgs), parent);
  assert.deepEqual(emails(index, dtasFor(index, unit, '')), [
    'bea.parent@unit.example.mil',
    'dee.also@unit.example.mil',
  ]);
  assert.equal(dtasFor(index, unit, 'bea.parent@unit.example.mil').length, 1);
});

test('a DTA on the cardholder org is used instead of the parent', () => {
  const index = indexContacts([
    { first: 'Ada', last: 'Root', org: root, email: 'ada.root@unit.example.mil', perm: '5' },
    { first: 'Bea', last: 'Parent', org: parent, email: 'bea.parent@unit.example.mil', perm: '5' },
    { first: 'Uma', last: 'Local', org: unit, email: 'uma.local@unit.example.mil', perm: '5' },
  ]);
  assert.deepEqual(emails(index, dtasFor(index, unit, 'uma.local@unit.example.mil')), [
    'bea.parent@unit.example.mil',
  ]);
  assert.deepEqual(emails(index, dtasFor(index, unit, '')), ['uma.local@unit.example.mil']);
});

test('middle initial and org tie-breaks choose one contact or leave the row ambiguous', () => {
  const index = indexContacts([
    { first: 'Morgan', mi: 'L', last: 'Chen', org: `${root}505`, email: 'morgan.l@unit.example.mil', perm: '0' },
    { first: 'Morgan', mi: 'P', last: 'Chen', org: `${root}336101`, email: 'morgan.p@unit.example.mil', perm: '0' },
    { first: 'Taylor', mi: 'S', last: 'Brooks', org: unit, email: 'taylor.s@unit.example.mil', perm: '0' },
    { first: 'Taylor', mi: 'R', last: 'Brooks', org: unit, email: 'taylor.r@unit.example.mil', perm: '0' },
  ]);
  const chen = matchContact(index, 'Chen', 'Morgan', 'Parker', `${root}336101`, `${root}336`);
  assert.equal(chen.confidence, 'HIGH');
  assert.equal(index.contacts[chen.index].email, 'morgan.p@unit.example.mil');
  assert.match(chen.note, /MI tie-break/);

  const brooks = matchContact(index, 'Brooks', 'Taylor', '', unit, parent);
  assert.equal(brooks.confidence, 'AMBIGUOUS');
  assert.equal(brooks.index, -1);
  assert.match(brooks.note, /taylor.s@unit.example.mil/);
  assert.match(brooks.note, /taylor.r@unit.example.mil/);
});
