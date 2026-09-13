function createUserService({ env, hashPassword, safeLogStr, supabase, usersStore }) {
  function getLocalUsers() {
    const users = usersStore.read();
    return Array.isArray(users) ? users : [];
  }

  function saveLocalUsers(users) {
    return usersStore.write(users);
  }

  async function loadUserById(userId) {
    if (!userId) return null;
    if (supabase) {
      const { data, error } = await supabase.from('app_users').select('*').eq('id', String(userId)).limit(1);
      if (error) throw error;
      return data && data[0] ? data[0] : null;
    }
    return getLocalUsers().find(user => String(user.id) === String(userId)) || null;
  }

  async function updateUserById(userId, updates) {
    if (supabase) {
      const pendingUpdates = { ...updates };
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.from('app_users').update(pendingUpdates).eq('id', String(userId))
          .select('id, username, email, full_name, phone, department, role, is_active, avatar, created_at, last_login').limit(1);
        if (!error) return data && data[0] ? data[0] : null;
        const optionalColumn = ['is_frozen', 'password_changed_at'].find(column =>
          Object.prototype.hasOwnProperty.call(pendingUpdates, column) && String(error.message || '').includes(column));
        if (!optionalColumn) throw error;
        delete pendingUpdates[optionalColumn];
      }
      throw new Error('Kullanıcı güncellemesi desteklenmeyen veritabanı şeması nedeniyle tamamlanamadı.');
    }

    const users = getLocalUsers();
    const index = users.findIndex(user => String(user.id) === String(userId));
    if (index === -1) return null;
    users[index] = { ...users[index], ...updates };
    saveLocalUsers(users);
    const safeUser = { ...users[index] };
    delete safeUser.password_hash;
    return safeUser;
  }

  async function ensureAdminUser() {
    const username = (env.BOOTSTRAP_ADMIN_USERNAME || '').trim().toLowerCase();
    const password = env.BOOTSTRAP_ADMIN_PASSWORD || '';
    const email = (env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
    if (!username || !password) return false;
    if (password.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD en az 12 karakter olmalıdır.');

    const admin = {
      id: 'usr_admin_root', username, password_hash: await hashPassword(password), email,
      full_name: 'Sistem Yöneticisi (Admin)', phone: '', department: 'Bilgi İşlem ve Yönetim',
      role: 'admin', is_active: true, avatar: 'A', created_at: new Date().toISOString(), last_login: null
    };
    if (supabase) {
      try {
        const { data, error } = await supabase.from('app_users').select('id, role').eq('role', 'admin').limit(1);
        if (error) throw error;
        if (!data || data.length === 0) {
          console.log('Admin kullanıcısı bulunamadı, ortam değişkenlerinden bootstrap admin oluşturuluyor...');
          const result = await supabase.from('app_users').upsert([admin], { onConflict: 'username' });
          if (result.error) throw result.error;
        }
        return true;
      } catch (error) {
        console.warn('Supabase admin doğrulama uyarısı:', safeLogStr(error.message));
      }
    }
    const users = getLocalUsers();
    if (!users.some(user => user.role === 'admin' || user.username === username)) {
      users.unshift(admin);
      saveLocalUsers(users);
    }
    return true;
  }

  return { ensureAdminUser, getLocalUsers, loadUserById, saveLocalUsers, updateUserById };
}

module.exports = { createUserService };
