const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('hero-copy.js', 'utf8');

test('Every copy is reachable, previous copy is excluded, and stale values are harmless', () => {
  const context = {};
  vm.runInNewContext(code, context);
  const { COPIES, choose } = context.OnsenHeroCopy;
  assert.equal(COPIES.ja.length, 6);
  for (const previous of [undefined, 'old copy', ...COPIES.ja]) {
    const results = new Set(Array.from({ length: 100 }, (_, i) => choose(COPIES.ja, previous, () => i / 100)));
    assert.equal(results.size, COPIES.ja.includes(previous) ? 5 : 6);
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
  assert.ok(window.OnsenHeroCopy.candidates().includes(target.text));
});

test('Local months select the seasonal copy only October through March, every year', () => {
  const context = {};
  vm.runInNewContext(code, context);
  const { COPIES, candidates, choose } = context.OnsenHeroCopy;
  const seasonal = '温泉の恋しい季節がやってきました。';
  assert.ok(COPIES.ja.includes('温泉に浸かる。それだけでいい。'));
  assert.ok(!COPIES.ja.includes('人はなぜ、温泉が恋しくなるのだろう。'));
  for (const retained of ['まだ知らない名湯が、きっとある。', '私にとっての、本物の温泉はどこだろう。', '地球の鼓動に、身をゆだねる。', 'さあ、温泉の魅力を語ろう。', '命の洗濯、してますか？']) {
    assert.ok(COPIES.ja.includes(retained));
  }
  for (const year of [2026, 2027, 2028]) {
    for (let month = 0; month < 12; month++) {
      const pool = candidates(new Date(year, month, 1));
      const winter = month >= 9 || month <= 2;
      assert.equal(pool.includes(seasonal), winter);
      assert.equal(pool.length, winter ? 7 : 6);
      for (const previous of [undefined, 'old copy', seasonal, ...pool]) {
        const selected = new Set(Array.from({ length: 100 }, (_, i) => choose(pool, previous, () => i / 100)));
        assert.equal(selected.has(previous), false);
        assert.equal(selected.has(seasonal), winter && previous !== seasonal);
        assert.equal(selected.size, pool.includes(previous) ? pool.length - 1 : pool.length);
      }
    }
  }
  assert.ok(candidates({ getMonth: () => 9, getUTCMonth() { throw Error('UTC must not be used'); } }).includes(seasonal));
  assert.ok(!candidates({ getMonth: () => 8, getUTCMonth() { throw Error('UTC must not be used'); } }).includes(seasonal));
});

test('Rendering uses local date boundaries and avoids repeats across season changes', () => {
  const seasonal = '温泉の恋しい季節がやってきました。';
  for (const [month, previous, expected] of [[9, undefined, seasonal], [2, undefined, seasonal], [3, seasonal, '命の洗濯、してますか？'], [9, seasonal, '命の洗濯、してますか？']]) {
    const target = { replaceChildren(...children) { this.text = children.map(x => x.textContent).join(''); } };
    let saved;
    const window = {
      document: { getElementById: () => target, createElement: () => ({}) },
      sessionStorage: { getItem: () => previous, setItem: (_key, value) => { saved = value; } },
      get localStorage() { throw Error('Visit storage must not be accessed'); }
    };
    class LocalDate extends Date { constructor() { super(2026, month, 1); } getUTCMonth() { throw Error('UTC must not be used'); } }
    vm.runInNewContext(code, { window, Date: LocalDate, Math: Object.assign(Object.create(Math), { random: () => .999 }) });
    assert.equal(target.text, expected);
    assert.equal(saved, expected);
  }
});
