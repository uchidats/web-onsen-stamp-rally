const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(data) {
  const element = () => ({ hidden: false, children: [], append(...nodes) { this.children.push(...nodes); }, replaceChildren() { this.children = []; } });
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const pending = element();
  get('mapUnverifiedCount').parentElement = pending;
  let pref = '', status = '', selected;
  const root = { JapanPrefMap: { PREFECTURES: [] }, addEventListener() {} };
  const document = { getElementById: get, createElement: element, querySelector: () => null, head: element() };
  vm.runInNewContext(fs.readFileSync('map.js', 'utf8'), { window: root, document });
  // Script loading remains pending in this DOM stub; no Leaflet or network needed.
  const map = root.OnsenMap.create({ data, isVisited: () => false, onDetail: id => { selected = id; }, getSelectedPref: () => pref, getStatus: () => status });
  return { get, pending, selected: () => selected, refresh(nextPref = '', nextStatus = '') { pref = nextPref; status = nextStatus; map.refresh(); } };
}

const verified = { id: 'test-verified', facility: '確認済み', prefecture: '青森県', coordinateVerified: true, latitude: 40, longitude: 140, coordinateSource: 'https://example.com/coordinate', coordinateCheckedAt: '2026-10-11' };

test('Zero pending facilities hide the entire disclosure nationally and by prefecture', () => {
  const ui = setup([verified]);
  assert.equal(ui.pending.hidden, true);
  assert.equal(ui.get('mapUnverifiedCount').textContent, '位置確認中 0施設（全国 0施設）');
  assert.equal(ui.get('mapUnverified').children.length, 0);
  ui.refresh('青森県');
  assert.equal(ui.pending.hidden, true);
  ui.refresh('長野県');
  assert.equal(ui.pending.hidden, true);
});

test('Pending facilities remain accessible; regional counts and filters retain existing rules', () => {
  const unknown = { ...verified, id: 'test-pending', facility: '確認待ち', coordinateVerified: false };
  const ui = setup([verified, unknown]);
  assert.equal(ui.pending.hidden, false);
  assert.equal(ui.get('mapUnverifiedCount').textContent, '位置確認中 1施設（全国 1施設）');
  const button = ui.get('mapUnverified').children[0].children[0];
  assert.equal(button.textContent, '確認待ち（青森県）');
  button.onclick();
  assert.equal(ui.selected(), unknown.id);
  ui.refresh('青森県', 'visited');
  assert.equal(ui.pending.hidden, false, 'Visit filters do not change coordinate verification counts');
  assert.equal(ui.get('mapUnverified').children.length, 1);
  ui.refresh('長野県');
  assert.equal(ui.pending.hidden, true, 'A prefecture with zero pending facilities hides even when national count is positive');
  assert.equal(ui.get('mapUnverifiedCount').textContent, '位置確認中 0施設（全国 1施設）');
  assert.equal(ui.get('mapUnverified').children.length, 0);
  ui.refresh();
  assert.equal(ui.pending.hidden, false);
  unknown.coordinateVerified = true;
  ui.refresh();
  assert.equal(ui.pending.hidden, true, 'Refresh hides a list that becomes empty');
  unknown.coordinateVerified = false;
  ui.refresh();
  assert.equal(ui.pending.hidden, false, 'Refresh reveals newly pending facilities');
});
