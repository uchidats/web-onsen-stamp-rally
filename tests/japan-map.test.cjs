const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Mock a lightweight DOM environment for JapanPrefMap.create testing
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    const set = new Set();
    this.classList = {
      _set: set,
      add(...classes) { for (const c of classes) set.add(c); },
      remove(...classes) { for (const c of classes) set.delete(c); },
      contains(c) { return set.has(c); },
      has(c) { return set.has(c); }
    };
    this.innerHTMLValue = '';
    this.hidden = false;
    this.style = {};
  }

  get innerHTML() {
    return this.innerHTMLValue;
  }

  set innerHTML(val) {
    this.innerHTMLValue = val;
    this.children = [];
    // Basic parser for child elements with class or data attributes
    const tagMatches = [...val.matchAll(/<([a-zA-Z0-9]+)([^>]*)>/g)];
    for (const match of tagMatches) {
      const tag = match[1];
      const attrStr = match[2];
      const el = new MockElement(tag);

      // parse attributes
      const attrMatches = [...attrStr.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)];
      for (const attr of attrMatches) {
        el.setAttribute(attr[1], attr[2]);
        if (attr[1] === 'class') {
          attr[2].split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
        }
      }
      this.children.push(el);
    }
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
    if (k === 'class') {
      this.classList._set.clear();
      String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList._set.add(c));
    }
  }

  getAttribute(k) {
    return this.attributes.get(k) || null;
  }

  removeAttribute(k) {
    this.attributes.delete(k);
    if (k === 'class') this.classList._set.clear();
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  dispatchEvent(event) {
    const handlers = this.listeners.get(event.type) || [];
    for (const h of handlers) h(event);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    const list = this.querySelectorAll(selector);
    return list.length ? list[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    for (const child of this.children) {
      if (selector === '.japan-map-svg-frame' && child.classList.has('japan-map-svg-frame')) results.push(child);
      else if (selector === '.geolonia-svg-map' && child.classList.has('geolonia-svg-map')) results.push(child);
      else if (selector === '#japanMapTooltip' && child.getAttribute('id') === 'japanMapTooltip') results.push(child);
      else if (selector === '#japanMapDetailBar' && child.getAttribute('id') === 'japanMapDetailBar') results.push(child);
      else if (selector === '.prefecture[data-pref]' && child.classList.has('prefecture') && child.getAttribute('data-pref')) results.push(child);
      else if (selector === '.clear-pref-btn' && child.classList.has('clear-pref-btn')) results.push(child);
      else if (selector === '.scroll-pref-btn' && child.classList.has('scroll-pref-btn')) results.push(child);
      else if (selector === '.japan-map-marker' && child.classList.has('japan-map-marker')) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  getBoundingClientRect() {
    return { left: 10, top: 20, width: 400, height: 400 };
  }
}

// Adapt classList to match DOM API
MockElement.prototype.classList = {
  add(...classes) {
    for (const c of classes) this._set.add(c);
  },
  remove(...classes) {
    for (const c of classes) this._set.delete(c);
  },
  contains(c) {
    return this._set.has(c);
  }
};

function createMockElement(tagName = 'div') {
  const el = new MockElement(tagName);
  const set = new Set();
  el.classList = {
    _set: set,
    add(...classes) {
      for (const c of classes) set.add(c);
    },
    remove(...classes) {
      for (const c of classes) set.delete(c);
    },
    contains(c) {
      return set.has(c);
    },
    has(c) {
      return set.has(c);
    }
  };
  return el;
}

function loadJapanMap() {
  const code = fs.readFileSync('japan-map.js', 'utf8');
  const mockDoc = {
    createElementNS(ns, tag) {
      return createMockElement(tag);
    }
  };
  const context = {
    globalThis: {},
    document: mockDoc,
    console: console
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.globalThis.JapanPrefMap;
}

test('JapanPrefMap: 47 prefectures defined and master data valid', () => {
  const MapModule = loadJapanMap();
  assert.ok(MapModule, 'JapanPrefMap should be defined');
  assert.equal(MapModule.PREFECTURES.length, 47, 'Should contain all 47 prefectures');

  for (let i = 1; i <= 47; i++) {
    const p = MapModule.PREFECTURES.find(x => x.code === i);
    assert.ok(p, `Prefecture code ${i} must exist`);
    assert.ok(typeof p.name === 'string' && p.name.length > 0);
  }
});

test('JapanPrefMap.getStatus: correct color status and labels based on progress', () => {
  const { getStatus } = loadJapanMap();

  // 1. Empty (0 facilities registered)
  const empty = getStatus(0, 0);
  assert.equal(empty.status, 'empty');
  assert.equal(empty.pct, null);
  assert.equal(empty.label, '登録施設なし');

  // 2. Zero visited (e.g. 0/5)
  const zero = getStatus(5, 0);
  assert.equal(zero.status, 'zero');
  assert.equal(zero.pct, 0);
  assert.ok(zero.label.includes('0%'));

  // 3. Low: 1 to 49%
  const low1 = getStatus(5, 1);
  assert.equal(low1.status, 'low');
  assert.equal(low1.pct, 20);

  // 4. Mid: 50 to 99%
  const mid1 = getStatus(5, 3);
  assert.equal(mid1.status, 'mid');
  assert.equal(mid1.pct, 60);

  // 5. Complete: 100%
  const complete = getStatus(5, 5);
  assert.equal(complete.status, 'complete');
  assert.equal(complete.pct, 100);
});

test('JapanPrefMap.getPrefStats: matches dataset facilities and visited state', () => {
  const { getPrefStats } = loadJapanMap();

  const mockData = [
    { id: '1', prefecture: '青森県' },
    { id: '2', prefecture: '青森県' },
    { id: '3', prefecture: '秋田県' }
  ];

  const visitedSet = new Set(['1']);
  const isVisited = x => visitedSet.has(x.id);

  // Aomori: 1 visited out of 2 = 50% -> mid
  const aomori = getPrefStats('青森県', mockData, isVisited);
  assert.equal(aomori.name, '青森県');
  assert.equal(aomori.total, 2);
  assert.equal(aomori.visitedCount, 1);
  assert.equal(aomori.pct, 50);
  assert.equal(aomori.status, 'mid');

  // Akita: 0 visited out of 1 = 0% -> zero
  const akita = getPrefStats('秋田県', mockData, isVisited);
  assert.equal(akita.total, 1);
  assert.equal(akita.visitedCount, 0);
  assert.equal(akita.pct, 0);
  assert.equal(akita.status, 'zero');

  // Okinawa: 0 facilities -> empty
  const okinawa = getPrefStats('沖縄県', mockData, isVisited);
  assert.equal(okinawa.total, 0);
  assert.equal(okinawa.visitedCount, 0);
  assert.equal(okinawa.pct, null);
  assert.equal(okinawa.status, 'empty');
  assert.equal(okinawa.statusLabel, '登録施設なし');
});

test('JapanPrefMap: SVG markup contains all 47 prefecture paths/polygons with correct data attributes', () => {
  const { SVG_MARKUP, PREFECTURES } = loadJapanMap();
  assert.ok(SVG_MARKUP.includes('viewBox="0 0 1000 1000"'));

  for (const p of PREFECTURES) {
    assert.ok(
      SVG_MARKUP.includes(`data-code="${p.code}"`),
      `SVG must contain data-code="${p.code}" for ${p.name}`
    );
    assert.ok(
      SVG_MARKUP.includes(`data-pref="${p.name}"`),
      `SVG must contain data-pref="${p.name}"`
    );
  }
});

test('Integration with actual data.js: verifies 67 onsens across prefectures', () => {
  const { PREFECTURES, getPrefStats } = loadJapanMap();

  // Load real data.js
  const dataCode = fs.readFileSync('data.js', 'utf8');
  const win = {};
  vm.runInNewContext(dataCode, { window: win });
  const DATA = win.ONSEN_DATA;
  assert.equal(DATA.length, 67, 'Must preserve 67 facilities');

  // Check stats when no visits
  let totalWithFacilities = 0;
  let emptyPrefCount = 0;

  for (const p of PREFECTURES) {
    const stats = getPrefStats(p.name, DATA, () => false);
    if (stats.total > 0) {
      totalWithFacilities++;
      assert.equal(stats.status, 'zero', `${p.name} with 0 visits should have status zero`);
      assert.equal(stats.pct, 0);
    } else {
      emptyPrefCount++;
      assert.equal(stats.status, 'empty', `${p.name} without facilities must have status empty`);
      assert.equal(stats.pct, null);
      assert.equal(stats.statusLabel, '登録施設なし');
    }
  }

  assert.equal(totalWithFacilities, 12, '12 prefectures have facilities in dataset');
  assert.equal(emptyPrefCount, 35, '35 prefectures have no facilities registered');

  // Check stats when all visited
  for (const p of PREFECTURES) {
    const stats = getPrefStats(p.name, DATA, () => true);
    if (stats.total > 0) {
      assert.equal(stats.status, 'complete', `${p.name} when all visited must have status complete`);
      assert.equal(stats.pct, 100);
    } else {
      assert.equal(stats.status, 'empty');
    }
  }
});

test('Embedded map preserves every source coordinate transform and boundary shape', () => {
  const source = fs.readFileSync('assets/japan-map-geolonia.svg', 'utf8');
  const { SVG_MARKUP } = loadJapanMap();
  for (const tag of source.match(/<g\b[^>]*data-code="\d+"[^>]*>/g)) {
    const code = tag.match(/data-code="(\d+)"/)[1];
    const transform = tag.match(/transform="([^"]+)"/)[1];
    const embedded = SVG_MARKUP.match(new RegExp(`<g\\b[^>]*data-code="${code}"[^>]*>`))[0];
    assert.ok(embedded.includes(`transform="${transform}"`), `Preserve position of prefecture ${code}`);
  }
  assert.deepEqual(SVG_MARKUP.match(/<(?:path|polygon)\b[^>]*>/g), source.match(/<(?:path|polygon)\b[^>]*>/g));
});

test('JapanPrefMap: displays exactly 49 verified onsen markers and 0 unverified markers', () => {
  const MapModule = loadJapanMap();
  const dataCode = fs.readFileSync('data.js', 'utf8');
  const win = {};
  vm.runInNewContext(dataCode, { window: win });
  const DATA = win.ONSEN_DATA;

  const container = createMockElement('div');
  const visitedSet = new Set(['onsen-001', 'onsen-002']);
  let selectedId = null;

  const instance = MapModule.create({
    container: container,
    data: DATA,
    isVisited: x => visitedSet.has(x.id),
    onDetail: id => { selectedId = id; },
    getSelectedPref: () => '青森県'
  });

  assert.ok(instance, 'Map instance should be created');
  assert.equal(instance.getMarkerCount(), 49, 'Must render exactly 49 verified markers');

  const markers = container.querySelectorAll('.japan-map-marker');
  assert.equal(markers.length, 49, 'DOM should contain 49 marker elements');

  // Verify none of the 18 unverified onsens have a marker
  const unverified = DATA.filter(x => !x.coordinateVerified);
  assert.equal(unverified.length, 18, 'Should have 18 unverified onsens');
  for (const u of unverified) {
    const found = markers.find(m => m.getAttribute('data-onsen-id') === u.id);
    assert.equal(found, undefined, `Unverified facility ${u.id} (${u.facility}) must NOT have a marker on the map`);
  }

  // Verify all 49 verified facilities have a marker
  const verified = DATA.filter(x => x.coordinateVerified);
  assert.equal(verified.length, 49, 'Should have 49 verified onsens');
  for (const v of verified) {
    const found = markers.find(m => m.getAttribute('data-onsen-id') === v.id);
    assert.ok(found, `Verified facility ${v.id} (${v.facility}) must have a marker`);
  }

  // Check visited vs unvisited classes
  const m1 = markers.find(m => m.getAttribute('data-onsen-id') === 'onsen-001');
  assert.ok(m1.classList.contains('is-visited'), 'onsen-001 should have is-visited class');
  assert.ok(!m1.classList.contains('is-unvisited'), 'onsen-001 should not have is-unvisited class');

  const m3 = markers.find(m => m.getAttribute('data-onsen-id') === 'onsen-003');
  assert.ok(m3.classList.contains('is-unvisited'), 'onsen-003 should have is-unvisited class');
  assert.ok(!m3.classList.contains('is-visited'), 'onsen-003 should not have is-visited class');

  // Check prefecture selection emphasis (selected pref is 青森県)
  // onsen-002 is in 青森県, onsen-001 is in 北海道
  const m2 = markers.find(m => m.getAttribute('data-onsen-id') === 'onsen-002');
  assert.ok(m2.classList.contains('is-selected-pref'), 'Aomori marker should have is-selected-pref');
  assert.ok(!m1.classList.contains('is-selected-pref'), 'Hokkaido marker should not have is-selected-pref');

  // Check click triggers onDetail
  m1.dispatchEvent({ type: 'click', preventDefault: () => {}, stopPropagation: () => {} });
  assert.equal(selectedId, 'onsen-001', 'Clicking marker must trigger onDetail with facility id');
});
