import assert from 'node:assert/strict';
import test from 'node:test';
import { categorize } from '../src/logic/category.js';

test('oldest aging bucket sets the category and 120/150/180+ collapse to 120+', () => {
  assert.equal(categorize({ d30: 0, d60: 0, d90: 0, d120: 0, d150: 0, d180: 0 }), null);
  assert.equal(categorize({ d30: 0.004, d60: 0, d90: 0, d120: 0, d150: 0, d180: 0 }), null);

  const only30 = categorize({ d30: 42, d60: 0, d90: 0, d120: 0, d150: 0, d180: 0 });
  assert.equal(only30.category, '30');
  assert.equal(only30.oldest, '30');
  assert.equal(only30.delinquent, 42);

  const mixed = categorize({ d30: 10, d60: 0, d90: 25, d120: 0, d150: 0, d180: 0 });
  assert.equal(mixed.category, '90');
  assert.equal(mixed.oldest, '90');
  assert.equal(mixed.delinquent, 35);

  const plus = categorize({ d30: 10, d60: 0, d90: 0, d120: 0, d150: 80, d180: 0 });
  assert.equal(plus.category, '120+');
  assert.equal(plus.oldest, '150');
  assert.equal(plus.b120, 80);
  assert.equal(plus.delinquent, 90);

  const oldest = categorize({ d30: 0, d60: 0, d90: 0, d120: 5, d150: 6, d180: 7 });
  assert.equal(oldest.category, '120+');
  assert.equal(oldest.oldest, '180+');
  assert.equal(oldest.b120, 18);

  const dust = categorize({ d30: 0.004, d60: 10, d90: 0, d120: 0, d150: 0, d180: 0 });
  assert.equal(dust.oldest, '60');
  assert.equal(dust.delinquent, 10.004);
});
