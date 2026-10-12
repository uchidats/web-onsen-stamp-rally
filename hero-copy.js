(function(root) {
  'use strict';

  const COPIES = {
    ja: [
      'まだ知らない名湯が、きっとある。',
      '温泉に浸かる。それだけでいい。',
      '私にとっての、本物の温泉はどこだろう。',
      '地球の鼓動に、身をゆだねる。',
      'さあ、温泉の魅力を語ろう。',
      '命の洗濯、してますか？'
    ]
  };
  const SEASONAL_COPY = '温泉の恋しい季節がやってきました。';
  const WINTER_COPY = '乳白の湯、湯けむりと雪景色のシンフォニー。';
  const STORAGE_KEY = 'onsen-hero-copy-ja';

  function candidates(date = new Date()) {
    // Browser-local months, every year: October–March and December–February.
    const month = date.getMonth();
    const pool = [...COPIES.ja];
    if (month >= 9 || month <= 2) pool.push(SEASONAL_COPY);
    if (month === 11 || month <= 1) pool.push(WINTER_COPY);
    return pool;
  }

  function choose(copies, previous, random = Math.random) {
    const alternatives = copies.filter(copy => copy !== previous);
    const pool = alternatives.length ? alternatives : copies;
    return pool[Math.floor(random() * pool.length)];
  }

  root.OnsenHeroCopy = { COPIES, candidates, choose };
  const target = root.document?.getElementById('heroCopy');
  if (!target) return;

  let previous;
  try { previous = root.sessionStorage.getItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
  const copy = choose(candidates(), previous);
  // Short phrase groups avoid breaking Japanese expressions on narrow screens.
  const phrases = copy === SEASONAL_COPY
    ? ['温泉の恋しい季節が', 'やってきました。']
    : copy === '温泉に浸かる。それだけでいい。'
      ? ['温泉に浸かる。', 'それだけでいい。']
      : copy.match(/[^、]+、?/g) || [copy];
  target.replaceChildren(...phrases.map(phrase => {
    const span = root.document.createElement('span');
    span.textContent = phrase;
    return span;
  }));
  try { root.sessionStorage.setItem(STORAGE_KEY, copy); } catch { /* Still display a random copy. */ }
})(typeof window === 'undefined' ? globalThis : window);
