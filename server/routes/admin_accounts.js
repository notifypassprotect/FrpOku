function registerAdminAccountRoutes(app, deps) {
  const { PASSWORD_MAX_LENGTH, adminRateLimiter, getLocalUsers, hashPassword, isValidUsername, loginFailures, mailer, normalizeUsername, recordAuditLog, requireAdmin, safeLogStr, saveLocalUsers, supabase, updateUserById } = deps;

  async function resetPassword(req, res) {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || newPassword.length < 6 || newPassword.length > PASSWORD_MAX_LENGTH) return res.status(400).json({ success: false, reason: `Lütfen 6-${PASSWORD_MAX_LENGTH} karakter arasında geçerli bir yeni şifre giriniz.` });
    try {
      const nowIso = new Date().toISOString();
      const updatedUser = await updateUserById(userId, { password_hash: await hashPassword(newPassword), password_changed_at: nowIso });
      if (!updatedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      const cleanUsername = (updatedUser.username || '').toLowerCase();
      const cleanEmail = (updatedUser.email || '').toLowerCase();
      for (const [key] of loginFailures.entries()) if (key.startsWith(`${cleanUsername}_`) || (cleanEmail && key.startsWith(`${cleanEmail}_`))) loginFailures.delete(key);
      const mailResult = await mailer.sendPasswordResetByAdmin({ to: updatedUser.email, fullName: updatedUser.full_name || updatedUser.username, username: updatedUser.username, timestamp: nowIso });
      await recordAuditLog({ userId: req.adminUser.id, username: req.adminUser.username, role: 'admin', action: 'USER_PASSWORD_RESET', target: updatedUser.username, details: `Yönetici tarafından parola sıfırlandı. Bildirim durumu: ${mailResult.status}`, ip: req.ip });
      res.json({ success: true, message: mailResult.sent ? `"${updatedUser.full_name || updatedUser.username}" kullanıcısının şifresi güncellendi ve güvenlik bildirimi gönderildi.` : `"${updatedUser.full_name || updatedUser.username}" kullanıcısının şifresi güncellendi; ancak güvenlik bildirimi gönderilemedi.`, notification: { email: { sent: mailResult.sent, status: mailResult.status } } });
    } catch (err) {
      console.warn('Yönetici parola sıfırlama hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Kullanıcı şifresi geçici olarak güncellenemedi.' });
    }
  }

  async function changeUsername(req, res) {
    const { userId, newUsername } = req.body;
    const cleanUser = normalizeUsername(newUsername);
    if (!userId || !isValidUsername(cleanUser)) return res.status(400).json({ success: false, reason: 'Kullanıcı ID ve 3-50 karakterlik geçerli bir kullanıcı adı gereklidir.' });
    try {
      let oldUsername = '';
      if (supabase) {
        const current = await supabase.from('app_users').select('id,username').eq('id', userId).limit(1);
        if (current.error) throw current.error;
        if (!current.data?.length) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
        oldUsername = current.data[0].username || '';
        const existing = await supabase.from('app_users').select('id').eq('username', cleanUser).neq('id', userId).limit(1);
        if (existing.error) throw existing.error;
        if (existing.data?.length) return res.status(409).json({ success: false, reason: `'${cleanUser}' kullanıcı adı zaten kullanımda.` });
        const update = await supabase.from('app_users').update({ username: cleanUser }).eq('id', userId);
        if (update.error) throw update.error;
      } else {
        const users = getLocalUsers();
        if (users.some(user => user.id !== userId && normalizeUsername(user.username) === cleanUser)) return res.status(409).json({ success: false, reason: `'${cleanUser}' kullanıcı adı zaten kullanımda.` });
        const index = users.findIndex(user => user.id === userId);
        if (index === -1) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
        oldUsername = users[index].username || '';
        users[index].username = cleanUser;
        saveLocalUsers(users);
      }
      await recordAuditLog({ userId: req.adminUser.id, username: req.adminUser.username, role: 'admin', action: 'USER_UPDATE', target: `@${cleanUser}`, details: `Kullanıcı adı değiştirildi: @${oldUsername} -> @${cleanUser}`, ip: req.ip });
      res.json({ success: true, message: 'Kullanıcı adı güncellendi.', username: cleanUser });
    } catch (err) {
      console.warn('Kullanıcı adı güncelleme hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Kullanıcı adı geçici olarak güncellenemedi.' });
    }
  }

  app.post('/api/admin/reset-password', adminRateLimiter, requireAdmin, resetPassword);
  app.post('/api/admin/reset-user-password', adminRateLimiter, requireAdmin, resetPassword);
  app.post('/api/admin/update-username', adminRateLimiter, requireAdmin, changeUsername);
  app.post('/api/admin/change-username', adminRateLimiter, requireAdmin, changeUsername);
}

module.exports = { registerAdminAccountRoutes };
