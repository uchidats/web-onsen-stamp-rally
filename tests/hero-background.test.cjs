const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('hero-background.js', 'utf8');

test('Every background is reachable with equal random intervals; QA overrides accept only known patterns', () => {
  const root = {};
  vm.runInNewContext(code, root);
  const { PATTERNS, choose } = root.OnsenHeroBackground;
  assert.equal(PATTERNS.length, 5);
  for (const [index, pattern] of PATTERNS.entries()) {
    for (const offset of [.01, .5, .99]) assert.equal(choose(undefined, () => (index + offset) / 5), pattern);
    assert.equal(choose(pattern, () => { throw Error('Forced patterns must not use randomness'); }), pattern);
  }
  assert.equal(choose('unknown', () => .99), 'lantern');
  assert.equal(choose('', () => 0), 'mist');
});

test('Initialization chooses once without visit storage or timers, including when storage is blocked', () => {
  const dataset = {};
  let choices = 0;
  const window = {
    document: { documentElement: { dataset } }, location: { search: '' },
    get localStorage() { throw Error('Visit storage must not be accessed'); },
    get sessionStorage() { throw Error('Background does not need storage'); }
  };
  vm.runInNewContext(code, { window, URLSearchParams, Math: Object.assign(Object.create(Math), { random() { choices++; return .6; } }) });
  assert.equal(dataset.heroBackground, 'ryokan');
  assert.equal(choices, 1);
  window.location.search = '?hero-bg=water';
  assert.equal(dataset.heroBackground, 'ryokan', 'It stays fixed during the page lifetime');
  const forced = { document: { documentElement: { dataset: {} } }, location: { search: '?hero-bg=water' } };
  vm.runInNewContext(code, { window: forced, URLSearchParams });
  assert.equal(forced.document.documentElement.dataset.heroBackground, 'water');
});
