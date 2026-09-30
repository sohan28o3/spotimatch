import { test } from 'node:test';
import assert from 'node:assert/strict';

// Test username suggestion algorithm used during onboarding
function suggestUsername(user) {
  if (!user) return 'listener';
  let base = '';
  if (user.email) {
    base = user.email.split('@')[0].toLowerCase();
  } else if (user.displayName) {
    base = user.displayName.toLowerCase().replace(/\s+/g, '_');
  }
  base = base.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) return 'listener';
  if (base.length < 3) {
    base = `${base}_fan`.replace(/^_+/, '');
  }
  if (base.length < 3 || !/^[a-z0-9_]{3,24}$/.test(base)) base = 'listener';
  if (base.length > 24) base = base.slice(0, 24);
  return base;
}

test('suggestUsername extracts valid usernames from Gmail addresses', () => {
  assert.equal(suggestUsername({ email: 'john.doe@gmail.com' }), 'john_doe');
  assert.equal(suggestUsername({ email: 'alex.river.99@gmail.com' }), 'alex_river_99');
  assert.equal(suggestUsername({ email: 'music_lover_2026@gmail.com' }), 'music_lover_2026');
});

test('suggestUsername handles short emails and special characters gracefully', () => {
  assert.equal(suggestUsername({ email: 'ab@gmail.com' }), 'ab_fan');
  assert.equal(suggestUsername({ email: '___@gmail.com' }), 'listener');
  assert.equal(suggestUsername({ displayName: 'Maya Chen' }), 'maya_chen');
  assert.equal(suggestUsername(null), 'listener');
});

test('suggestUsername strictly satisfies the database username regex ^[a-z0-9_]{3,24}$', () => {
  const usernameRegex = /^[a-z0-9_]{3,24}$/;
  const testCases = [
    { email: 'user.name+tag@gmail.com' },
    { email: 'a.b.c.d.e@gmail.com' },
    { displayName: 'Cool Musician & Producer!' },
    { email: 'extremely_long_username_that_exceeds_twenty_four_characters@gmail.com' },
    { email: '123@gmail.com' },
    { email: 'z@gmail.com' },
  ];
  for (const c of testCases) {
    const handle = suggestUsername(c);
    assert.match(handle, usernameRegex, `Failed for input: ${JSON.stringify(c)} -> ${handle}`);
  }
});
