const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('hero-copy.js', 'utf8');

test('Every copy is reachable, previous copy is excluded, and stale values are harmless', () => {
  const context = {};
  vm.runInNewContext(code, context);
  const { COPIES, choose } = context.OnsenHeroCopy;
  assert.equal(COPIES.ja.length, 5);
  for (const previous of [undefined, 'old copy', ...COPIES.ja]) {
    const results = new Set(Array.from({ length: 100 }, (_, i) => choose(COPIES.ja, previous, () => i / 100)));
    assert.equal(results.size, COPIES.ja.includes(previous) ? 4 : 5);
    assert.equal(results.has(previous), false);
  }
});

test('Blocked sessionStorage still renders safely without accessing visit storage', () => {
  const target = { replaceChildren(...children) { this.text = children.map(x => x.textContent).join(''); } };
  const window = {
    document: { getElementById: () => target, createElement: () => ({}) },
    get sessionStorage() { throw new Error('Storage blocked'); },
    get localStorage() { throw new Error('Visit storage must not be accessed'); }
  };
  vm.runInNewContext(code, { window });
  assert.ok(window.OnsenHeroCopy.COPIES.ja.includes(target.text));
});
