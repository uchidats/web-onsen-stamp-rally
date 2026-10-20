(function(root) {
  'use strict';

  const PATTERNS = ['mist', 'ridge', 'water', 'ryokan', 'lantern'];
  function choose(forced, random = Math.random) {
    return PATTERNS.includes(forced) ? forced : PATTERNS[Math.floor(random() * PATTERNS.length)];
  }
  root.OnsenHeroBackground = { PATTERNS, choose };
  if (!root.document) return;
  // QA: ?hero-bg=mist|ridge|water|ryokan|lantern. No storage or recurring timer.
  const forced = new URLSearchParams(root.location.search).get('hero-bg');
  root.document.documentElement.dataset.heroBackground = choose(forced);
})(typeof window === 'undefined' ? globalThis : window);
