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
  const TRASH_KEY = 'frpoku_trash';

  const DB_NAME = 'FrpOkuDB';
  const DB_STORE = 'files';
  const DB_TRASH_STORE = 'trash';
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

  async function hydrateFromIndexedDB() {
    const restored = await restoreFromIndexedDB();
    if (!Array.isArray(restored)) return [];
    _memoryStore = restored;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(restored)); } catch {}
    return restored;
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

  function _audit(action, target = '', details = '') {
    try {
      if (window.FrpAudit && typeof window.FrpAudit.logAction === 'function') {
        window.FrpAudit.logAction({ action, target: String(target || ''), details: String(details || '') }).catch(() => {});
      }
    } catch (e) {}
  }

  function _reportsOwnedBySession(files) {
    const user = window.FrpAuth && typeof window.FrpAuth.getUser === 'function' ? window.FrpAuth.getUser() : null;
    if (!user) return [];
    return files.filter(file => !file.userId && !file.user_id || String(file.userId || file.user_id) === String(user.id));
  }

  let _persistedReportHashes = new Map();
  const _reportSyncChains = new Map();

  function _reportHash(report) {
    try { return JSON.stringify(report); } catch { return ''; }
  }

  function _rememberPersisted(files) {
    _persistedReportHashes = new Map((files || []).map(report => [String(report.id), _reportHash(report)]));
  }

  function _persistLocal(files) {
    _memoryStore = files;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(files));
      syncToIndexedDB(files);
      return true;
    } catch (e) {
      syncToIndexedDB(files);
      return true;
    }
  }

  function _applySavedVersion(id, version) {
    const current = _memoryStore.find(report => String(report.id) === String(id));
    if (!current || !version) return;
    current.version = version;
    _persistLocal(_memoryStore);
    _persistedReportHashes.set(String(id), _reportHash(current));
  }

  function _notifySyncIssue(message) {
    if (typeof window.showToast === 'function') window.showToast(message, 'error');
    else if (typeof window.toast === 'function') window.toast(message, 'error', 6000);
  }

  function _queueReportSync(id) {
    if (!window.FrpCloud || typeof window.FrpCloud.saveReport !== 'function') return;
    const key = String(id);
    const previous = _reportSyncChains.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const latest = _memoryStore.find(report => String(report.id) === key);
      if (!latest) return;
      try {
        const saved = await window.FrpCloud.saveReport(latest);
        if (!saved) throw new Error('Bulut kaydı doğrulanamadı.');
        _applySavedVersion(key, saved.version);
      } catch (error) {
        console.warn('Rapor senkronizasyonu başarısız:', error);
        const eventName = error?.status === 409 ? 'frp:sync-conflict' : 'frp:sync-error';
        _notifySyncIssue(error?.status === 409
          ? 'Bu rapor başka bir oturumda değiştirildi. Yenileyip tekrar deneyin.'
          : 'Bulut kaydı başarısız oldu; yerel kopyanız korundu.');
        window.dispatchEvent(new CustomEvent(eventName, { detail: { id: key, message: error?.message || 'Rapor kaydedilemedi.' } }));
      }
    }).finally(() => {
      if (_reportSyncChains.get(key) === next) _reportSyncChains.delete(key);
    });
    _reportSyncChains.set(key, next);
  }

  function _write(files, { syncCloud = true } = {}) {
    const ownedFiles = _reportsOwnedBySession(files);
    const changedIds = syncCloud ? ownedFiles
      .filter(report => _persistedReportHashes.get(String(report.id)) !== _reportHash(report))
      .map(report => String(report.id)) : [];
    _persistLocal(files);
    _rememberPersisted(files);
    changedIds.forEach(_queueReportSync);
    return true;
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
            window.FRP_CLOUD_STATUS = { ok: true, kind: 'success', count: cloudFiles.length };
          } else if (typeof window.FrpCloud.getLastLoadStatus === 'function') {
            window.FRP_CLOUD_STATUS = window.FrpCloud.getLastLoadStatus();
            window.dispatchEvent(new CustomEvent('frp:cloud-load-error', { detail: window.FRP_CLOUD_STATUS }));
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
            _writeTrash(trashCloud);
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
          if (typeof window.FrpCloud.loadSettings === 'function') {
            const cloudSettings = await window.FrpCloud.loadSettings();
            const cloudTags = cloudSettings?.custom_tags ?? cloudSettings?.customTags;
            if (Array.isArray(cloudTags)) localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(cloudTags));
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
      _rememberPersisted(loadedFiles);
    } catch (err) {
      console.warn('Bootstrap error:', err);
    } finally {
      if (typeof window.refreshAll === 'function') window.refreshAll();
      if (window.FRP_CLOUD_STATUS && window.FRP_CLOUD_STATUS.ok === false) {
        _notifySyncIssue(window.FRP_CLOUD_STATUS.kind === 'auth'
          ? 'Bulut oturumu doğrulanamadı; son yerel kopya gösteriliyor.'
          : 'Buluta ulaşılamadı; son başarılı yerel kopya korundu.');
      }
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
    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    const userId = curUser ? curUser.id : 'public';
    const ownerName = curUser ? (curUser.full_name || curUser.username) : 'Anonim';
    const ownerUsername = curUser ? curUser.username : '';
    const ownerDepartment = curUser ? (curUser.department || 'Bilgi İşlem') : '';

    const fileRecord = {
      id:              existingIdx >= 0 ? files[existingIdx].id : _uuid(),
      name:            fileName,
      userId:          existingIdx >= 0 ? (files[existingIdx].userId || userId) : userId,
      sizeBytes:       fileSize,
      loadedAt:        new Date().toISOString(),
      meta:            parsedData.meta || {},
      pascalScript:    parsedData.pascalScript || null,
      queries:         parsedData.queries || [],
      datasets:        parsedData.datasets || [],
      tree:            parsedData.tree || [],
      pages:           parsedData.pages || [],
      dialogPages:     parsedData.dialogPages || [],
      rawXml:          parsedData.rawXml || null,
      userNote:        existingIdx >= 0 ? (files[existingIdx].userNote || '') : '',
      isFavorite:      existingIdx >= 0 ? (files[existingIdx].isFavorite || false) : false,
      isPinned:        existingIdx >= 0 ? (files[existingIdx].isPinned || false) : false,
      isPublic:        existingIdx >= 0 ? (files[existingIdx].isPublic || false) : false,
      ownerName:       existingIdx >= 0 ? (files[existingIdx].ownerName || ownerName) : ownerName,
      ownerUsername:   existingIdx >= 0 ? (files[existingIdx].ownerUsername || ownerUsername) : ownerUsername,
      ownerDepartment: existingIdx >= 0 ? (files[existingIdx].ownerDepartment || ownerDepartment) : ownerDepartment,
      sharedAt:        existingIdx >= 0 ? (files[existingIdx].sharedAt || null) : null,
      version:         existingIdx >= 0 ? (Number(files[existingIdx].version) || 1) : 0,
      tags:            mergedTags
    };

    if (existingIdx >= 0) {
      files[existingIdx] = fileRecord;
      _write(files);
      _audit('REPORT_UPDATE', fileName, `${fileSize ? Math.round(fileSize / 1024) + ' KB' : ''} güncellendi.`);
      return { status: 'updated', file: fileRecord };
    } else {
      files.push(fileRecord);
      _write(files);
      _audit('REPORT_UPLOAD', fileName, `${fileSize ? Math.round(fileSize / 1024) + ' KB' : ''} yüklendi.`);
      return { status: 'added', file: fileRecord };
    }
  }

  function addMany(parsedList) {
    const files = _read();
    let added = 0, updated = 0;
    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    const userId = curUser ? curUser.id : 'public';
    const ownerName = curUser ? (curUser.full_name || curUser.username) : 'Anonim';
    const ownerUsername = curUser ? curUser.username : '';
    const ownerDepartment = curUser ? (curUser.department || 'Bilgi İşlem') : '';

    parsedList.forEach(item => {
      const { parsedData, fileName, fileSize } = item;
      const existingIdx = files.findIndex(f => f.name === fileName);
      const autoTags = window.FrpTags ? window.FrpTags.generateAutoTags(parsedData, fileName) : [];
      const existingTags = existingIdx >= 0 ? (files[existingIdx].tags || []) : [];
      const mergedTags = [...new Set([...existingTags, ...autoTags])];

      const fileRecord = {
        id:              existingIdx >= 0 ? files[existingIdx].id : _uuid(),
        name:            fileName,
        userId:          existingIdx >= 0 ? (files[existingIdx].userId || userId) : userId,
        sizeBytes:       fileSize,
        loadedAt:        new Date().toISOString(),
        meta:            parsedData.meta || {},
        pascalScript:    parsedData.pascalScript || null,
        queries:         parsedData.queries || [],
        datasets:        parsedData.datasets || [],
        tree:            parsedData.tree || [],
        pages:           parsedData.pages || [],
        dialogPages:     parsedData.dialogPages || [],
        rawXml:          parsedData.rawXml || null,
        userNote:        existingIdx >= 0 ? (files[existingIdx].userNote || '') : '',
        isFavorite:      existingIdx >= 0 ? (files[existingIdx].isFavorite || false) : false,
        isPinned:        existingIdx >= 0 ? (files[existingIdx].isPinned || false) : false,
        isPublic:        existingIdx >= 0 ? (files[existingIdx].isPublic || false) : false,
        ownerName:       existingIdx >= 0 ? (files[existingIdx].ownerName || ownerName) : ownerName,
        ownerUsername:   existingIdx >= 0 ? (files[existingIdx].ownerUsername || ownerUsername) : ownerUsername,
        ownerDepartment: existingIdx >= 0 ? (files[existingIdx].ownerDepartment || ownerDepartment) : ownerDepartment,
        sharedAt:        existingIdx >= 0 ? (files[existingIdx].sharedAt || null) : null,
        version:         existingIdx >= 0 ? (Number(files[existingIdx].version) || 1) : 0,
        tags:            mergedTags
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
    _audit('REPORT_BULK_UPLOAD', `${parsedList.length} Rapor`, `${added} yeni eklendi, ${updated} güncellendi.`);
    return { added, updated };
  }

  function deleteOne(id) {
    const file = _read().find(f => f.id === id);
    const files = _read().filter(f => f.id !== id);
    if (window.FrpCloud && typeof window.FrpCloud.purgeReport === 'function') {
      window.FrpCloud.purgeReport(id).catch(() => {});
    }
    _write(files);
    _audit('REPORT_DELETE', file ? file.name : id, 'Rapor kalıcı olarak silindi.');
  }

  function deleteMany(ids) {
    const idSet = new Set(ids);
    const files = _read().filter(f => !idSet.has(f.id));
    if (window.FrpCloud && typeof window.FrpCloud.purgeManyReports === 'function') {
      window.FrpCloud.purgeManyReports(ids).catch(() => {});
    }
    _write(files);
    _audit('REPORT_BULK_DELETE', `${ids.length} Rapor`, 'Seçili raporlar kalıcı olarak silindi.');
  }

  function deleteAll() {
    if (window.FrpCloud && typeof window.FrpCloud.emptyTrash === 'function') {
      window.FrpCloud.emptyTrash().catch(() => {});
    }
    _write([]);
    syncToIndexedDB([]);
    _audit('REPORT_CLEAR_ALL', 'Tüm Raporlar', 'Tüm rapor arşivi tamamen temizlendi.');
  }

  // ── 5. Çöp Kutusu (Soft Delete) Metotları ─────────────────────
  function _readTrash() {
    if (_trashStore && _trashStore.length > 0) return _trashStore;
    try {
      const raw = localStorage.getItem(TRASH_KEY);
      _trashStore = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(_trashStore)) _trashStore = [];
      return _trashStore;
    } catch {
      _trashStore = [];
      return _trashStore;
    }
  }

  function _writeTrash(items) {
    _trashStore = Array.isArray(items) ? items : [];
    try {
      localStorage.setItem(TRASH_KEY, JSON.stringify(_trashStore));
    } catch (e) {
      console.warn('Trash localStorage write error:', e);
    }
    syncTrashToIndexedDB(_trashStore);
  }

  function getTrash() {
    const list = _readTrash();
    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    if (!curUser) return list;
    return list.filter(t => t.userId === curUser.id || !t.userId || t.userId === 'public' || curUser.role === 'admin');
  }

  async function moveToTrash(id) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx < 0) return false;

    const fileToTrash = files[idx];
    fileToTrash.deletedAt = new Date().toISOString();
    fileToTrash.isDeleted = true;
    fileToTrash.is_deleted = true;

    files.splice(idx, 1);
    _write(files);

    const trash = _readTrash().filter(t => t.id !== id);
    trash.unshift(fileToTrash);
    _writeTrash(trash);

    _audit('TRASH_MOVE', fileToTrash.name || id, 'Rapor çöp kutusuna taşındı.');

    if (window.FrpCloud && typeof window.FrpCloud.moveToTrash === 'function') {
      const saved = await window.FrpCloud.moveToTrash(id, fileToTrash);
      if (saved?.version) {
        fileToTrash.version = saved.version;
        _writeTrash(trash);
      }
    }
    return true;
  }

  async function moveManyToTrash(ids) {
    const idSet = new Set(ids);
    const files = _read();
    const toTrash = files.filter(f => idSet.has(f.id));
    const remaining = files.filter(f => !idSet.has(f.id));

    const now = new Date().toISOString();
    let trash = _readTrash();
    toTrash.forEach(f => {
      f.deletedAt = now;
      f.isDeleted = true;
      f.is_deleted = true;
      trash = trash.filter(t => t.id !== f.id);
      trash.unshift(f);
    });

    _write(remaining);
    _writeTrash(trash);

    _audit('TRASH_BULK_MOVE', `${toTrash.length} Rapor`, 'Seçili raporlar çöp kutusuna taşındı.');

    if (window.FrpCloud && typeof window.FrpCloud.moveToTrash === 'function') {
      const savedReports = await Promise.all(toTrash.map(report => window.FrpCloud.moveToTrash(report.id, report)));
      savedReports.forEach((saved, index) => { if (saved?.version) toTrash[index].version = saved.version; });
      _writeTrash(trash);
    }
    return true;
  }

  async function restoreFromTrash(id) {
    let trash = _readTrash();
    const idx = trash.findIndex(t => t.id === id);
    if (idx < 0) return false;

    const restoredFile = trash[idx];
    delete restoredFile.deletedAt;
    restoredFile.isDeleted = false;
    restoredFile.is_deleted = false;

    trash.splice(idx, 1);
    _writeTrash(trash);

    const files = _read();
    files.unshift(restoredFile);
    _write(files);

    _audit('TRASH_RESTORE', restoredFile.name || id, 'Rapor çöp kutusundan geri yüklendi.');

    return true;
  }

  async function restoreManyFromTrash(ids) {
    const idSet = new Set(ids);
    let trash = _readTrash();
    const toRestore = trash.filter(t => idSet.has(t.id));
    trash = trash.filter(t => !idSet.has(t.id));
    _writeTrash(trash);

    const files = _read();
    toRestore.forEach(f => {
      delete f.deletedAt;
      f.isDeleted = false;
      f.is_deleted = false;
      files.unshift(f);
    });
    _write(files);

    _audit('TRASH_BULK_RESTORE', `${toRestore.length} Rapor`, 'Seçili raporlar çöp kutusundan geri yüklendi.');

    return true;
  }

  async function purgeFromTrash(id) {
    let trash = _readTrash();
    const item = trash.find(t => t.id === id);
    trash = trash.filter(t => t.id !== id);
    _writeTrash(trash);

    _audit('TRASH_PURGE', item ? item.name : id, 'Rapor çöp kutusundan kalıcı olarak silindi.');

    if (window.FrpCloud && typeof window.FrpCloud.purgeReport === 'function') {
      await window.FrpCloud.purgeReport(id);
    }
    return true;
  }

  async function purgeManyFromTrash(ids) {
    const idSet = new Set(ids);
    let trash = _readTrash();
    trash = trash.filter(t => !idSet.has(t.id));
    _writeTrash(trash);

    _audit('TRASH_BULK_PURGE', `${ids.length} Rapor`, 'Seçili raporlar çöpten kalıcı olarak silindi.');

    if (window.FrpCloud && typeof window.FrpCloud.purgeManyReports === 'function') {
      await window.FrpCloud.purgeManyReports(ids);
    }
    return true;
  }

  async function emptyTrash() {
    _writeTrash([]);
    _audit('TRASH_EMPTY', 'Çöp Kutusu', 'Çöp kutusu tamamen boşaltıldı.');

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
      _audit('NOTE_UPDATE', files[idx].name || id, 'Rapor kullanıcı notu güncellendi.');
      return true;
    }
    return false;
  }

  function updateMeta(id, metaPatch) {
    if (!metaPatch || typeof metaPatch !== 'object') return false;
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx >= 0) {
      const currentMeta = { ...(files[idx].meta || {}) };
      for (const [k, v] of Object.entries(metaPatch)) {
        if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
          currentMeta[k] = v;
        }
      }
      files[idx].meta = currentMeta;
      _write(files);
      _audit('REPORT_RENAME', files[idx].name || id, `Rapor meta/başlık bilgisi güncellendi: ${metaPatch.reportName || ''}`);
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
    _audit('REPORT_CODE_UPDATE', file.name || id, 'SQL veya Pascal kodu güncellendi.');
    return true;
  }

  function updateReport(id, reportPatch) {
    if (!reportPatch || typeof reportPatch !== 'object') return null;
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx < 0) return null;
    const existing = files[idx];
    const updated = {
      ...existing,
      ...reportPatch,
      id: existing.id,
      userId: existing.userId || existing.user_id,
      user_id: existing.user_id || existing.userId
    };
    if (window.buildUpdatedFrpXml) updated.rawXml = window.buildUpdatedFrpXml(updated);
    files[idx] = updated;
    _write(files);
    _audit('REPORT_UPDATE', updated.name || id, 'Rapor içeriği ve XML yapısı güncellendi.');
    return updated;
  }

  function saveFile(file) {
    return file?.id ? updateReport(file.id, file) : null;
  }

  function updateFileName(id, newName) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx < 0) return false;
    const oldName = files[idx].name;
    files[idx].name = newName;
    _write(files);
    _audit('REPORT_RENAME', oldName, `Dosya adı "${newName}" olarak değiştirildi.`);
    return true;
  }

  function toggleFavorite(id) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx >= 0) {
      files[idx].isFavorite = !files[idx].isFavorite;
      _write(files);
      _audit('REPORT_FAVORITE', files[idx].name || id, files[idx].isFavorite ? 'Favorilere eklendi.' : 'Favorilerden çıkarıldı.');
      return files[idx].isFavorite;
    }
    return false;
  }

  function setFavoriteMany(ids, isFav = true) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const files = _read();
    const idSet = new Set(ids);
    let count = 0;
    files.forEach(f => {
      if (idSet.has(f.id)) {
        f.isFavorite = !!isFav;
        count++;
      }
    });
    if (count > 0) {
      _write(files);
      _audit('REPORT_BULK_FAVORITE', `${count} Rapor`, isFav ? 'Toplu favorilere eklendi.' : 'Toplu favorilerden çıkarıldı.');
    }
    return count;
  }

  function toggleFavoriteMany(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const files = _read();
    const idSet = new Set(ids);
    let count = 0;
    files.forEach(f => {
      if (idSet.has(f.id)) {
        f.isFavorite = !f.isFavorite;
        count++;
      }
    });
    if (count > 0) {
      _write(files);
      _audit('REPORT_BULK_FAVORITE', `${count} Rapor`, 'Toplu favori durumu değiştirildi.');
    }
    return count;
  }

  function togglePin(id) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx >= 0) {
      files[idx].isPinned = !files[idx].isPinned;
      _write(files);
      _audit('REPORT_PIN', files[idx].name || id, files[idx].isPinned ? 'Rapor üste sabitlendi.' : 'Rapor sabitlemesi kaldırıldı.');
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
        _audit('TAG_ADD', files[idx].name || id, `"${t}" etiketi eklendi.`);
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
      _audit('TAG_REMOVE', files[idx].name || id, `"${tag}" etiketi kaldırıldı.`);
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
    getCustomTags().forEach(t => tagSet.add(t));
    return [...tagSet].sort();
  }

  function getCustomTags() {
    try {
      const raw = localStorage.getItem(CUSTOM_TAGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function addCustomTag(tag) {
    const trimmed = (tag || '').trim();
    if (!trimmed) return false;
    let list = getCustomTags();
    if (!list.includes(trimmed)) {
      list.push(trimmed);
      try { localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(list)); } catch {}
      _audit('TAG_CREATE', trimmed, 'Yeni özel etiket havuza eklendi.');
      if (window.FrpCloud && typeof window.FrpCloud.saveSettings === 'function') {
        window.FrpCloud.saveSettings({ custom_tags: list }).catch(() => {});
      }
    }
    return list;
  }

  function deleteCustomTag(tag) {
    const trimmed = (tag || '').trim();
    let list = getCustomTags().filter(t => t !== trimmed);
    try { localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(list)); } catch {}
    _audit('TAG_DELETE', trimmed, 'Özel etiket havuzdan silindi.');
    if (window.FrpCloud && typeof window.FrpCloud.saveSettings === 'function') {
      window.FrpCloud.saveSettings({ custom_tags: list }).catch(() => {});
    }
    return list;
  }

  // ── 6.5. Ortak Rapor Havuzu & Çalışma Alanı Yönetimi ─────────
  const WORKSPACE_KEY = 'frpoku_active_workspace';
  let _activeWorkspace = localStorage.getItem(WORKSPACE_KEY) || 'personal';

  function getActiveWorkspace() {
    return _activeWorkspace;
  }

  function setActiveWorkspace(ws) {
    if (ws === 'pool' || ws === 'personal') {
      _activeWorkspace = ws;
      localStorage.setItem(WORKSPACE_KEY, ws);
      if (typeof window.refreshAll === 'function') window.refreshAll();
    }
    return _activeWorkspace;
  }

  function getMyReports() {
    const list = getAll();
    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    if (!curUser) return list;

    if (curUser.role === 'admin') return list;
    return list.filter(f => String(f.userId || f.user_id || '') === String(curUser.id));
  }

  function getPoolReports() {
    const list = getAll();
    const poolList = list.filter(f => f.isPublic === true || f.is_public === true);
    return poolList;
  }

  function toggleReportPool(id, makePublic) {
    const files = _read();
    const idx = files.findIndex(f => f.id === id);
    if (idx < 0) return false;

    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    const nowIso = new Date().toISOString();

    files[idx].isPublic = !!makePublic;
    files[idx].is_public = !!makePublic;

    if (makePublic) {
      files[idx].sharedAt = nowIso;
      if (curUser) {
        files[idx].ownerName = curUser.full_name || curUser.username;
        files[idx].ownerUsername = curUser.username;
        files[idx].ownerDepartment = curUser.department || 'Bilgi İşlem';
      }
    }

    _write(files);

    if (window.FrpAudit) {
      window.FrpAudit.logAction({
        action: makePublic ? 'POOL_ADD' : 'POOL_REMOVE',
        target: files[idx]?.meta?.reportName || files[idx]?.name || id,
        details: `'${files[idx]?.name}' raporu ${makePublic ? 'Ortak Havuzda paylaşıldı.' : 'Ortak Havuzdan kaldırıldı.'}`
      });
    }

    return files[idx].isPublic;
  }

  function bulkToggleReportPool(ids, makePublic) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const files = _read();
    const idSet = new Set(ids);
    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    const nowIso = new Date().toISOString();
    let count = 0;

    files.forEach(f => {
      if (idSet.has(f.id)) {
        f.isPublic = !!makePublic;
        f.is_public = !!makePublic;
        if (makePublic) {
          f.sharedAt = nowIso;
          if (curUser) {
            f.ownerName = curUser.full_name || curUser.username;
            f.ownerUsername = curUser.username;
            f.ownerDepartment = curUser.department || 'Bilgi İşlem';
          }
        }
        count++;
      }
    });

    if (count > 0) {
      _write(files);
      if (window.FrpAudit) {
        window.FrpAudit.logAction({
          action: makePublic ? 'POOL_ADD_BULK' : 'POOL_REMOVE_BULK',
          target: `${count} Rapor`,
          details: `${count} adet rapor ${makePublic ? 'toplu olarak Ortak Havuzda paylaşıldı.' : 'toplu olarak Ortak Havuzdan kaldırıldı.'}`
        });
      }
    }
    return count;
  }

  function cloneReportToPersonal(id) {
    const original = getById(id);
    if (!original) return null;

    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    const newId = _uuid();
    const clonedName = original.name.replace(/\.frp$/i, '') + ' (Kopya).frp';

    const clonedRecord = JSON.parse(JSON.stringify(original));
    clonedRecord.id = newId;
    clonedRecord.name = clonedName;
    clonedRecord.userId = curUser ? curUser.id : 'public';
    clonedRecord.ownerName = curUser ? (curUser.full_name || curUser.username) : 'Anonim';
    clonedRecord.ownerUsername = curUser ? curUser.username : '';
    clonedRecord.ownerDepartment = curUser ? (curUser.department || 'Bilgi İşlem') : '';
    clonedRecord.isPublic = false;
    clonedRecord.is_public = false;
    clonedRecord.version = 0;

    if (window.FrpAudit) {
      window.FrpAudit.logAction({
        action: 'POOL_CLONE',
        target: original.meta?.reportName || original.name,
        details: `'${original.name}' raporu Ortak Havuzdan kişisel çalışma alanına klonlandı.`
      });
    }
    clonedRecord.sharedAt = null;
    clonedRecord.loadedAt = new Date().toISOString();

    const files = _read();
    files.unshift(clonedRecord);
    _write(files);

    return clonedRecord;
  }

  // ── 7. Kategoriler ──────────────────────────────────────────
  const DEFAULT_CATEGORIES = [
    { id: 'cat_1', name: 'Finans', color: '#10b981', icon: '' },
    { id: 'cat_2', name: 'HBYS / Klinik', color: '#3b82f6', icon: '' },
    { id: 'cat_3', name: 'Yönetim & İstatistik', color: '#8b5cf6', icon: '' },
    { id: 'cat_4', name: 'Laboratuvar', color: '#ec4899', icon: '' },
    { id: 'cat_5', name: 'Eczane & Depo', color: '#f59e0b', icon: '' }
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

  function addCategory(name, color = '#3b82f6', icon = '') {
    const trimmed = (name || '').trim();
    if (!trimmed) return { success: false, reason: 'Kategori adı boş olamaz.' };
    const cats = getCategoryObjects();
    if (cats.some(c => (c.name || '').toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, reason: 'Bu isimde bir kategori zaten mevcut.' };
    }
    const newCat = { id: `cat_${Date.now()}`, name: trimmed, color: color || '#3b82f6', icon: icon || '' };
    cats.push(newCat);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
    _audit('CATEGORY_CREATE', trimmed, 'Yeni kategori oluşturuldu.');
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
    if (icon !== undefined) cats[idx].icon = icon;

    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
    _audit('CATEGORY_UPDATE', cleanNew || oldName, `Kategori güncellendi (Eski: ${oldName}).`);
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

  function deleteCategory(identifier) {
    if (!identifier) return false;
    const trimmed = String(identifier).trim().toLowerCase();
    let cats = getCategoryObjects();
    const toDel = cats.find(c => (c.id && String(c.id).toLowerCase() === trimmed) || (c.name && c.name.trim().toLowerCase() === trimmed));
    if (!toDel) return false;

    cats = cats.filter(c => c.id !== toDel.id && (c.name || '').trim().toLowerCase() !== (toDel.name || '').trim().toLowerCase());
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
    _audit('CATEGORY_DELETE', toDel.name || identifier, 'Kategori silindi.');

    if (window.FrpCloud && typeof window.FrpCloud.deleteCategory === 'function' && toDel.id) {
      window.FrpCloud.deleteCategory(toDel.id).catch(() => {});
    }

    const files = _read();
    let changed = false;
    const delNameLower = (toDel.name || '').trim().toLowerCase();
    files.forEach(f => {
      if ((f.category || '').trim().toLowerCase() === delNameLower) {
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
    _audit('CATEGORY_ASSIGN', files[idx].name || id, `Kategori "${categoryName || 'Temizlendi'}" olarak ayarlandı.`);
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

    return { total: files.length, totalFiles: files.length, totalQueries, queries: totalQueries, totalPascal, pascal: totalPascal, totalFavorites, favorites: totalFavorites, totalPinned, totalBytes, storageFormatted };
  }

  function isStorageNearFull() {
    try {
      let total = 0;
      for (let x in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, x)) {
          total += ((localStorage[x] || '').length * 2);
        }
      }
      return total > 4 * 1024 * 1024;
    } catch {
      return false;
    }
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
  function getTheme() { 
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === 'dark' ? 'dark' : 'light';
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      if (p && p.theme) return p.theme === 'dark' ? 'dark' : 'light';
    } catch (e) {}
    return 'light'; 
  }

  function setTheme(theme) {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, safeTheme);
    localStorage.setItem('frpoku_theme', safeTheme);
    document.documentElement.setAttribute('data-theme', safeTheme);

    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      p.theme = safeTheme;
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch (e) {}

    if (window.FrpThemes && typeof window.FrpThemes.setTheme === 'function') {
      window.FrpThemes.setTheme(safeTheme);
    }
  }

  function initTheme() { 
    setTheme(getTheme()); 
  }
  initTheme();

  function getPreferences() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      const defaults = { 
        theme: getTheme(), 
        fontWeight: 'normal',
        fontFamily: 'inter',
        codeFont: 'jetbrains',
        fontSize: 'normal',
        density: 'normal',
        defaultSort: 'updated_desc', 
        compactView: false, 
        autoTagging: true 
      };
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return { 
        theme: 'light', 
        fontWeight: 'normal',
        fontFamily: 'inter',
        codeFont: 'jetbrains',
        fontSize: 'normal',
        density: 'normal',
        defaultSort: 'updated_desc', 
        compactView: false, 
        autoTagging: true 
      };
    }
  }

  function setPreferences(patch) {
    const cur = getPreferences();
    const updated = { ...cur, ...patch };
    if (updated.theme) {
      localStorage.setItem(THEME_KEY, updated.theme);
      localStorage.setItem('frpoku_theme', updated.theme);
    }
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(updated)); } catch {}
    if (window.FrpCloud && typeof window.FrpCloud.saveSettings === 'function') {
      window.FrpCloud.saveSettings({ preferences: updated, theme: updated.theme });
    }
    return updated;
  }

  function applyPreferences() {
    const prefs = getPreferences();
    if (!prefs) return;

    // 1. Tema
    const themeToApply = prefs.theme || getTheme() || 'light';
    if (window.FrpThemes && typeof window.FrpThemes.setTheme === 'function') {
      window.FrpThemes.setTheme(themeToApply);
    } else {
      setTheme(themeToApply);
    }

    if (typeof document === 'undefined' || !document.documentElement) return;
    const root = document.documentElement;

    // 2. Genel Font Ailesi (Genişletilmiş Popüler Fontlar)
    const fontMap = {
      'inter': "'Inter', sans-serif",
      'jakarta': "'Plus Jakarta Sans', sans-serif",
      'outfit': "'Outfit', sans-serif",
      'roboto': "'Roboto', sans-serif",
      'poppins': "'Poppins', sans-serif",
      'montserrat': "'Montserrat', sans-serif",
      'nunito': "'Nunito', sans-serif",
      'raleway': "'Raleway', sans-serif",
      'ubuntu': "'Ubuntu', sans-serif",
      'sourcesans': "'Source Sans 3', sans-serif",
      'opensans': "'Open Sans', sans-serif",
      'jetbrains': "'JetBrains Mono', monospace",
      'fira': "'Fira Code', monospace",
      'cascadia': "'Cascadia Code', monospace",
      'system': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    };
    if (prefs.fontFamily && fontMap[prefs.fontFamily]) {
      root.style.setProperty('--font', fontMap[prefs.fontFamily]);
    }

    // 2.1. Yazı Tipi Kalınlığı (Font Weight Dinamik Skalası)
    const weightMap = {
      'light':     { base: '300', bold: '500', heading: '600' },
      'normal':    { base: '400', bold: '600', heading: '700' },
      'bold':      { base: '500', bold: '700', heading: '800' },
      'extrabold': { base: '600', bold: '800', heading: '900' }
    };
    const fwConfig = weightMap[prefs.fontWeight] || weightMap['normal'];
    root.style.setProperty('--base-weight', fwConfig.base);
    root.style.setProperty('--bold-weight', fwConfig.bold);
    root.style.setProperty('--heading-weight', fwConfig.heading);
    root.style.setProperty('--report-title-weight', fwConfig.bold);
    if (document.body) document.body.style.fontWeight = fwConfig.base;

    // 3. Kod Editörü Fontu (Genişletilmiş Geliştirici Fontları)
    const codeFontMap = {
      'jetbrains': "'JetBrains Mono', monospace",
      'fira': "'Fira Code', monospace",
      'cascadia': "'Cascadia Code', monospace",
      'inconsolata': "'Inconsolata', monospace",
      'sourcecode': "'Source Code Pro', monospace",
      'monaco': "'Monaco', 'Menlo', monospace",
      'courierprime': "'Courier Prime', monospace",
      'consolas': "'Consolas', monospace"
    };
    if (prefs.codeFont && codeFontMap[prefs.codeFont]) {
      root.style.setProperty('--mono', codeFontMap[prefs.codeFont]);
    }

    // 4. Arayüz & Yazı Boyutu (UI Scale)
    const fontSizeMap = {
      'micro': '13px',
      'compact': '14px',
      'normal': '15px',
      'spacious': '16px',
      'large': '17px'
    };
    if (prefs.fontSize) {
      root.setAttribute('data-ui-scale', prefs.fontSize);
      if (fontSizeMap[prefs.fontSize]) {
        root.style.setProperty('--font-size-base', fontSizeMap[prefs.fontSize]);
      }
    }

    // 5. Tablo & Liste Sıkışıklığı (Density)
    const density = prefs.density || 'normal';
    root.setAttribute('data-density', density);
    if (density === 'compact-ultra' || density === 'ultra') {
      root.style.setProperty('--row-height', '28px');
      root.style.setProperty('--cell-padding', '4px 8px');
    } else if (density === 'compact') {
      root.style.setProperty('--row-height', '34px');
      root.style.setProperty('--cell-padding', '6px 10px');
    } else if (density === 'spacious') {
      root.style.setProperty('--row-height', '50px');
      root.style.setProperty('--cell-padding', '14px 16px');
    } else {
      root.style.setProperty('--row-height', '42px');
      root.style.setProperty('--cell-padding', '9px 12px');
    }
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
    _audit('REPORT_EXPORT', 'Tüm SQL Sorguları', `${files.length} raporun SQL sorgusu dışa aktarıldı.`);
    return content;
  }

  function exportAllSqlsCsv() {
    const files = _read();
    const csvEsc = s => window.FrpFileSafety ? window.FrpFileSafety.safeCsvCell(s) : '"' + String(s || '').replace(/"/g, '""') + '"';
    const rows = [['Rapor Adı', 'Dosya Adı', 'Sorgu Adı', 'Satır Sayısı', 'Parametre Sayısı', 'SQL Metni']];
    files.forEach(file => {
      const reportName = file.meta?.reportName || file.name;
      (file.queries || []).forEach(q => {
        const lineCount = (q.sql || '').split('\n').length;
        const paramCount = ((q.sql || '').match(/:([a-zA-Z_]\w*)/g) || []).length;
        rows.push([reportName, file.name, q.name, lineCount, paramCount, q.sql || '']);
      });
    });
    _audit('REPORT_EXPORT', 'Tüm SQL Sorguları CSV', `${files.length} raporun SQL sorguları CSV formatında dışa aktarıldı.`);
    return '\uFEFF' + rows.map(r => r.map(csvEsc).join(';')).join('\r\n');
  }

  const DOWNLOAD_HISTORY_KEY = 'frpoku_download_history';

  function getDownloadHistory() {
    try {
      const raw = localStorage.getItem(DOWNLOAD_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function addDownloadHistory({ reportId, reportName, fileName, format, customVersion, timestamp, downloadedAt }) {
    try {
      const list = getDownloadHistory();
      const nowIso = new Date().toISOString();
      list.unshift({
        id: 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: timestamp || downloadedAt || nowIso,
        downloadedAt: downloadedAt || timestamp || nowIso,
        reportId,
        reportName,
        fileName,
        format: format || 'frp',
        customVersion: customVersion || ''
      });
      const trimmed = list.slice(0, 50);
      localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify(trimmed));
      _audit('REPORT_DOWNLOAD', fileName || reportName, `Format: ${format || 'frp'}`);
      return trimmed;
    } catch {
      return [];
    }
  }

  let _autoBackupTimer = null;
  function startAutoBackupTimer() {
    if (_autoBackupTimer) {
      clearInterval(_autoBackupTimer);
      _autoBackupTimer = null;
    }
    const prefs = getPreferences();
    const intervalMinutes = prefs.autoBackupInterval;
    if (!intervalMinutes || intervalMinutes <= 0) return;

    _autoBackupTimer = setInterval(() => {
      try {
        const files = _read();
        if (files.length === 0) return;
        const backupData = {
          version: 'frpoku_backup_v2',
          exportedAt: new Date().toISOString(),
          autoBackup: true,
          count: files.length,
          files: files,
          categories: getCategoryObjects(),
          customTags: getCustomTags(),
          preferences: prefs
        };
        localStorage.setItem('frpoku_auto_backup_last', JSON.stringify(backupData));
      } catch (e) {
        console.warn('Otomatik yedekleme hatası:', e.message);
      }
    }, intervalMinutes * 60 * 1000);
  }

  function exportBackup() {
    const backupObj = {
      version: '7.2',
      exportedAt: new Date().toISOString(),
      reports: _read(),
      categories: getCategoryObjects(),
      customTags: getCustomTags(),
      snippets: getSnippets(),
      preferences: getPreferences(),
      trash: getTrash()
    };
    _audit('BACKUP_EXPORT', 'Tam Yedekleme Paketi', `${backupObj.reports.length} rapor içeren tam sistem yedeği alındı.`);
    return JSON.stringify(backupObj, null, 2);
  }

  function importBackup(jsonStr) {
    try {
      const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      let importedCount = 0;
      const imported = { reports: 0, categories: 0, customTags: 0, snippets: 0, preferences: 0, trash: 0 };

      // Format 1: Tam Yedek Paketi
      if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.reports || data.files)) {
        const reportList = data.reports || data.files || [];
        if (data.categories && Array.isArray(data.categories)) {
          try { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(data.categories)); } catch (e) {}
          imported.categories = data.categories.length;
        }
        if (data.customTags && Array.isArray(data.customTags)) {
          try { localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(data.customTags)); } catch (e) {}
          imported.customTags = data.customTags.length;
        }
        if (data.snippets && Array.isArray(data.snippets)) {
          try { localStorage.setItem(SNIPPET_KEY, JSON.stringify(data.snippets)); } catch (e) {}
          imported.snippets = data.snippets.length;
        }
        if (data.preferences) {
          setPreferences(data.preferences);
          imported.preferences = 1;
        }
        if (Array.isArray(data.trash)) {
          _writeTrash(data.trash);
          imported.trash = data.trash.length;
        }
        const existing = _read();
        const existingIds = new Set(existing.map(f => f.id));
        const newReports = reportList.filter(r => r && r.id && !existingIds.has(r.id));
        const combined = [...existing, ...newReports];
        _write(combined);
        importedCount = newReports.length;
        imported.reports = importedCount;
      }
      // Format 2: Doğrudan Rapor Listesi Dizisi
      else if (Array.isArray(data)) {
        const existing = _read();
        const existingIds = new Set(existing.map(f => f.id));
        const newReports = data.filter(r => r && r.id && !existingIds.has(r.id));
        const combined = [...existing, ...newReports];
        _write(combined);
        importedCount = newReports.length;
        imported.reports = importedCount;
      }

      _audit('BACKUP_IMPORT', 'Yedek İçe Aktarma', `${importedCount} adet rapor sisteme aktarıldı.`);
      return { success: true, count: importedCount, imported };
    } catch (e) {
      console.error('Backup import error:', e);
      return { success: false, reason: e.message };
    }
  }

  function setAutoBackupInterval(minutes) {
    const prefs = getPreferences();
    prefs.autoBackupInterval = minutes;
    setPreferences(prefs);
    startAutoBackupTimer();
  }

  // ── Public Store API (Köprü ve Delegasyon) ─────────────────────
  const FrpStore = {
    getAll, getById, add, addMany, deleteOne, deleteMany, deleteAll,
    updateNote, updateMeta, updateCode, updateReport, saveFile, updateFileName, restoreFromIndexedDB, hydrateFromIndexedDB,
    exportBackup, importBackup,
    toggleFavorite, togglePin, setFavoriteMany, toggleFavoriteMany, addTag, removeTag, getAllTags, getCustomTags, addCustomTag, deleteCustomTag,
    setCategory, getCategories, getCategoryObjects, addCategory, updateCategory, deleteCategory,
    getSnippets, addSnippet, removeSnippet, updateSnippet,
    getTrash, moveToTrash, moveManyToTrash, restoreFromTrash, restoreManyFromTrash, purgeFromTrash, purgeManyFromTrash, emptyTrash,
    getTheme, setTheme, initTheme,
    getPreferences, setPreferences, applyPreferences, getUserProfile, setUserProfile, saveUserProfile: setUserProfile,
    addRecent, getRecent, clearRecent, removeRecent,
    getDownloadHistory, addDownloadHistory, setAutoBackupInterval, startAutoBackupTimer,
    exportAllSqls, exportAllSqlsCsv, search, getStats, isStorageNearFull,

    // Ortak Havuz & Çalışma Alanı
    getActiveWorkspace, setActiveWorkspace, getMyReports, getPoolReports,
    toggleReportPool, bulkToggleReportPool, cloneReportToPersonal,
    // Aliaslar (Geriye Dönük Uyumluluk ve UI Bağlantıları)
    addManyToPool: (ids) => bulkToggleReportPool(ids, true),
    removeManyFromPool: (ids) => bulkToggleReportPool(ids, false),
    togglePublicPool: (id, makePub) => toggleReportPool(id, makePub),
    cloneToPersonal: (id) => cloneReportToPersonal(id),

    // Analytics delegasyonları
    getSqlComplexity: (sql) => window.FrpComplexity ? window.FrpComplexity.getSqlComplexity(sql) : {},
    getDependencyMap: () => window.FrpDependencies ? window.FrpDependencies.getDependencyMap(_read()) : [],
    getTableUsage: () => window.FrpTableUsage ? window.FrpTableUsage.getTableUsage(_read()) : [],
    findDuplicateQueries: () => window.FrpTableUsage ? window.FrpTableUsage.findDuplicateQueries(_read()) : [],
    getParameterUsage: () => window.FrpParamUsage ? window.FrpParamUsage.getParameterUsage(_read()) : [],
    checkPascalSyntax: (code, reportContext) => window.FrpSyntaxCheck ? window.FrpSyntaxCheck.checkPascalSyntax(code, reportContext) : { errors: [], warnings: [] },
    checkSqlStaticSyntax: (sql) => window.FrpSyntaxCheck ? window.FrpSyntaxCheck.checkSqlStaticSyntax(sql) : { errors: [], warnings: [] },
    bumpVersionFilename: (name, count) => window.FrpTags ? window.FrpTags.bumpVersionFilename(name, count) : name,

    refreshFromCloud: async function() {
      if (window.FrpCloud && typeof window.FrpCloud.loadActiveReports === 'function') {
        const cloudFiles = await window.FrpCloud.loadActiveReports();
        if (Array.isArray(cloudFiles)) {
          _memoryStore = cloudFiles;
          try { localStorage.setItem(STORE_KEY, JSON.stringify(cloudFiles)); } catch (e) {}
          syncToIndexedDB(cloudFiles);
          _rememberPersisted(cloudFiles);
          if (typeof window.refreshAll === 'function') window.refreshAll();
          return cloudFiles;
        }
      }
      return _read();
    }
  };

  window.FrpStore = FrpStore;
  try { 
    applyPreferences(); 
    startAutoBackupTimer();
  } catch (e) {}
})();
