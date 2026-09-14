function registerAccountProfileRoute(app, deps) {
  const { authRateLimiter, getLocalUsers, isValidText, isValidUsername, normalizeEmail, normalizePhone, normalizeText, normalizeUsername, requireAuth, safeLogStr, saveLocalUsers, saveUserAvatar, supabase } = deps;

  app.post('/api/auth/update-profile', authRateLimiter, requireAuth, async (req, res) => {
    const { fullName, name, phone, department, email, username, emailChatDigest, email_chat_digest, avatar } = req.body;
    const userId = req.authUser.id;
    try {
      const updates = {};
      const targetName = fullName !== undefined ? fullName : name;
      if (targetName !== undefined) {
        if (!isValidText(targetName, { min: 2, max: 120 })) return res.status(400).json({ success: false, reason: 'Ad soyad 2-120 karakter arasında olmalıdır.' });
        updates.full_name = normalizeText(targetName);
      }
      if (phone !== undefined) updates.phone = normalizePhone(phone);
      if (department !== undefined) {
        if (!isValidText(department, { min: 1, max: 120 })) return res.status(400).json({ success: false, reason: 'Bölüm 1-120 karakter arasında olmalıdır.' });
        updates.department = normalizeText(department);
      }
      if (avatar !== undefined && typeof avatar === 'string' && avatar.length <= 600000) {
        updates.avatar = avatar;
        saveUserAvatar(userId, req.authUser.username, avatar);
      }
      if (email !== undefined) return res.status(409).json({ success: false, reason: 'E-posta adresi doğrulama kodu kullanılmadan değiştirilemez.' });
      if (username !== undefined) {
        const cleanUsername = normalizeUsername(username);
        if (!isValidUsername(cleanUsername)) return res.status(400).json({ success: false, reason: 'Geçerli bir kullanıcı adı giriniz.' });
        updates.username = cleanUsername;
      }
      if (emailChatDigest !== undefined || email_chat_digest !== undefined) updates.email_chat_digest = emailChatDigest !== undefined ? Boolean(emailChatDigest) : Boolean(email_chat_digest);
      if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, reason: 'Güncellenecek profil alanı bulunamadı.' });

      if (supabase) {
        if (updates.username) {
          const existing = await supabase.from('app_users').select('id').eq('username', updates.username).neq('id', userId).limit(1);
          if (existing.error) throw existing.error;
          if (existing.data?.length) return res.status(409).json({ success: false, reason: 'Bu kullanıcı adı zaten kullanımda.' });
        }
        const updatePayload = { ...updates };
        const { error } = await supabase.from('app_users').update(updatePayload).eq('id', userId);
        if (error) {
          let stripped = false;
          if (String(error.message || '').includes('email_chat_digest')) { delete updatePayload.email_chat_digest; stripped = true; }
          if (String(error.message || '').includes('avatar')) { delete updatePayload.avatar; stripped = true; }
          if (!stripped) throw error;
          if (Object.keys(updatePayload).length > 0) {
            const retry = await supabase.from('app_users').update(updatePayload).eq('id', userId);
            if (retry.error) throw retry.error;
          }
        }
      } else {
        const users = getLocalUsers();
        if (updates.email && users.some(user => user.id !== userId && normalizeEmail(user.email) === updates.email)) return res.status(409).json({ success: false, reason: 'Bu e-posta adresi zaten kullanımda.' });
        if (updates.username && users.some(user => user.id !== userId && normalizeUsername(user.username) === updates.username)) return res.status(409).json({ success: false, reason: 'Bu kullanıcı adı zaten kullanımda.' });
        const index = users.findIndex(user => user.id === userId);
        if (index === -1) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
        users[index] = { ...users[index], ...updates };
        saveLocalUsers(users);
      }
      res.json({ success: true, user: updates });
    } catch (err) {
      console.warn('Profil güncelleme hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Profil geçici olarak güncellenemedi.' });
    }
  });
}

module.exports = { registerAccountProfileRoute };
