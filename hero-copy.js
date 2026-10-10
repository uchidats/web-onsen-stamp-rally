(function(root) {
  'use strict';

  const COPIES = {
    ja: [
      'まだ知らない名湯が、きっとある。',
      '人はなぜ、温泉が恋しくなるのだろう。',
      '私にとっての、本物の温泉はどこだろう。',
      '地球の鼓動に、身をゆだねる。',
      'さあ、温泉の魅力を語ろう。'
    ]
  };
  const STORAGE_KEY = 'onsen-hero-copy-ja';

  function choose(copies, previous, random = Math.random) {
    const alternatives = copies.filter(copy => copy !== previous);
    const pool = alternatives.length ? alternatives : copies;
    return pool[Math.floor(random() * pool.length)];
  }

  root.OnsenHeroCopy = { COPIES, choose };
  const target = root.document?.getElementById('heroCopy');
  if (!target) return;

  let previous;
  try { previous = root.sessionStorage.getItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
  const copy = choose(COPIES.ja, previous);
  // Short phrase groups avoid breaking Japanese expressions on narrow screens.
  const phrases = copy === '人はなぜ、温泉が恋しくなるのだろう。'
    ? ['人はなぜ、', '温泉が', '恋しくなるのだろう。']
    : copy.match(/[^、]+、?/g) || [copy];
  target.replaceChildren(...phrases.map(phrase => {
    const span = root.document.createElement('span');
    span.textContent = phrase;
    return span;
  }));
  try { root.sessionStorage.setItem(STORAGE_KEY, copy); } catch { /* Still display a random copy. */ }
})(typeof window === 'undefined' ? globalThis : window);
