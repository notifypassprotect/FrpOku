function createPresenceService({ avatarStore, getLocalUsers, supabase }) {
  const activePresence = new Map();
  let avatarCache = null;

  function recordUserPresence(user, customStatus = 'online') {
    if (!user || !user.id) return;
    const status = ['online', 'busy', 'dnd', 'invisible'].includes(customStatus) ? customStatus : 'online';
    activePresence.set(String(user.id), { userId: String(user.id), lastSeen: Date.now(), customStatus: status });
  }

  function getUserAvatars() {
    if (avatarCache !== null) return avatarCache;
    const avatars = avatarStore.read();
    avatarCache = avatars && typeof avatars === 'object' && !Array.isArray(avatars) ? avatars : {};
    return avatarCache;
  }

  function saveUserAvatar(userId, username, avatar) {
    const avatars = getUserAvatars();
    if (userId) avatars[String(userId)] = avatar;
    if (username) avatars[String(username).toLowerCase()] = avatar;
    avatarCache = avatars;
    avatarStore.write(avatars);
  }

  async function getAllUsersWithPresence() {
    const now = Date.now();
    const activeMap = new Map();
    for (const [id, data] of activePresence.entries()) {
      if (now - data.lastSeen <= 45000) activeMap.set(String(id), data);
      else activePresence.delete(id);
    }

    let users = [];
    if (supabase) {
      try {
        let result = await supabase.from('app_users').select('id, username, full_name, department, role, avatar, is_active, last_seen, last_login').eq('is_active', true);
        if (result.error && String(result.error.message || '').includes('avatar')) {
          result = await supabase.from('app_users').select('id, username, full_name, department, role, is_active, last_seen, last_login').eq('is_active', true);
        }
        if (result.data && result.data.length) users = result.data;
      } catch {}
    }
    if (!users.length) users = getLocalUsers().filter(user => user.is_active !== false);
    const avatars = getUserAvatars();
    return users.map(user => {
      const id = String(user.id);
      const active = activeMap.get(id);
      const rawStatus = active ? active.customStatus || 'online' : 'offline';
      const isOnline = Boolean(active) && rawStatus !== 'invisible';
      return {
        id, username: user.username || '', fullName: user.full_name || user.fullName || user.username || '',
        department: user.department || '', role: user.role || 'user',
        avatar: avatars[id] || avatars[(user.username || '').toLowerCase()] || user.avatar || (user.username ? user.username[0].toUpperCase() : 'U'),
        isOnline, status: isOnline ? rawStatus : 'offline',
        lastSeen: active ? new Date(active.lastSeen).toISOString() : user.last_seen || user.last_login || null
      };
    }).sort((a, b) => a.isOnline !== b.isOnline ? (a.isOnline ? -1 : 1) : (a.fullName || a.username).localeCompare(b.fullName || b.username, 'tr'));
  }

  // ── RAPOR KİLİT / DÜZENLEME KONTROLÜ (SOFT-LOCK / CHECK-OUT) ──
  const activeReportLocks = new Map();

  function getActiveReportLocks() {
    const now = Date.now();
    const locks = {};
    for (const [id, lock] of activeReportLocks.entries()) {
      if (now - lock.lastHeartbeat <= 45000) {
        locks[id] = lock;
      } else {
        activeReportLocks.delete(id);
      }
    }
    return locks;
  }

  function getReportLock(reportId) {
    if (!reportId) return null;
    const lock = activeReportLocks.get(String(reportId));
    if (lock && Date.now() - lock.lastHeartbeat <= 45000) {
      return lock;
    }
    if (lock) activeReportLocks.delete(String(reportId));
    return null;
  }

  function acquireReportLock(reportId, user) {
    if (!reportId || !user || !user.id) return { acquired: false, reason: 'Geçersiz parametreler' };
    const rId = String(reportId);
    const uId = String(user.id);
    const existing = getReportLock(rId);

    if (existing && existing.userId !== uId && user.role !== 'admin') {
      return { acquired: false, lock: existing };
    }

    const avatars = getUserAvatars();
    const lock = {
      reportId: rId,
      userId: uId,
      username: user.username || '',
      userFullName: user.full_name || user.fullName || user.username || '',
      userAvatar: avatars[uId] || avatars[(user.username || '').toLowerCase()] || user.avatar || (user.username ? user.username[0].toUpperCase() : 'U'),
      lockedAt: existing && existing.userId === uId ? existing.lockedAt : new Date().toISOString(),
      lastHeartbeat: Date.now()
    };
    activeReportLocks.set(rId, lock);
    return { acquired: true, lock };
  }

  function releaseReportLock(reportId, userId, isAdmin = false) {
    if (!reportId) return false;
    const rId = String(reportId);
    const lock = activeReportLocks.get(rId);
    if (lock && (lock.userId === String(userId) || isAdmin)) {
      activeReportLocks.delete(rId);
      return true;
    }
    return false;
  }

  function renewReportLock(reportId, userId) {
    if (!reportId || !userId) return false;
    const lock = activeReportLocks.get(String(reportId));
    if (lock && lock.userId === String(userId)) {
      lock.lastHeartbeat = Date.now();
      return true;
    }
    return false;
  }

  function removeUserPresence(userId) {
    if (userId) {
      const uId = String(userId);
      activePresence.delete(uId);
      for (const [rId, lock] of activeReportLocks.entries()) {
        if (lock.userId === uId) activeReportLocks.delete(rId);
      }
    }
  }

  return {
    acquireReportLock,
    getActiveReportLocks,
    getAllUsersWithPresence,
    getReportLock,
    getUserAvatars,
    recordUserPresence,
    releaseReportLock,
    removeUserPresence,
    renewReportLock,
    saveUserAvatar
  };
}

module.exports = { createPresenceService };
