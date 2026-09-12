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
    return files.filter(file => {
      if (user.role === 'admin') return true;
      return !file.userId && !file.user_id || String(file.userId || file.user_id) === String(user.id);
    });
  }

  function _reportsVisibleToSession(files) {
    if (!Array.isArray(files)) return [];
    const user = window.FrpAuth && typeof window.FrpAuth.getUser === 'function' ? window.FrpAuth.getUser() : null;
    if (!user) return [];
    if (user.role === 'admin') return files;
    return files.filter(file => {
      if (!file) return false;
      const ownerId = String(file.userId || file.user_id || file.data?.userId || file.data?.user_id || '');
      const isPub = Boolean(file.isPublic || file.is_public || file.inPool || file.in_pool || file.data?.isPublic || file.data?.is_public);
      if (isPub) return true;
      if (ownerId && ownerId === String(user.id)) return true;
      return false;
    });
  }

  let _persistedReportHashes = new Map();
  const _reportSyncChains = new Map();
  const PENDING_SYNC_KEY = 'frpoku_pending_sync';
  const _pendingSyncIds = new Set();
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (raw) JSON.parse(raw).forEach(id => _pendingSyncIds.add(String(id)));
  } catch (e) {}

  const USER_NOTES_KEY = 'frpoku_user_notes_v2';
  function _scopedStorageKey(baseKey) {
    const user = window.FrpAuth && typeof window.FrpAuth.getUser === 'function' ? window.FrpAuth.getUser() : null;
    return `${baseKey}:${encodeURIComponent(String(user?.id || 'anonymous'))}`;
  }
  function _getUserNotesMap() {
    try {
      const raw = localStorage.getItem(_scopedStorageKey(USER_NOTES_KEY));
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function _saveUserNote(id, note) {
    try {
      const map = _getUserNotesMap();
      const strId = String(id);
      if (note && String(note).trim()) {
        map[strId] = { note: String(note).trim(), updated_at: new Date().toISOString() };
      } else {
        delete map[strId];
      }
      localStorage.setItem(_scopedStorageKey(USER_NOTES_KEY), JSON.stringify(map));
    } catch {}
  }

  const USER_PIN_OVERRIDES_KEY = 'frpoku_user_pin_overrides_v2';
  function _getUserPinOverrides() {
    try {
      const raw = localStorage.getItem(_scopedStorageKey(USER_PIN_OVERRIDES_KEY));
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function _saveUserPinOverride(id, isPinned) {
    try {
      const map = _getUserPinOverrides();
      map[String(id)] = Boolean(isPinned);
      localStorage.setItem(_scopedStorageKey(USER_PIN_OVERRIDES_KEY), JSON.stringify(map));
    } catch {}
  }

  function _savePendingSyncIds() {
    try {
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify([..._pendingSyncIds]));
    } catch (e) {}
  }

  function _flushPendingSync() {
    if (_pendingSyncIds.size === 0) return;
    [..._pendingSyncIds].forEach(_queueReportSync);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', _flushPendingSync);
  }

  function _reportHash(report) {
    if (!report) return '';
    return `${report.id}:${report.version || 0}:${report.updated_at || report.loadedAt || ''}:${Boolean(report.isPublic || report.is_public || report.inPool || report.in_pool)}:${Boolean(report.isFavorite || report.is_favorite)}:${Boolean(report.isPinned || report.is_pinned)}:${Boolean(report.isDeleted || report.is_deleted)}:${report.userNote || report.user_note || ''}:${Array.isArray(report.tags) ? report.tags.join(',') : ''}:${report.category || ''}:${report.name || ''}`;
  }

  function _rememberPersisted(files) {
    _persistedReportHashes = new Map((files || []).map(report => [String(report.id), _reportHash(report)]));
  }

  function _persistLocal(files) {
    _memoryStore = files;
    syncToIndexedDB(files);
    try {
      const json = JSON.stringify(files);
      if (json.length < 2500000) {
        localStorage.setItem(STORE_KEY, json);
      }
    } catch (e) {
      // localStorage kotası aşıldıysa IndexedDB yeterlidir
    }
    return true;
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
      if (!latest) {
        _pendingSyncIds.delete(key);
        _savePendingSyncIds();
        return;
      }
      try {
        const saved = await window.FrpCloud.saveReport(latest);
        if (!saved) throw new Error('Bulut kaydı doğrulanamadı.');
        _applySavedVersion(key, saved.version);
        _pendingSyncIds.delete(key);
        _savePendingSyncIds();
      } catch (error) {
        console.warn('Rapor senkronizasyonu başarısız:', error);
        if (error?.status === 409) {
          // Çakışma: Sunucudaki sürüm yerelden daha yeni. Stale raporu kuyruktan kaldır, döngüyü sonlandır:
          _pendingSyncIds.delete(key);
          _savePendingSyncIds();
          if (error.currentVersion) {
            _applySavedVersion(key, error.currentVersion);
          }
          if (window.FrpCloud && typeof window.FrpCloud.getReport === 'function') {
            window.FrpCloud.getReport(key).then(fresh => {
              if (fresh) {
                const idx = _memoryStore.findIndex(r => String(r.id) === key);
                if (idx >= 0) {
                  _memoryStore[idx] = fresh;
                  _persistLocal(_memoryStore);
                  _persistedReportHashes.set(key, _reportHash(fresh));
                }
              }
            }).catch(() => {});
          }
        } else {
          // Ağ hatası veya geçici kesinti durumunda kuyrukta koru
          _pendingSyncIds.add(key);
          _savePendingSyncIds();
          _notifySyncIssue('Bulut kaydı başarısız oldu; değişiklik yerel kuyrukta korunuyor.');
        }
        const eventName = error?.status === 409 ? 'frp:sync-conflict' : 'frp:sync-error';
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

      // Bulut verilerini (Aktif raporlar, çöp kutusu, kategoriler, snippets, ayarlar) paralel çek:
      if (window.FrpCloud) {
        try {
          const [activeSettled, trashSettled, catSettled, snipSettled, settingsSettled] = await Promise.allSettled([
            typeof window.FrpCloud.loadActiveReports === 'function' ? window.FrpCloud.loadActiveReports() : Promise.resolve(null),
            typeof window.FrpCloud.loadTrashReports === 'function' ? window.FrpCloud.loadTrashReports() : Promise.resolve(null),
            typeof window.FrpCloud.loadCategories === 'function' ? window.FrpCloud.loadCategories() : Promise.resolve(null),
            typeof window.FrpCloud.loadSnippets === 'function' ? window.FrpCloud.loadSnippets() : Promise.resolve(null),
            typeof window.FrpCloud.loadSettings === 'function' ? window.FrpCloud.loadSettings() : Promise.resolve(null)
          ]);

          // 1. Aktif Raporları İşle
          if (activeSettled.status === 'fulfilled') {
            const cloudFiles = activeSettled.value;
            if (Array.isArray(cloudFiles)) {
              const localMap = new Map((_read() || []).map(f => [String(f.id), f]));
              const userNotes = _getUserNotesMap();
              const pinOverrides = _getUserPinOverrides();

              loadedFiles = cloudFiles.map(cf => {
                const cfId = String(cf.id);
                const local = localMap.get(cfId);
                let item = cf;

                if (_pendingSyncIds.has(cfId) && local) {
                  if ((Number(local?.version) || 0) > (Number(cf?.version) || 0)) {
                    item = local;
                  } else {
                    _pendingSyncIds.delete(cfId);
                    _savePendingSyncIds();
                  }
                }

                // Kullanıcı notunun buluttaki boş veriyle ezilmesini önle
                if (userNotes[cfId]?.note && (!item.userNote || !item.userNote.trim())) {
                  item.userNote = userNotes[cfId].note;
                  item.user_note = userNotes[cfId].note;
                } else if (local?.userNote && local.userNote.trim() && (!item.userNote || !item.userNote.trim())) {
                  item.userNote = local.userNote;
                  item.user_note = local.userNote;
                  _saveUserNote(cfId, local.userNote);
                }

                // Kullanıcının sabitleme tercihini koru
                if (pinOverrides[cfId] !== undefined) {
                  item.isPinned = Boolean(pinOverrides[cfId]);
                  item.is_pinned = Boolean(pinOverrides[cfId]);
                }

                return item;
              });

              localMap.forEach((localFile, lId) => {
                if (_pendingSyncIds.has(lId) && !loadedFiles.some(f => String(f.id) === lId)) {
                  loadedFiles.push(localFile);
                }
              });
              isCloudLoaded = true;
              window.FRP_CLOUD_STATUS = { ok: true, kind: 'success', count: loadedFiles.length };
              setTimeout(_flushPendingSync, 1000);
            } else if (typeof window.FrpCloud.getLastLoadStatus === 'function') {
              window.FRP_CLOUD_STATUS = window.FrpCloud.getLastLoadStatus();
              window.dispatchEvent(new CustomEvent('frp:cloud-load-error', { detail: window.FRP_CLOUD_STATUS }));
            }
          } else {
            console.warn('Supabase load error:', activeSettled.reason);
          }

          // 2. Çöp Kutusunu İşle
          if (trashSettled.status === 'fulfilled' && Array.isArray(trashSettled.value)) {
            _writeTrash(trashSettled.value);
          }

          // 3. Kategoriler & Snippets & Ayarları İşle
          if (catSettled.status === 'fulfilled' && Array.isArray(catSettled.value)) {
            localStorage.setItem(CATEGORIES_KEY, JSON.stringify(catSettled.value));
          }
          if (snipSettled.status === 'fulfilled' && Array.isArray(snipSettled.value)) {
            localStorage.setItem(SNIPPET_KEY, JSON.stringify(snipSettled.value));
          }
          if (settingsSettled.status === 'fulfilled' && settingsSettled.value) {
            const cloudSettings = settingsSettled.value;
            const cloudTags = cloudSettings?.custom_tags ?? cloudSettings?.customTags;
            if (Array.isArray(cloudTags)) localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(cloudTags));
          }
        } catch (cloudErr) {
          console.warn('Bulut senkronizasyonu hatası:', cloudErr);
        }
      }

      // 4. Çevrimdışı / Yerel Yedek
      if (!isCloudLoaded) {
        const ls = _read();
        if (Array.isArray(ls) && ls.length > 0) {
          loadedFiles = _reportsVisibleToSession(ls);
        } else {
          const idbFiles = await restoreFromIndexedDB();
          if (Array.isArray(idbFiles) && idbFiles.length > 0) loadedFiles = _reportsVisibleToSession(idbFiles);
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
        const delay = Math.max(0, 400 - elapsed);
        setTimeout(() => {
          splash.classList.add('hidden');
          splash.style.pointerEvents = 'none';
          splash.style.opacity = '0';
          splash.style.visibility = 'hidden';
          setTimeout(() => { if (splash && splash.parentNode) splash.parentNode.removeChild(splash); }, 350);
        }, delay);
      }
    }
  })();
  window.FrpStoreReady = bootstrapReady;

  // Garanti Fail-Safe: Ağ veya sunucu gecikse dahi splash ekranı 1.2 saniyeden fazla kalamaz
  setTimeout(() => {
    const splash = document.getElementById('splashScreen');
    if (splash) {
      splash.style.pointerEvents = 'none';
      splash.style.opacity = '0';
      splash.style.visibility = 'hidden';
      setTimeout(() => { if (splash && splash.parentNode) splash.parentNode.removeChild(splash); }, 300);
    }
  }, 1200);

  // ── 4. Rapor CRUD Metotları ──────────────────────────────────
  function getAll() {
    const list = _reportsVisibleToSession(_read());
    if (window.FrpTags && typeof window.FrpTags.isBarcodeReport === 'function') {
      list.forEach(file => {
        if (Array.isArray(file.tags) && file.tags.includes('Barkod')) {
          if (!window.FrpTags.isBarcodeReport(file, file.name)) {
            file.tags = file.tags.filter(t => t !== 'Barkod');
          }
        }
      });
    }
    return list.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.loadedAt || 0) - new Date(a.loadedAt || 0);
    });
  }

  function getById(id) {
    if (id == null) return null;
    const strId = String(id);
    let decId = strId;
    try { decId = decodeURIComponent(strId); } catch {}

    const list = getAll();
    const item = list.find(r => r.id === id || String(r.id) === strId || String(r.id) === decId);
    if (!item) return null;
    item.queries  = Array.isArray(item.queries)  ? item.queries  : [];
    item.datasets = Array.isArray(item.datasets) ? item.datasets : [];
    item.tags     = Array.isArray(item.tags)     ? item.tags     : [];
    item.tree     = Array.isArray(item.tree)     ? item.tree     : [];
    item.meta     = item.meta || {};
    return item;
  }

  async function ensureFullReport(id) {
    if (!id) return null;
    const strId = String(id);
    let decId = strId;
    try { decId = decodeURIComponent(strId); } catch {}

    const files = _read();
    let index = files.findIndex(r => r.id === id || String(r.id) === strId || String(r.id) === decId);
    let item = index >= 0 ? files[index] : null;

    const hasFullDetails = item && (item.rawXml || (Array.isArray(item.tree) && item.tree.length > 0) || (Array.isArray(item.pages) && item.pages.length > 0));
    if (hasFullDetails) return item;

    if (window.FrpCloud && typeof window.FrpCloud.getReport === 'function') {
      try {
        const full = await window.FrpCloud.getReport(id);
        if (full) {
          if (index >= 0) {
            files[index] = { ...files[index], ...full };
            _memoryStore = files;
            _persistLocal(files);
            return files[index];
          } else {
            files.push(full);
            _memoryStore = files;
            _persistLocal(files);
            return full;
          }
        }
      } catch (err) {
        console.warn('ensureFullReport yükleme hatası:', err);
      }
    }
    return item;
  }

  function add(parsedData, fileName, fileSize) {
    const files = _read();
    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    const userId = curUser ? curUser.id : 'public';
    const ownerName = curUser ? (curUser.full_name || curUser.username) : 'Anonim';
    const ownerUsername = curUser ? curUser.username : '';
    const ownerDepartment = curUser ? (curUser.department || 'Bilgi İşlem') : '';
    const existingIdx = files.findIndex(f => f.name === fileName && String(f.userId || f.user_id) === String(userId));
    const autoTags = window.FrpTags ? window.FrpTags.generateAutoTags(parsedData, fileName) : [];
    const existingTags = existingIdx >= 0 ? (files[existingIdx].tags || []) : [];
    const mergedTags = [...new Set([...existingTags, ...autoTags])];

    const tableNames = window.getReportTables ? window.getReportTables(parsedData) : (Array.isArray(parsedData.tableNames) ? parsedData.tableNames : []);
    const queryNames = Array.isArray(parsedData.queries) ? parsedData.queries.map(q => q.name).filter(Boolean) : [];
    const isFav = existingIdx >= 0 ? Boolean(files[existingIdx].isFavorite || files[existingIdx].is_favorite) : false;
    const isPin = existingIdx >= 0 ? Boolean(files[existingIdx].isPinned || files[existingIdx].is_pinned) : false;
    const uNote = existingIdx >= 0 ? (files[existingIdx].userNote || files[existingIdx].user_note || '') : '';

    const fileRecord = {
      id:              existingIdx >= 0 ? files[existingIdx].id : _uuid(),
      name:            fileName,
      userId:          existingIdx >= 0 ? (files[existingIdx].userId || userId) : userId,
      user_id:         existingIdx >= 0 ? (files[existingIdx].userId || userId) : userId,
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
      userNote:        uNote,
      user_note:       uNote,
      isFavorite:      isFav,
      is_favorite:     isFav,
      isPinned:        isPin,
      is_pinned:       isPin,
      isPublic:        existingIdx >= 0 ? (files[existingIdx].isPublic || false) : false,
      ownerName:       existingIdx >= 0 ? (files[existingIdx].ownerName || ownerName) : ownerName,
      ownerUsername:   existingIdx >= 0 ? (files[existingIdx].ownerUsername || ownerUsername) : ownerUsername,
      ownerDepartment: existingIdx >= 0 ? (files[existingIdx].ownerDepartment || ownerDepartment) : ownerDepartment,
      sharedAt:        existingIdx >= 0 ? (files[existingIdx].sharedAt || null) : null,
      version:         existingIdx >= 0 ? (Number(files[existingIdx].version) || 1) : 0,
      tags:            mergedTags,
      tableNames,
      queryNames
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
      const existingIdx = files.findIndex(f => f.name === fileName && String(f.userId || f.user_id) === String(userId));
      const autoTags = window.FrpTags ? window.FrpTags.generateAutoTags(parsedData, fileName) : [];
      const existingTags = existingIdx >= 0 ? (files[existingIdx].tags || []) : [];
      const mergedTags = [...new Set([...existingTags, ...autoTags])];

      const tableNames = window.getReportTables ? window.getReportTables(parsedData) : (Array.isArray(parsedData.tableNames) ? parsedData.tableNames : []);
      const queryNames = Array.isArray(parsedData.queries) ? parsedData.queries.map(q => q.name).filter(Boolean) : [];
      const isFav = existingIdx >= 0 ? Boolean(files[existingIdx].isFavorite || files[existingIdx].is_favorite) : false;
      const isPin = existingIdx >= 0 ? Boolean(files[existingIdx].isPinned || files[existingIdx].is_pinned) : false;
      const uNote = existingIdx >= 0 ? (files[existingIdx].userNote || files[existingIdx].user_note || '') : '';

      const fileRecord = {
        id:              existingIdx >= 0 ? files[existingIdx].id : _uuid(),
        name:            fileName,
        userId:          existingIdx >= 0 ? (files[existingIdx].userId || userId) : userId,
        user_id:         existingIdx >= 0 ? (files[existingIdx].userId || userId) : userId,
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
        userNote:        uNote,
        user_note:       uNote,
        isFavorite:      isFav,
        is_favorite:     isFav,
        isPinned:        isPin,
        is_pinned:       isPin,
        isPublic:        existingIdx >= 0 ? (files[existingIdx].isPublic || false) : false,
        ownerName:       existingIdx >= 0 ? (files[existingIdx].ownerName || ownerName) : ownerName,
        ownerUsername:   existingIdx >= 0 ? (files[existingIdx].ownerUsername || ownerUsername) : ownerUsername,
        ownerDepartment: existingIdx >= 0 ? (files[existingIdx].ownerDepartment || ownerDepartment) : ownerDepartment,
        sharedAt:        existingIdx >= 0 ? (files[existingIdx].sharedAt || null) : null,
        version:         existingIdx >= 0 ? (Number(files[existingIdx].version) || 1) : 0,
        tags:            mergedTags,
        tableNames,
        queryNames
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

  async function deleteOne(id) {
    const originalFiles = [..._read()];
    const file = originalFiles.find(f => f.id === id);
    const files = originalFiles.filter(f => f.id !== id);
    _write(files, { syncCloud: false });
    _audit('REPORT_DELETE', file ? file.name : id, 'Rapor kalıcı olarak silindi.');

    if (window.FrpCloud && typeof window.FrpCloud.purgeReport === 'function') {
      try {
        const ok = await window.FrpCloud.purgeReport(id);
        if (!ok) throw new Error('Sunucu silme işlemini reddetti.');
      } catch (err) {
        _write(originalFiles, { syncCloud: false });
        _notifySyncIssue('Rapor silinemedi: Sunucu işlemi reddetti.');
        throw err;
      }
    }
  }

  async function deleteMany(ids) {
    const idSet = new Set(ids);
    const originalFiles = [..._read()];
    const files = originalFiles.filter(f => !idSet.has(f.id));
    _write(files, { syncCloud: false });
    _audit('REPORT_BULK_DELETE', `${ids.length} Rapor`, 'Seçili raporlar kalıcı olarak silindi.');

    if (window.FrpCloud && typeof window.FrpCloud.purgeManyReports === 'function') {
      try {
        const ok = await window.FrpCloud.purgeManyReports(ids);
        if (!ok) throw new Error('Sunucu toplu silme işlemini reddetti.');
      } catch (err) {
        _write(originalFiles, { syncCloud: false });
        _notifySyncIssue('Seçili raporlar silinemedi: Sunucu işlemi reddetti.');
        throw err;
      }
    }
  }

  async function deleteAll() {
    const files = _read();
    const owned = _reportsOwnedBySession(files);
    if (window.FrpCloud && typeof window.FrpCloud.purgeManyReports === 'function' && owned.length > 0) {
      await window.FrpCloud.purgeManyReports(owned.map(r => r.id)).catch(() => {});
    }
    _write([], { syncCloud: false });
    syncToIndexedDB([]);
    _audit('REPORT_CLEAR_ALL', 'Tüm Raporlar', 'Tüm aktif raporlar temizlendi.');
  }

  async function resetAllUserData() {
    const files = _read();
    const owned = _reportsOwnedBySession(files);
    if (window.FrpCloud) {
      if (typeof window.FrpCloud.purgeManyReports === 'function' && owned.length > 0) {
        await window.FrpCloud.purgeManyReports(owned.map(r => r.id)).catch(() => {});
      }
      if (typeof window.FrpCloud.emptyTrash === 'function') {
        await window.FrpCloud.emptyTrash().catch(() => {});
      }
    }
    _write([], { syncCloud: false });
    _writeTrash([]);
    syncToIndexedDB([]);
    syncTrashToIndexedDB([]);
    try {
      localStorage.removeItem(CATEGORIES_KEY);
      localStorage.removeItem(CUSTOM_TAGS_KEY);
      localStorage.removeItem(SNIPPET_KEY);
      localStorage.removeItem(RECENT_KEY);
      localStorage.removeItem(PENDING_SYNC_KEY);
    } catch (e) {}
    _audit('DATA_RESET', 'Tüm Veritabanı', 'Kullanıcı onayı ile tüm raporlar, çöp kutusu ve ayarlar sıfırlandı.');
  }

  function clearSessionCache() {
    _memoryStore = [];
    _trashStore = [];
    _persistedReportHashes.clear();
    _pendingSyncIds.clear();
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem(TRASH_KEY);
      localStorage.removeItem(PENDING_SYNC_KEY);
    } catch (e) {}
    syncToIndexedDB([]);
    syncTrashToIndexedDB([]);
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
    return list.filter(t => {
      const uId = t.userId || t.user_id;
      return !uId || uId === 'public' || String(uId) === String(curUser.id) || curUser.role === 'admin';
    });
  }

  async function moveToTrash(id) {
    const rawId = String(id || '');
    let decId = rawId;
    try { decId = decodeURIComponent(rawId); } catch {}

    const files = _read();
    const idx = files.findIndex(f => f.id === id || String(f.id) === rawId || String(f.id) === decId);
    if (idx < 0) return false;

    const originalFiles = [...files];
    const originalTrash = [..._readTrash()];

    const fileToTrash = { ...files[idx] };
    const matchedId = fileToTrash.id;
    fileToTrash.deletedAt = new Date().toISOString();
    fileToTrash.isDeleted = true;
    fileToTrash.is_deleted = true;

    files.splice(idx, 1);
    _write(files, { syncCloud: false });

    const trash = originalTrash.filter(t => t.id !== matchedId && t.id !== rawId && t.id !== decId);
    trash.unshift(fileToTrash);
    _writeTrash(trash);

    _audit('TRASH_MOVE', fileToTrash.name || matchedId, 'Rapor çöp kutusuna taşındı.');

    if (window.FrpCloud && typeof window.FrpCloud.moveToTrash === 'function') {
      try {
        const saved = await window.FrpCloud.moveToTrash(matchedId, fileToTrash);
        if (!saved) throw new Error('Sunucu çöp kutusuna taşıma işlemini reddetti.');
        if (saved?.version) {
          fileToTrash.version = saved.version;
          _writeTrash(trash);
        }
      } catch (err) {
        _write(originalFiles, { syncCloud: false });
        _writeTrash(originalTrash);
        _notifySyncIssue('Rapor çöp kutusuna taşınamadı: Sunucu hatası oluştu.');
        throw err;
      }
    }
    return true;
  }

  async function moveManyToTrash(ids) {
    const idSet = new Set((ids || []).map(i => String(i)));
    (ids || []).forEach(i => {
      try { idSet.add(decodeURIComponent(String(i))); } catch {}
    });

    const files = _read();
    const originalFiles = [...files];
    const originalTrash = [..._readTrash()];

    const toTrash = files.filter(f => idSet.has(String(f.id))).map(f => ({ ...f }));
    if (toTrash.length === 0) return false;
    const remaining = files.filter(f => !idSet.has(String(f.id)));

    const now = new Date().toISOString();
    let trash = [...originalTrash];
    toTrash.forEach(f => {
      f.deletedAt = now;
      f.isDeleted = true;
      f.is_deleted = true;
      trash = trash.filter(t => t.id !== f.id);
      trash.unshift(f);
    });

    _write(remaining, { syncCloud: false });
    _writeTrash(trash);

    _audit('TRASH_BULK_MOVE', `${toTrash.length} Rapor`, 'Seçili raporlar çöp kutusuna taşındı.');

    if (window.FrpCloud && typeof window.FrpCloud.moveToTrash === 'function') {
      try {
        const savedReports = await Promise.all(toTrash.map(report => window.FrpCloud.moveToTrash(report.id, report)));
        if (!savedReports || savedReports.some(s => !s)) throw new Error('Sunucu toplu çöp kutusuna taşıma işlemini reddetti.');
        savedReports.forEach((saved, index) => { if (saved?.version) toTrash[index].version = saved.version; });
        _writeTrash(trash);
      } catch (err) {
        _write(originalFiles, { syncCloud: false });
        _writeTrash(originalTrash);
        _notifySyncIssue('Seçili raporlar çöp kutusuna taşınamadı: Sunucu hatası oluştu.');
        throw err;
      }
    }
    return true;
  }

  async function restoreFromTrash(id) {
    const rawId = String(id || '');
    let decId = rawId;
    try { decId = decodeURIComponent(rawId); } catch {}

    let trash = _readTrash();
    const idx = trash.findIndex(t => t.id === id || String(t.id) === rawId || String(t.id) === decId);
    if (idx < 0) return false;

    const originalTrash = [...trash];
    const originalFiles = [..._read()];

    const restoredFile = { ...trash[idx] };
    const matchedId = restoredFile.id;
    delete restoredFile.deletedAt;
    delete restoredFile.deleted_at;
    restoredFile.isDeleted = false;
    restoredFile.is_deleted = false;

    trash.splice(idx, 1);
    _writeTrash(trash);

    const files = originalFiles.filter(item => item.id !== matchedId && item.id !== rawId && item.id !== decId);
    files.unshift(restoredFile);
    _write(files, { syncCloud: false });

    _audit('TRASH_RESTORE', restoredFile.name || matchedId, 'Rapor çöp kutusundan geri yüklendi.');

    if (window.FrpCloud && typeof window.FrpCloud.restoreFromTrash === 'function') {
      try {
        const saved = await window.FrpCloud.restoreFromTrash(matchedId, restoredFile);
        if (!saved) throw new Error('Sunucu geri yükleme işlemini reddetti.');
        if (saved?.version) {
          restoredFile.version = saved.version;
          _write(files, { syncCloud: false });
        }
      } catch (err) {
        _writeTrash(originalTrash);
        _write(originalFiles, { syncCloud: false });
        _notifySyncIssue('Rapor geri yüklenemedi: Sunucu işlemi reddetti.');
        throw err;
      }
    } else if (window.FrpCloud && typeof window.FrpCloud.saveReport === 'function') {
      try {
        const saved = await window.FrpCloud.saveReport(restoredFile);
        if (!saved) throw new Error('Sunucu geri yükleme işlemini reddetti.');
        if (saved?.version) {
          restoredFile.version = saved.version;
          _applySavedVersion(matchedId, saved.version);
        }
      } catch (err) {
        _writeTrash(originalTrash);
        _write(originalFiles, { syncCloud: false });
        _notifySyncIssue('Rapor geri yüklenemedi: Sunucu işlemi reddetti.');
        throw err;
      }
    }
    return true;
  }

  async function restoreManyFromTrash(ids) {
    const idSet = new Set((ids || []).map(i => String(i)));
    (ids || []).forEach(i => {
      try { idSet.add(decodeURIComponent(String(i))); } catch {}
    });

    let trash = _readTrash();
    const originalTrash = [...trash];
    const originalFiles = [..._read()];

    const toRestore = trash.filter(t => idSet.has(String(t.id))).map(f => ({ ...f }));
    if (toRestore.length === 0) return false;
    trash = trash.filter(t => !idSet.has(String(t.id)));
    _writeTrash(trash);

    let files = [...originalFiles];
    toRestore.forEach(f => {
      delete f.deletedAt;
      delete f.deleted_at;
      f.isDeleted = false;
      f.is_deleted = false;
      files = files.filter(item => item.id !== f.id);
      files.unshift(f);
    });
    _write(files, { syncCloud: false });

    _audit('TRASH_BULK_RESTORE', `${toRestore.length} Rapor`, 'Seçili raporlar çöp kutusundan geri yüklendi.');

    if (window.FrpCloud && typeof window.FrpCloud.restoreFromTrash === 'function') {
      try {
        const results = await Promise.all(toRestore.map(report => window.FrpCloud.restoreFromTrash(report.id, report)));
        if (!results || results.some(r => !r)) throw new Error('Sunucu toplu geri yükleme işlemini reddetti.');
      } catch (err) {
        _writeTrash(originalTrash);
        _write(originalFiles, { syncCloud: false });
        _notifySyncIssue('Seçili raporlar geri yüklenemedi: Sunucu işlemi reddetti.');
        throw err;
      }
    } else if (window.FrpCloud && typeof window.FrpCloud.saveReport === 'function') {
      try {
        const results = await Promise.all(toRestore.map(report => window.FrpCloud.saveReport(report)));
        if (!results || results.some(r => !r)) throw new Error('Sunucu toplu geri yükleme işlemini reddetti.');
      } catch (err) {
        _writeTrash(originalTrash);
        _write(originalFiles, { syncCloud: false });
        _notifySyncIssue('Seçili raporlar geri yüklenemedi: Sunucu işlemi reddetti.');
        throw err;
      }
    }
    return true;
  }

  async function purgeFromTrash(id) {
    let trash = _readTrash();
    const originalTrash = [...trash];
    const item = trash.find(t => t.id === id);
    trash = trash.filter(t => t.id !== id);
    _writeTrash(trash);

    _audit('TRASH_PURGE', item ? item.name : id, 'Rapor çöp kutusundan kalıcı olarak silindi.');

    if (window.FrpCloud && typeof window.FrpCloud.purgeReport === 'function') {
      try {
        const ok = await window.FrpCloud.purgeReport(id);
        if (!ok) throw new Error('Sunucu silme işlemini reddetti.');
      } catch (err) {
        _writeTrash(originalTrash);
        _notifySyncIssue('Rapor silinemedi: Sunucu işlemi reddetti.');
        throw err;
      }
    }
    return true;
  }

  async function purgeManyFromTrash(ids) {
    const idSet = new Set(ids);
    const originalTrash = [..._readTrash()];
    let trash = originalTrash.filter(t => !idSet.has(t.id));
    _writeTrash(trash);

    _audit('TRASH_BULK_PURGE', `${ids.length} Rapor`, 'Seçili raporlar çöpten kalıcı olarak silindi.');

    if (window.FrpCloud && typeof window.FrpCloud.purgeManyReports === 'function') {
      try {
        const ok = await window.FrpCloud.purgeManyReports(ids);
        if (!ok) throw new Error('Sunucu toplu silme işlemini reddetti.');
      } catch (err) {
        _writeTrash(originalTrash);
        _notifySyncIssue('Seçili raporlar silinemedi: Sunucu işlemi reddetti.');
        throw err;
      }
    }
    return true;
  }

  async function emptyTrash() {
    const originalTrash = [..._readTrash()];
    _writeTrash([]);
    _audit('TRASH_EMPTY', 'Çöp Kutusu', 'Çöp kutusu tamamen boşaltıldı.');

    if (window.FrpCloud && typeof window.FrpCloud.emptyTrash === 'function') {
      try {
        const ok = await window.FrpCloud.emptyTrash();
        if (!ok) throw new Error('Sunucu çöp kutusu boşaltma işlemini reddetti.');
      } catch (err) {
        _writeTrash(originalTrash);
        _notifySyncIssue('Çöp kutusu boşaltılamadı: Sunucu işlemi reddetti.');
        throw err;
      }
    }
    return true;
  }

  // ── 6. Not, Meta, Kod Güncelleme ────────────────────────────
  function updateNote(id, note) {
    const files = _read();
    const strId = String(id);
    const idx = files.findIndex(f => String(f.id) === strId);
    const cleanNote = String(note || '').trim();
    _saveUserNote(strId, cleanNote);
    if (idx >= 0) {
      files[idx].userNote = cleanNote;
      files[idx].user_note = cleanNote;
      files[idx].updated_at = new Date().toISOString();
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
      files[idx].is_favorite = files[idx].isFavorite;
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
        f.is_favorite = !!isFav;
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
        f.is_favorite = f.isFavorite;
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
    const strId = String(id);
    const idx = files.findIndex(f => String(f.id) === strId);
    if (idx >= 0) {
      const nextPin = !Boolean(files[idx].isPinned || files[idx].is_pinned);
      files[idx].isPinned = nextPin;
      files[idx].is_pinned = nextPin;
      files[idx].updated_at = new Date().toISOString();
      _saveUserPinOverride(strId, nextPin);
      _write(files);
      _audit('REPORT_PIN', files[idx].name || id, nextPin ? 'Rapor üste sabitlendi.' : 'Rapor sabitlemesi kaldırıldı.');
      return nextPin;
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
    files[idx].inPool = !!makePublic;
    files[idx].in_pool = !!makePublic;

    if (makePublic) {
      files[idx].sharedAt = nowIso;
      if (curUser) {
        files[idx].ownerName = curUser.full_name || curUser.username;
        files[idx].ownerUsername = curUser.username;
        files[idx].ownerDepartment = curUser.department || 'Bilgi İşlem';
      }
    }

    _write(files);

    const ownerInfo = curUser ? {
      fullName: curUser.full_name || curUser.username,
      username: curUser.username,
      department: curUser.department || 'Bilgi İşlem'
    } : null;

    if (window.FrpCloud && typeof window.FrpCloud.togglePoolStatus === 'function') {
      window.FrpCloud.togglePoolStatus(id, makePublic, ownerInfo).catch(e => console.warn('togglePoolStatus hatası:', e));
    }

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
        f.inPool = !!makePublic;
        f.in_pool = !!makePublic;
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

      const ownerInfo = curUser ? {
        fullName: curUser.full_name || curUser.username,
        username: curUser.username,
        department: curUser.department || 'Bilgi İşlem'
      } : null;

      if (window.FrpCloud && typeof window.FrpCloud.bulkTogglePoolStatus === 'function') {
        window.FrpCloud.bulkTogglePoolStatus(ids, makePublic, ownerInfo).catch(e => console.warn('bulkTogglePoolStatus hatası:', e));
      }

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
        autoTagging: true,
        sqlFormatMode: 'expanded',
        sqlKeywordsUpper: true,
        showSqlRiskBadge: true,
        csvDelimiter: ';',
        toastDuration: 3500,
        defaultTab: 'personal',
        quickSearchKey: true
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
        autoTagging: true,
        sqlFormatMode: 'expanded',
        sqlKeywordsUpper: true,
        showSqlRiskBadge: true,
        csvDelimiter: ';',
        toastDuration: 3500,
        defaultTab: 'personal',
        quickSearchKey: true
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
    if (document.body) document.body.setAttribute('data-density', density);
    if (density === 'minimal' || density === 'compact-ultra' || density === 'ultra') {
      root.style.setProperty('--row-height', '24px');
      root.style.setProperty('--cell-padding', '2px 6px');
    } else if (density === 'compact') {
      root.style.setProperty('--row-height', '30px');
      root.style.setProperty('--cell-padding', '5px 8px');
    } else if (density === 'comfortable' || density === 'spacious') {
      root.style.setProperty('--row-height', '48px');
      root.style.setProperty('--cell-padding', '12px 14px');
    } else {
      root.style.setProperty('--row-height', '38px');
      root.style.setProperty('--cell-padding', '8px 10px');
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
    getAll, getById, ensureFullReport, add, addMany, deleteOne, deleteMany, deleteAll, resetAllUserData, clearSessionCache,
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
    getDependencyMap: (files) => window.FrpDependencies ? window.FrpDependencies.getDependencyMap(files || getAll()) : [],
    getTableUsage: (files) => window.FrpTableUsage ? window.FrpTableUsage.getTableUsage(files || getAll()) : [],
    findDuplicateQueries: (files) => window.FrpTableUsage ? window.FrpTableUsage.findDuplicateQueries(files || getAll()) : [],
    getParameterUsage: (files) => window.FrpParamUsage ? window.FrpParamUsage.getParameterUsage(files || getAll()) : [],
    checkPascalSyntax: (code, reportContext) => window.FrpSyntaxCheck ? window.FrpSyntaxCheck.checkPascalSyntax(code, reportContext) : { errors: [], warnings: [] },
    checkSqlStaticSyntax: (sql) => window.FrpSyntaxCheck ? window.FrpSyntaxCheck.checkSqlStaticSyntax(sql) : { errors: [], warnings: [] },
    bumpVersionFilename: (name, count) => window.FrpTags ? window.FrpTags.bumpVersionFilename(name, count) : name,

    refreshFromCloud: async function() {
      if (window.FrpCloud && typeof window.FrpCloud.loadActiveReports === 'function') {
        const cloudFiles = await window.FrpCloud.loadActiveReports();
        if (Array.isArray(cloudFiles)) {
          const visible = _reportsVisibleToSession(cloudFiles);
          _persistLocal(visible);
          _rememberPersisted(visible);
          if (typeof window.refreshAll === 'function') window.refreshAll();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('frp:cloud-synced', { detail: { count: visible.length } }));
          }
          return visible;
        }
      }
      return getAll();
    }
  };

  let _lastBackgroundSyncTime = Date.now();
  function startBackgroundSync() {
    setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() - _lastBackgroundSyncTime < 30000) return;
      _lastBackgroundSyncTime = Date.now();
      try {
        await FrpStore.refreshFromCloud();
      } catch (e) {}
    }, 45000);

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', async () => {
        if (Date.now() - _lastBackgroundSyncTime < 15000) return;
        _lastBackgroundSyncTime = Date.now();
        try {
          await FrpStore.refreshFromCloud();
        } catch (e) {}
      });

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', async () => {
          if (!document.hidden && Date.now() - _lastBackgroundSyncTime >= 15000) {
            _lastBackgroundSyncTime = Date.now();
            try {
              await FrpStore.refreshFromCloud();
            } catch (e) {}
          }
        });
      }
    }

    try {
      const sb = window.FrpCloud && typeof window.FrpCloud.getClient === 'function' ? window.FrpCloud.getClient() : null;
      if (sb && typeof sb.channel === 'function') {
        const channel = sb.channel('public:reports_changes');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
          if (Date.now() - _lastBackgroundSyncTime >= 3000) {
            _lastBackgroundSyncTime = Date.now();
            FrpStore.refreshFromCloud().catch(() => {});
          }
        }).subscribe();
      }
    } catch (e) {}
  }

  window.FrpStore = FrpStore;
  try { 
    applyPreferences(); 
    startAutoBackupTimer();
    startBackgroundSync();
  } catch (e) {}
})();
