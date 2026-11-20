import assert from 'node:assert/strict';
import test from 'node:test';
import { addBusinessDays, DEFAULT_HOLIDAYS, milDate } from '../src/logic/dates.js';

test('suspense skips weekends and federal holidays and does not count the start date', () => {
  assert.equal(addBusinessDays('2026-11-13', 10, DEFAULT_HOLIDAYS), '2026-11-30');
  assert.equal(addBusinessDays('2026-11-14', 10, DEFAULT_HOLIDAYS), '2026-11-30');
  assert.equal(addBusinessDays('2026-07-02', 10, DEFAULT_HOLIDAYS), '2026-07-17');
  assert.equal(addBusinessDays('2026-10-01', 10, DEFAULT_HOLIDAYS), '2026-10-16');
  assert.equal(milDate('2026-10-16'), '16 October 2026');
  assert.equal(milDate('2026-11-30'), '30 November 2026');
});
