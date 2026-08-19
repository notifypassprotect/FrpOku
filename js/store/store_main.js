/**
 * FrpOku - Modüler Veri Katmanı (FrpStore Ana Orkestratör v5)
 * IndexedDB + LocalStorage + Supabase Bulut Veritabanı
 */

(function () {
  'use strict';

  const STORE_KEY = 'frpoku_files';
  const THEME_KEY = 'frpoku_theme';
  const SNIPPET_KEY = 'frpoku_snippets';
  const CATEGORIES_KEY = 'frpoku_categories';
  const CUSTOM_TAGS_KEY = 'frpoku_custom_tags';
  const RECENT_KEY = 'frpoku_recent';
  const PREFS_KEY = 'frpoku_preferences';
  const PROFILE_KEY = 'frpoku_user_profile';

  const DB_NAME = 'FrpOkuDB';
  const DB_STORE = 'files';
  const DB_TRASH_STORE = 'trash';
  const USE_SERVER_BRIDGE = window.location.protocol !== 'file:';

  let dbPromise = null;
  let _memoryStore = null;
  let _trashStore = [];

  // ── 1. IndexedDB Kalıcılık Katmanı ──────────────────────────
  function initDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!window.indexedDB) { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DB_TRASH_STORE)) {
          db.createObjectStore(DB_TRASH_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });
    return dbPromise;
  }

  async function syncToIndexedDB(files) {
    try {
      const db = await initDB();
      if (!db) return;
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      store.clear();
      files.forEach(f => store.put(f));
    } catch (e) {
      console.warn('IndexedDB sync hatası:', e);
    }
  }

  async function syncTrashToIndexedDB(trashItems) {
    try {
      const db = await initDB();
      if (!db || !db.objectStoreNames.contains(DB_TRASH_STORE)) return;
      const tx = db.transaction(DB_TRASH_STORE, 'readwrite');
      const store = tx.objectStore(DB_TRASH_STORE);
      store.clear();
      trashItems.forEach(item => store.put(item));
    } catch (e) {
      console.warn('IndexedDB trash sync hatası:', e);
    }
  }

  async function restoreFromIndexedDB() {
    try {
      const db = await initDB();
      if (!db) return [];
      return await new Promise(resolve => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  // ── 2. Bellek ve Yerel Okuma/Yazma ───────────────────────────
  function _read() {
    if (_memoryStore !== null) return _memoryStore;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      _memoryStore = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(_memoryStore)) _memoryStore = [];
      return _memoryStore;
    } catch {
      _memoryStore = [];
      return _memoryStore;
    }
  }

  function _write(files) {
    _memoryStore = files;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(files));
      syncToIndexedDB(files);

      if (window.FrpCloud && typeof window.FrpCloud.saveReports === 'function') {
        window.FrpCloud.saveReports(files).catch(err => console.warn('Supabase sync warning:', err));
      }

      if (USE_SERVER_BRIDGE) {
        fetch('/api/store/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(files)
        }).catch(() => {});
      }
      return true;
    } catch (e) {
      syncToIndexedDB(files);
      if (window.FrpCloud && typeof window.FrpCloud.saveReports === 'function') {
        window.FrpCloud.saveReports(files).catch(() => {});
      }
      return true;
    }
  }

  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ── 3. Başlangıç & Bulut Senkronizasyonu ───────────────────────
  const bootstrapReady = (async () => {
    const splashStartTime = Date.now();
    try {
      let isCloudLoaded = false;
      let loadedFiles = [];

      // 1. Supabase Aktif Raporları Çek
      if (window.FrpCloud && typeof window.FrpCloud.loadActiveReports === 'function') {
        try {
          const cloudFiles = await window.FrpCloud.loadActiveReports();
          if (Array.isArray(cloudFiles)) {
            loadedFiles = cloudFiles;
            isCloudLoaded = true;
          }
        } catch (e) {
          console.warn('Supabase load error:', e);
        }
      }

      // 2. Supabase Çöp Kutusunu Çek
      if (window.FrpCloud && typeof window.FrpCloud.loadTrashReports === 'function') {
        try {
          const trashCloud = await window.FrpCloud.loadTrashReports();
          if (Array.isArray(trashCloud)) {
            _trashStore = trashCloud;
            syncTrashToIndexedDB(_trashStore);
          }
        } catch (e) {}
      }

      // 3. Kategoriler & Snippets Çek
      if (window.FrpCloud) {
        try {
          if (typeof window.FrpCloud.loadCategories === 'function') {
            const cloudCats = await window.FrpCloud.loadCategories();
            if (Array.isArray(cloudCats) && cloudCats.length > 0) {
              localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cloudCats));
            }
          }
          if (typeof window.FrpCloud.loadSnippets === 'function') {
            const cloudSnippets = await window.FrpCloud.loadSnippets();
            if (Array.isArray(cloudSnippets) && cloudSnippets.length > 0) {
              localStorage.setItem(SNIPPET_KEY, JSON.stringify(cloudSnippets));
            }
          }
        } catch (e) {}
      }

      // 4. Çevrimdışı / Yerel Yedek
      if (!isCloudLoaded) {
        const ls = _read();
        if (Array.isArray(ls) && ls.length > 0) {
          loadedFiles = ls;
        } else {
          const idbFiles = await restoreFromIndexedDB();
          if (Array.isArray(idbFiles) && idbFiles.length > 0) loadedFiles = idbFiles;
        }
      }

      _memoryStore = loadedFiles;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(loadedFiles)); } catch (e) {}
      syncToIndexedDB(loadedFiles);
    } catch (err) {
      console.warn('Bootstrap error:', err);
    } finally {
      if (typeof window.refreshAll === 'function') window.refreshAll();
      const splash = document.getElementById('splashScreen');
      if (splash) {
        const elapsed = Date.now() - splashStartTime;
        const delay = Math.max(0, 500 - elapsed);
        setTimeout(() => {
          splash.classList.add('hidden');
          setTimeout(() => { if (splash && splash.parentNode) splash.parentNode.removeChild(splash); }, 350);
        }, delay);
      }
    }
  })();
  window.FrpStoreReady = bootstrapReady;

  // ── 4. Rapor CRUD Metotları ──────────────────────────────────
  function getAll() {
    const list = _read();
    return list.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.loadedAt || 0) - new Date(a.loadedAt || 0);
    });
  }

  function getById(id) {
    const list = getAll();
    const item = list.find(r => r.id === id);
    if (!item) return null;
    item.queries  = Array.isArray(item.queries)  ? item.queries  : [];
    item.datasets = Array.isArray(item.datasets) ? item.datasets : [];
    item.tags     = Array.isArray(item.tags)     ? item.tags     : [];
    item.tree     = Array.isArray(item.tree)     ? item.tree     : [];
    item.meta     = item.meta || {};
    return item;
  }

  function add(parsedData, fileName, fileSize) {
    const files = _read();
    const existingIdx = files.findIndex(f => f.name === fileName);
    const autoTags = window.FrpTags ? window.FrpTags.generateAutoTags(parsedData, fileName) : [];
    const existingTags = existingIdx >= 0 ? (files[existingIdx].tags || []) : [];
    const mergedTags = [...new Set([...existingTags, ...autoTags])];

    const fileRecord = {
      id:           existingIdx >= 0 ? files[existingIdx].id : _uuid(),
      name:         fileName,
      sizeBytes:    fileSize,
      loadedAt:     new Date().toISOString(),
      meta:         parsedData.meta || {},
      pascalScript: parsedData.pascalScript || null,
      queries:      parsedData.queries || [],
      datasets:     parsedData.datasets || [],
      tree:         parsedData.tree || [],
      pages:        parsedData.pages || [],
      dialogPages:  parsedData.dialogPages || [],
      rawXml:       parsedData.rawXml || null,
      userNote:     existingIdx >= 0 ? (files[existingIdx].userNote || '') : '',
      isFavorite:   existingIdx >= 0 ? (files[existingIdx].isFavorite || false) : false,
      isPinned:     existingIdx >= 0 ? (files[existingIdx].isPinned || false) : false,
      tags:         mergedTags
    };

    if (existingIdx >= 0) {
      files[existingIdx] = fileRecord;
      _write(files);
      return { status: 'updated', file: fileRecord };
    } else {
      files.push(fileRecord);
      _write(files);
      return { status: 'added', file: fileRecord };
    }
  }

  function addMany(parsedList) {
    const files = _read();
    let added = 0, updated = 0;

    parsedList.forEach(item => {
      const { parsedData, fileName, fileSize } = item;
      const existingIdx = files.findIndex(f => f.name === fileName);
      const autoTags = window.FrpTags ? window.FrpTags.generateAutoTags(parsedData, fileName) : [];
      const existingTags = existingIdx >= 0 ? (files[existingIdx].tags || []) : [];
      const mergedTags = [...new Set([...existingTags, ...autoTags])];

      const fileRecord = {
        id:           existingIdx >= 0 ? files[existingIdx].id : _uuid(),
        name:         fileName,
        sizeBytes:    fileSize,
        loadedAt:     new Date().toISOString(),
        meta:         parsedData.meta || {},
        pascalScript: parsedData.pascalScript || null,
        queries:      parsedData.queries || [],
        datasets:     parsedData.datasets || [],
        tree:         parsedData.tree || [],
        pages:        parsedData.pages || [],
        dialogPages:  parsedData.dialogPages || [],
        rawXml:       parsedData.rawXml || null,
        userNote:     existingIdx >= 0 ? (files[existingIdx].userNote || '') : '',
        isFavorite:   existingIdx >= 0 ? (files[existingIdx].isFavorite || false) : false,
        isPinned:     existingIdx >= 0 ? (files[existingIdx].isPinned || false) : false,
        tags:         mergedTags
      };

      if (existingIdx >= 0) {
        files[existingIdx] = fileRecord;
        updated++;
      } else {
        files.push(fileRecord);
        added++;
      }
    });

    _write(files);
    return { added, updated };
  }

  function deleteOne(id) {
    const files = _read().filter(f => f.id !== id);
    if (window.FrpCloud && typeof window.FrpCloud.deleteReport === 'function') {
      window.FrpCloud.deleteReport(id).catch(() => {});
    }
    _write(files);
  }

  function deleteMany(ids) {
    const idSet = new Set(ids);
    const files = _read().filter(f => !idSet.has(f.id));
    if (window.FrpCloud && typeof window.FrpCloud.deleteReports === 'function') {
      window.FrpCloud.deleteReports(ids).catch(() => {});
    }
    _write(files);
  }

  function deleteAll() {
    if (window.FrpCloud && typeof window.FrpCloud.deleteAllReports === 'function') {
      window.FrpCloud.deleteAllReports().catch(() => {});
    }
    _write([]);
    syncToIndexedDB([]);
  }

  // ── 5. Çöp Kutusu (Soft Delete) Metotları ─────────────────────
  function getTrash() {
    return _trashStore;
  }

  async function moveToTrash(id) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx < 0) return false;

    const fileToTrash = files[idx];
    fileToTrash.deletedAt = new Date().toISOString();

    files.splice(idx, 1);
    _write(files);

    _trashStore = _trashStore.filter(t => t.id !== id);
    _trashStore.unshift(fileToTrash);
    syncTrashToIndexedDB(_trashStore);

    if (window.FrpCloud && typeof window.FrpCloud.moveToTrash === 'function') {
      await window.FrpCloud.moveToTrash(id, fileToTrash);
    }
    return true;
  }

  async function moveManyToTrash(ids) {
    const idSet = new Set(ids);
    const files = _read();
    const toTrash = files.filter(f => idSet.has(f.id));
    const remaining = files.filter(f => !idSet.has(f.id));

    const now = new Date().toISOString();
    toTrash.forEach(f => {
      f.deletedAt = now;
      _trashStore = _trashStore.filter(t => t.id !== f.id);
      _trashStore.unshift(f);
    });

    _write(remaining);
    syncTrashToIndexedDB(_trashStore);

    if (window.FrpCloud && typeof window.FrpCloud.moveManyToTrash === 'function') {
      await window.FrpCloud.moveManyToTrash(ids);
    }
    return true;
  }

  async function restoreFromTrash(id) {
    const idx = _trashStore.findIndex(t => t.id === id);
    if (idx < 0) return false;

    const restoredFile = _trashStore[idx];
    delete restoredFile.deletedAt;

    _trashStore.splice(idx, 1);
    syncTrashToIndexedDB(_trashStore);

    const files = _read();
    files.unshift(restoredFile);
    _write(files);

    if (window.FrpCloud && typeof window.FrpCloud.restoreFromTrash === 'function') {
      await window.FrpCloud.restoreFromTrash(id);
    }
    return true;
  }

  async function restoreManyFromTrash(ids) {
    const idSet = new Set(ids);
    const toRestore = _trashStore.filter(t => idSet.has(t.id));
    _trashStore = _trashStore.filter(t => !idSet.has(t.id));
    syncTrashToIndexedDB(_trashStore);

    const files = _read();
    toRestore.forEach(f => {
      delete f.deletedAt;
      files.unshift(f);
    });
    _write(files);

    if (window.FrpCloud && typeof window.FrpCloud.restoreManyFromTrash === 'function') {
      await window.FrpCloud.restoreManyFromTrash(ids);
    }
    return true;
  }

  async function purgeFromTrash(id) {
    _trashStore = _trashStore.filter(t => t.id !== id);
    syncTrashToIndexedDB(_trashStore);

    if (window.FrpCloud && typeof window.FrpCloud.purgeReport === 'function') {
      await window.FrpCloud.purgeReport(id);
    }
    return true;
  }

  async function purgeManyFromTrash(ids) {
    const idSet = new Set(ids);
    _trashStore = _trashStore.filter(t => !idSet.has(t.id));
    syncTrashToIndexedDB(_trashStore);

    if (window.FrpCloud && typeof window.FrpCloud.purgeManyReports === 'function') {
      await window.FrpCloud.purgeManyReports(ids);
    }
    return true;
  }

  async function emptyTrash() {
    _trashStore = [];
    syncTrashToIndexedDB([]);

    if (window.FrpCloud && typeof window.FrpCloud.emptyTrash === 'function') {
      await window.FrpCloud.emptyTrash();
    }
    return true;
  }

  // ── 6. Not, Meta, Kod Güncelleme ────────────────────────────
  function updateNote(id, note) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx >= 0) {
      files[idx].userNote = note;
      _write(files);
      return true;
    }
    return false;
  }

  function updateMeta(id, metaPatch) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx >= 0) {
      files[idx].meta = Object.assign({}, files[idx].meta || {}, metaPatch);
      _write(files);
      return true;
    }
    return false;
  }

  function updateCode(id, patch) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx < 0) return false;

    const file = files[idx];

    if (typeof patch.sql === 'string' && typeof patch.queryIndex === 'number') {
      if (!Array.isArray(file.queries)) file.queries = [];
      if (file.queries[patch.queryIndex]) {
        file.queries[patch.queryIndex].sql = patch.sql;
      }
    }

    if (typeof patch.pascalScript === 'string') {
      file.pascalScript = patch.pascalScript;
    }

    if (window.buildUpdatedFrpXml) {
      file.rawXml = window.buildUpdatedFrpXml(file);
    }

    _write(files);
    return true;
  }

  function updateFileName(id, newName) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx < 0) return false;
    files[idx].name = newName;
    _write(files);
    return true;
  }

  function toggleFavorite(id) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx >= 0) {
      files[idx].isFavorite = !files[idx].isFavorite;
      _write(files);
      return files[idx].isFavorite;
    }
    return false;
  }

  function togglePin(id) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx >= 0) {
      files[idx].isPinned = !files[idx].isPinned;
      _write(files);
      return files[idx].isPinned;
    }
    return false;
  }

  function addTag(id, tag) {
    const t = (tag || '').trim().toLowerCase();
    if (!t) return false;
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx >= 0) {
      if (!files[idx].tags) files[idx].tags = [];
      if (!files[idx].tags.includes(t)) {
        files[idx].tags.push(t);
        _write(files);
      }
      return files[idx].tags;
    }
    return false;
  }

  function removeTag(id, tag) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx >= 0 && files[idx].tags) {
      files[idx].tags = files[idx].tags.filter(t => t !== tag);
      _write(files);
      return files[idx].tags;
    }
    return false;
  }

  function getAllTags() {
    const files = _read();
    const tagSet = new Set();
    files.forEach(f => {
      (f.tags || []).forEach(t => tagSet.add(t));
    });
    return [...tagSet].sort();
  }

  // ── 7. Kategoriler ──────────────────────────────────────────
  const DEFAULT_CATEGORIES = [
    { id: 'cat_1', name: 'Finans', color: '#10b981', icon: '💰' },
    { id: 'cat_2', name: 'HBYS / Klinik', color: '#3b82f6', icon: '🏥' },
    { id: 'cat_3', name: 'Yönetim & İstatistik', color: '#8b5cf6', icon: '📊' },
    { id: 'cat_4', name: 'Laboratuvar', color: '#ec4899', icon: '🔬' },
    { id: 'cat_5', name: 'Eczane & Depo', color: '#f59e0b', icon: '💊' }
  ];

  function getCategoryObjects() {
    try {
      const raw = localStorage.getItem(CATEGORIES_KEY);
      return raw ? JSON.parse(raw) : [...DEFAULT_CATEGORIES];
    } catch {
      return [...DEFAULT_CATEGORIES];
    }
  }

  function getCategories() {
    return getCategoryObjects().map(c => c.name);
  }

  function addCategory(name, color = '#3b82f6', icon = '🏷️') {
    const trimmed = (name || '').trim();
    if (!trimmed) return { success: false, reason: 'Kategori adı boş olamaz.' };
    const cats = getCategoryObjects();
    if (cats.some(c => (c.name || '').toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, reason: 'Bu isimde bir kategori zaten mevcut.' };
    }
    const newCat = { id: `cat_${Date.now()}`, name: trimmed, color: color || '#3b82f6', icon: icon || '🏷️' };
    cats.push(newCat);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
    if (window.FrpCloud && typeof window.FrpCloud.saveCategory === 'function') {
      window.FrpCloud.saveCategory(newCat).catch(() => {});
    }
    return { success: true, category: newCat };
  }

  function updateCategory(oldName, newName, color, icon) {
    const cats = getCategoryObjects();
    const idx = cats.findIndex(c => (c.name || '').toLowerCase() === oldName.toLowerCase());
    if (idx < 0) return { success: false, reason: 'Kategori bulunamadı.' };

    const cleanNew = (newName || '').trim();
    if (cleanNew && cleanNew.toLowerCase() !== oldName.toLowerCase()) {
      if (cats.some(c => (c.name || '').toLowerCase() === cleanNew.toLowerCase())) {
        return { success: false, reason: 'Bu isimde başka bir kategori var.' };
      }
      cats[idx].name = cleanNew;
    }
    if (color) cats[idx].color = color;
    if (icon) cats[idx].icon = icon;

    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
    if (window.FrpCloud && typeof window.FrpCloud.saveCategory === 'function') {
      window.FrpCloud.saveCategory(cats[idx]).catch(() => {});
    }

    if (cleanNew && cleanNew !== oldName) {
      const files = _read();
      files.forEach(f => { if (f.category === oldName) f.category = cleanNew; });
      _write(files);
    }
    return { success: true, category: cats[idx] };
  }

  function deleteCategory(name) {
    const trimmed = (name || '').trim().toLowerCase();
    let cats = getCategoryObjects();
    const toDel = cats.find(c => (c.name || '').trim().toLowerCase() === trimmed);
    cats = cats.filter(c => (c.name || '').trim().toLowerCase() !== trimmed);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));

    if (toDel && window.FrpCloud && typeof window.FrpCloud.deleteCategory === 'function') {
      window.FrpCloud.deleteCategory(toDel.id).catch(() => {});
    }

    const files = _read();
    let changed = false;
    files.forEach(f => {
      if ((f.category || '').trim().toLowerCase() === trimmed) {
        delete f.category;
        changed = true;
      }
    });
    if (changed) _write(files);
    return true;
  }

  function setCategory(id, categoryName) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx < 0) return false;
    files[idx].category = categoryName || '';
    _write(files);
    return true;
  }

  // ── 8. Snippets (Sorgu Kütüphanesi) ──────────────────────────
  function getSnippets() {
    try {
      const raw = localStorage.getItem(SNIPPET_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function addSnippet(title, sql, reportName, category = 'Genel') {
    const snippets = getSnippets();
    const item = {
      id: _uuid(),
      title: title || 'SQL Sorgusu',
      sql,
      reportName: reportName || '—',
      category: category || 'Genel',
      createdAt: new Date().toISOString()
    };
    snippets.push(item);
    localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
    if (window.FrpCloud && typeof window.FrpCloud.saveSnippet === 'function') {
      window.FrpCloud.saveSnippet(item).catch(() => {});
    }
    return item;
  }

  function removeSnippet(id) {
    const snippets = getSnippets().filter(s => s.id !== id);
    localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
    if (window.FrpCloud && typeof window.FrpCloud.deleteSnippet === 'function') {
      window.FrpCloud.deleteSnippet(id).catch(() => {});
    }
  }

  function updateSnippet(id, patch) {
    const snippets = getSnippets();
    const idx = snippets.findIndex(s => s.id === id);
    if (idx !== -1) {
      snippets[idx] = { ...snippets[idx], ...patch, updatedAt: new Date().toISOString() };
      localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets));
      if (window.FrpCloud && typeof window.FrpCloud.saveSnippet === 'function') {
        window.FrpCloud.saveSnippet(snippets[idx]).catch(() => {});
      }
      return snippets[idx];
    }
    return null;
  }

  // ── 9. İstatistik ve Arama ───────────────────────────────────
  function getStats() {
    const files = _read();
    const totalQueries = files.reduce((s, f) => s + (Array.isArray(f.queries) ? f.queries.length : 0), 0);
    const totalFavorites = files.filter(f => f.isFavorite).length;
    const totalPascal = files.filter(f => f.pascalScript).length;
    const totalPinned = files.filter(f => f.isPinned).length;
    const totalBytes = files.reduce((s, f) => s + (f.sizeBytes || 0), 0);

    let storageFormatted = '0 KB';
    if (totalBytes >= 1024 * 1024) {
      storageFormatted = (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';
    } else {
      storageFormatted = Math.round(totalBytes / 1024) + ' KB';
    }

    return { totalFiles: files.length, totalQueries, totalPascal, totalFavorites, totalPinned, totalBytes, storageFormatted };
  }

  function search(query, filterType = 'all') {
    const q = (query || '').trim().toLowerCase();
    const files = _read();
    if (!q) return files;

    return files.filter(f => {
      const match = str => (str || '').toLowerCase().includes(q);
      if (match(f.name) || match(f.meta?.reportName) || match(f.userNote)) return true;
      if (filterType === 'sql' || filterType === 'all') {
        if ((f.queries || []).some(qry => match(qry.sql) || match(qry.name))) return true;
      }
      if (filterType === 'pascal' || filterType === 'all') {
        if (match(f.pascalScript)) return true;
      }
      return false;
    });
  }

  // ── 10. Tercihler, Tema, Son Açılanlar ─────────────────────────
  function getTheme() { return localStorage.getItem(THEME_KEY) || 'light'; }
  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
  function initTheme() { setTheme(getTheme()); }
  initTheme();

  function getPreferences() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : { defaultSort: 'updated_desc', compactView: false, autoTagging: true };
    } catch {
      return { defaultSort: 'updated_desc', compactView: false, autoTagging: true };
    }
  }

  function setPreferences(patch) {
    const cur = getPreferences();
    const updated = { ...cur, ...patch };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(updated)); } catch {}
    if (window.FrpCloud && typeof window.FrpCloud.saveSettings === 'function') {
      window.FrpCloud.saveSettings({ preferences: updated });
    }
    return updated;
  }

  function applyPreferences() {
    const prefs = getPreferences();
    if (prefs.theme) setTheme(prefs.theme);
  }

  function getUserProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : { name: 'Kullanıcı', email: '' };
    } catch {
      return { name: 'Kullanıcı', email: '' };
    }
  }

  function setUserProfile(profile) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
    return profile;
  }

  function addRecent(id) {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      let list = raw ? JSON.parse(raw) : [];
      list = list.filter(r => r.id !== id);
      list.unshift({ id, ts: Date.now() });
      if (list.length > 7) list = list.slice(0, 7);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch(e) {}
  }

  function getRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const allFiles = _read();
      return list.map(r => {
        const f = allFiles.find(file => file.id === r.id);
        return f ? { ...f, recentTs: r.ts } : null;
      }).filter(Boolean);
    } catch(e) { return []; }
  }

  function clearRecent() {
    try { localStorage.removeItem(RECENT_KEY); } catch(e) {}
  }

  function removeRecent(id) {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      let list = raw ? JSON.parse(raw) : [];
      list = list.filter(r => r.id !== id);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch(e) {}
  }

  function getCustomTags() {
    try {
      const raw = localStorage.getItem(CUSTOM_TAGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function addCustomTag(tag) {
    const t = (tag || '').trim().toLowerCase();
    if (!t) return false;
    const list = getCustomTags();
    if (!list.includes(t)) {
      list.push(t);
      localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(list));
    }
    return list;
  }

  function deleteCustomTag(tag) {
    const list = getCustomTags().filter(t => t !== tag);
    localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(list));
    return list;
  }

  // ── 11. Dışa Aktarma & Toplu Araçlar ──────────────────────────
  function exportAllSqls() {
    const files = _read();
    let content = `-- FrpOku Toplu SQL Dışa Aktarma\n-- Tarih: ${new Date().toLocaleString('tr-TR')}\n-- Toplam Rapor: ${files.length}\n\n`;
    files.forEach(f => {
      if ((f.queries || []).length > 0) {
        content += `${'='.repeat(70)}\n-- RAPOR: ${f.meta?.reportName || f.name} (${f.name})\n${'='.repeat(70)}\n\n`;
        f.queries.forEach(q => {
          content += `-- SORGU: ${q.name}\n${q.sql}\n\n`;
        });
      }
    });
    return content;
  }

  function exportAllSqlsCsv() {
    const files = _read();
    const csvEsc = s => '"' + String(s || '').replace(/"/g, '""') + '"';
    const rows = [['Rapor Adı', 'Dosya Adı', 'Sorgu Adı', 'Satır Sayısı', 'Parametre Sayısı', 'SQL Metni']];
    files.forEach(file => {
      const reportName = file.meta?.reportName || file.name;
      (file.queries || []).forEach(q => {
        const lineCount = (q.sql || '').split('\n').length;
        const paramCount = ((q.sql || '').match(/:([a-zA-Z_]\w*)/g) || []).length;
        rows.push([reportName, file.name, q.name, lineCount, paramCount, q.sql || '']);
      });
    });
    return '\uFEFF' + rows.map(r => r.map(csvEsc).join(';')).join('\r\n');
  }

  // ── Public Store API (Köprü ve Delegasyon) ─────────────────────
  const FrpStore = {
    getAll, getById, add, addMany, deleteOne, deleteMany, deleteAll,
    updateNote, updateMeta, updateCode, updateFileName, restoreFromIndexedDB,
    toggleFavorite, togglePin, addTag, removeTag, getAllTags, getCustomTags, addCustomTag, deleteCustomTag,
    setCategory, getCategories, getCategoryObjects, addCategory, updateCategory, deleteCategory,
    getSnippets, addSnippet, removeSnippet, updateSnippet,
    getTrash, moveToTrash, moveManyToTrash, restoreFromTrash, restoreManyFromTrash, purgeFromTrash, purgeManyFromTrash, emptyTrash,
    getTheme, setTheme, initTheme,
    getPreferences, setPreferences, applyPreferences, getUserProfile, setUserProfile,
    addRecent, getRecent, clearRecent, removeRecent,
    exportAllSqls, exportAllSqlsCsv, search, getStats,

    // Analytics delegasyonları
    getSqlComplexity: (sql) => window.FrpComplexity ? window.FrpComplexity.getSqlComplexity(sql) : {},
    getDependencyMap: () => window.FrpDependencies ? window.FrpDependencies.getDependencyMap(_read()) : [],
    getTableUsage: () => window.FrpTableUsage ? window.FrpTableUsage.getTableUsage(_read()) : [],
    findDuplicateQueries: () => window.FrpTableUsage ? window.FrpTableUsage.findDuplicateQueries(_read()) : [],
    getParameterUsage: () => window.FrpParamUsage ? window.FrpParamUsage.getParameterUsage(_read()) : [],
    checkPascalSyntax: (code) => window.FrpSyntaxCheck ? window.FrpSyntaxCheck.checkPascalSyntax(code) : { errors: [], warnings: [] },
    checkSqlStaticSyntax: (sql) => window.FrpSyntaxCheck ? window.FrpSyntaxCheck.checkSqlStaticSyntax(sql) : { errors: [], warnings: [] },
    bumpVersionFilename: (name, count) => window.FrpTags ? window.FrpTags.bumpVersionFilename(name, count) : name,

    refreshFromCloud: async function() {
      if (window.FrpCloud && typeof window.FrpCloud.loadActiveReports === 'function') {
        const cloudFiles = await window.FrpCloud.loadActiveReports();
        if (Array.isArray(cloudFiles)) {
          _memoryStore = cloudFiles;
          try { localStorage.setItem(STORE_KEY, JSON.stringify(cloudFiles)); } catch (e) {}
          syncToIndexedDB(cloudFiles);
          if (typeof window.refreshAll === 'function') window.refreshAll();
          return cloudFiles;
        }
      }
      return _read();
    }
  };

  window.FrpStore = FrpStore;
})();
