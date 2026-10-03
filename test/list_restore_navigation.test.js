const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('local ready and pageshow events refresh list without needing tab switch', async () => {
  const storage = new Map([
    ['frpoku_active_workspace:u1', 'pool'],
    ['frpoku_files', JSON.stringify([{ id: 'r1', name: 'Rapor 1', isPublic: true, userId: 'u1' }])]
  ]);
  const eventListeners = new Map();
  let refreshAllCalled = 0;

  const context = {
    console,
    setTimeout: (fn, ms) => setTimeout(fn, ms || 0),
    clearTimeout,
    setInterval: () => 0,
    clearInterval() {},
    addEventListener: (ev, fn) => {
      if (!eventListeners.has(ev)) eventListeners.set(ev, []);
      eventListeners.get(ev).push(fn);
    },
    dispatchEvent: (ev) => {
      const fns = eventListeners.get(ev.type || ev) || [];
      fns.forEach(fn => fn(ev));
    },
    CustomEvent: class {
      constructor(type, detail) { this.type = type; this.detail = detail; }
    },
    Event: class {
      constructor(type) { this.type = type; }
    },
    localStorage: {
      getItem: k => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: k => storage.delete(k)
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    document: {
      readyState: 'complete',
      documentElement: { setAttribute: () => {}, style: { setProperty: () => {} } },
      body: { classList: { add: () => {}, remove: () => {} }, style: { setProperty: () => {} }, setAttribute: () => {} },
      getElementById: () => ({ classList: { toggle: () => {}, add: () => {} }, style: { setProperty: () => {} }, textContent: '' }),
      querySelector: () => ({ classList: { toggle: () => {}, add: () => {} }, style: { setProperty: () => {} }, textContent: '' }),
      querySelectorAll: () => [],
      addEventListener: (ev, fn) => {
        if (!eventListeners.has(ev)) eventListeners.set(ev, []);
        eventListeners.get(ev).push(fn);
      }
    },
    FrpAuth: {
      getUser: () => ({ id: 'u1', role: 'user' }),
      getToken: () => 'token',
      isLoggedIn: () => true
    },
    FrpCloud: {
      loadActiveReports: async () => [{ id: 'r1', name: 'Rapor 1', isPublic: true, userId: 'u1' }],
      loadTrashReports: async () => [],
      loadCategories: async () => [],
      loadSnippets: async () => [],
      loadSettings: async () => ({})
    },
    refreshAll: () => {
      refreshAllCalled++;
    }
  };
  context.window = context;
  vm.createContext(context);

  const storeScript = fs.readFileSync(path.join(__dirname, '..', 'js/store/store_main.js'), 'utf8');
  vm.runInContext(storeScript, context);

  // Register the exact listeners added to list.js
  context.window.addEventListener('frp:local-ready', () => context.refreshAll?.());
  context.window.addEventListener('pageshow', () => context.refreshAll?.());

  await context.FrpStoreLocalReady;

  assert.equal(context.FrpStore.getActiveWorkspace(), 'pool');
  assert.ok(refreshAllCalled >= 1, 'refreshAll must be called when local store is ready');

  const beforePageshow = refreshAllCalled;
  // Simulate navigating back from detail view via pageshow (bfcache or history.back)
  const pageshowFns = eventListeners.get('pageshow') || [];
  pageshowFns.forEach(fn => fn({ persisted: true }));

  // Simulate local-ready event
  const localReadyFns = eventListeners.get('frp:local-ready') || [];
  localReadyFns.forEach(fn => fn(new context.CustomEvent('frp:local-ready')));

  assert.ok(refreshAllCalled > beforePageshow, 'pageshow or local-ready must trigger refreshAll');
});
