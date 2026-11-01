import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSlug,
  suggestSlug,
  validateSlug,
  RESERVED_SLUGS,
  MIN_SLUG_LENGTH,
  MAX_SLUG_LENGTH,
  SLUG_REGEX,
} from '../../lib/publishing/slug';

test('slug regex and length constraints', () => {
  assert.equal(MIN_SLUG_LENGTH, 3);
  assert.equal(MAX_SLUG_LENGTH, 48);

  // Valid slugs
  assert.ok(SLUG_REGEX.test('alex'));
  assert.ok(SLUG_REGEX.test('alex-chen'));
  assert.ok(SLUG_REGEX.test('dev123'));
  assert.ok(SLUG_REGEX.test('portfolio-2026-v2'));

  // Invalid slugs
  assert.ok(!SLUG_REGEX.test('alex_chen')); // underscore
  assert.ok(!SLUG_REGEX.test('-alex')); // leading dash
  assert.ok(!SLUG_REGEX.test('alex-')); // trailing dash
  assert.ok(!SLUG_REGEX.test('alex--chen')); // double dash
  assert.ok(!SLUG_REGEX.test('alex chen')); // space
  assert.ok(!SLUG_REGEX.test('Alex')); // uppercase
  assert.ok(!SLUG_REGEX.test('alex!')); // special characters
});

test('normalizeSlug transforms raw text to candidate slug', () => {
  assert.equal(normalizeSlug('Varshan Gowda'), 'varshan-gowda');
  assert.equal(normalizeSlug('  Jane   Doe  '), 'jane-doe');
  assert.equal(normalizeSlug('Developer & Designer!'), 'developer-designer');
  assert.equal(normalizeSlug('Café Développeur'), 'cafe-developpeur');
  assert.equal(normalizeSlug('---hello---world---'), 'hello-world');
  assert.equal(normalizeSlug('a'.repeat(60)).length, MAX_SLUG_LENGTH);
});

test('suggestSlug generates safe and non-reserved suggestions', () => {
  assert.equal(suggestSlug('Varshan Gowda'), 'varshan-gowda');
  assert.equal(suggestSlug('Alex'), 'alex');
  // Short name padded
  assert.equal(suggestSlug('Jo'), 'jo-portfolio');
  // Empty name falls back to my-portfolio
  assert.equal(suggestSlug(''), 'my-portfolio');
  // Reserved name falls back or modifies
  assert.notEqual(suggestSlug('admin'), 'admin');
  assert.ok(!RESERVED_SLUGS.has(suggestSlug('admin')));
});

test('validateSlug accepts valid slugs', () => {
  const result1 = validateSlug('varshan');
  assert.equal(result1.ok, true);
  if (result1.ok) assert.equal(result1.slug, 'varshan');

  const result2 = validateSlug('john-doe-portfolio');
  assert.equal(result2.ok, true);
  if (result2.ok) assert.equal(result2.slug, 'john-doe-portfolio');

  const result3 = validateSlug('dev2026');
  assert.equal(result3.ok, true);
  if (result3.ok) assert.equal(result3.slug, 'dev2026');
});

test('validateSlug rejects empty or too short/long slugs', () => {
  const empty = validateSlug('');
  assert.equal(empty.ok, false);

  const short = validateSlug('ab');
  assert.equal(short.ok, false);
  if (!short.ok) assert.match(short.error, /at least 3 characters/);

  const long = validateSlug('a'.repeat(49));
  assert.equal(long.ok, false);
  if (!long.ok) assert.match(long.error, /at most 48 characters/);
});

test('validateSlug rejects reserved routes', () => {
  for (const reserved of RESERVED_SLUGS) {
    const result = validateSlug(reserved);
    assert.equal(result.ok, false, `Expected reserved slug "${reserved}" to be rejected`);
    if (!result.ok) {
      assert.match(result.error, /reserved/i);
    }
  }
});

test('validateSlug rejects invalid format patterns', () => {
  assert.equal(validateSlug('User_Name').ok, false);
  assert.equal(validateSlug('-leading-dash').ok, false);
  assert.equal(validateSlug('trailing-dash-').ok, false);
  assert.equal(validateSlug('double--dash').ok, false);
  assert.equal(validateSlug('spaces in name').ok, false);
  assert.equal(validateSlug('special$char').ok, false);
});
