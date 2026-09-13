function createPresenceService({ avatarStore, getLocalUsers, supabase }) {
  const activePresence = new Map();
  let avatarCache = null;

  function recordUserPresence(user, customStatus = 'online') {
    if (!user || !user.id) return;
    const status = ['online', 'busy', 'dnd', 'invisible'].includes(customStatus) ? customStatus : 'online';
    activePresence.set(String(user.id), { userId: String(user.id), lastSeen: Date.now(), customStatus: status });
  }

  function removeUserPresence(userId) {
    if (userId) activePresence.delete(String(userId));
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

  return { getAllUsersWithPresence, getUserAvatars, recordUserPresence, removeUserPresence, saveUserAvatar };
}

module.exports = { createPresenceService };
