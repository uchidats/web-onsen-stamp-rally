// Presentation only: existing auth/sync controls retain their original listeners and data handling.
(function (root) {
  'use strict';
  const doc = root.document;
  function init() {
    const $ = id => doc.getElementById(id), toggle = $('accountSettings'), panel = $('accountPanel');
    if (!toggle || !panel) return;
    // Keep the panel clear of the hero's clipped background and stacking context.
    doc.body.appendChild(panel);
    function position() {
      const rect = toggle.getBoundingClientRect(), top = Math.max(12, Math.min(rect.bottom + 12, root.innerHeight - 112));
      panel.style.top = top + 'px';
      panel.style.right = Math.max(16, doc.documentElement.clientWidth - rect.right) + 'px';
      panel.style.maxHeight = Math.max(96, root.innerHeight - top - 16) + 'px';
    }
    function close(restoreFocus = false) {
      if (panel.hidden) return;
      panel.hidden = true; toggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus) toggle.focus();
    }
    function open() {
      panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); position(); $('accountPanelClose').focus();
    }
    toggle.addEventListener('click', () => panel.hidden ? open() : close(true));
    $('accountPanelClose').addEventListener('click', () => close(true));
    doc.addEventListener('click', e => { if (!panel.contains(e.target) && !toggle.contains(e.target)) close(); });
    doc.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); close(true); } });
    doc.addEventListener('focusin', e => { if (!panel.hidden && !panel.contains(e.target) && e.target !== toggle) close(); });
    panel.addEventListener('click', e => {
      if (e.target.closest('#loginBtn, #cloudDeleteOpen, #syncStart, #syncConflictsBtn, #syncReconcile, #syncRetry')) close();
    });
    root.addEventListener('resize', () => { if (!panel.hidden) position(); });
    root.addEventListener('scroll', () => { if (!panel.hidden) position(); }, { passive: true });

    const labels = { synced: '同期済み', syncing: '同期中…', offline: 'オフライン', error: '同期エラー', conflicts: '競合あり', consent: '未開始', cloudReset: '同期停止中', deleting: '削除中' };
    function render() {
      const controller = root.OnsenAuth && root.OnsenAuth.controller;
      const auth = controller ? controller.getState() : null, signedIn = auth && auth.status === 'signedIn';
      const source = $('syncStatus'), state = signedIn && !source.hidden ? source.dataset.state : null;
      const text = labels[state] || (signedIn ? '確認中…' : '端末内保存');
      const compact = $('accountCompactStatus');
      compact.textContent = (state === 'synced' ? '✓ ' : ['error', 'conflicts', 'cloudReset'].includes(state) ? '⚠ ' : '') + text;
      compact.dataset.state = state || 'local';
      compact.title = state === 'error' || state === 'offline' ? source.textContent : text;
      $('accountSyncText').textContent = signedIn ? text : '未ログイン';
      $('accountSignedOut').hidden = !!signedIn;
      $('accountLocalOnly').hidden = !!controller;
    }
    new root.MutationObserver(render).observe($('syncStatus'), { attributes: true, childList: true, subtree: true });
    if (root.OnsenAuth && root.OnsenAuth.controller) root.OnsenAuth.controller.subscribe(render);
    render();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(window);
