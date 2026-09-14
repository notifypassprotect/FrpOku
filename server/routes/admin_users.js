function registerAdminUserRoutes(app, deps) {
  const { adminRateLimiter, getLocalUsers, loadUserById, readLocalReports, recordAuditLog, requireAdmin, safeLogStr, saveLocalUsers, supabase, updateUserById, writeLocalReports } = deps;

  app.post('/api/admin/reject-user', adminRateLimiter, requireAdmin, async (req, res) => {
    const { userId, deletePermanently = true } = req.body;
    if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği (userId) belirtilmedi.' });
    if (String(userId) === String(req.adminUser.id)) return res.status(400).json({ success: false, reason: 'Kendi yönetici hesabınızı reddedemez veya silemezsiniz.' });
    try {
      const userObj = await loadUserById(userId);
      if (!userObj) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      const targetUsername = userObj.username || String(userId);
      if (deletePermanently) {
        if (supabase) {
          const reportDelete = await supabase.from('reports').delete().eq('user_id', String(userId));
          if (reportDelete.error) throw reportDelete.error;
          const userDelete = await supabase.from('app_users').delete().eq('id', String(userId));
          if (userDelete.error) throw userDelete.error;
        } else {
          saveLocalUsers(getLocalUsers().filter(user => String(user.id) !== String(userId)));
          writeLocalReports(readLocalReports().filter(report => String(report.user_id) !== String(userId)));
        }
      } else {
        const rejectedUser = await updateUserById(userId, { is_active: false });
        if (!rejectedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      }
      await recordAuditLog({ userId: req.adminUser.id, username: req.adminUser.username, role: 'admin', action: 'USER_REJECT', target: targetUsername, details: deletePermanently ? `@${targetUsername} kullanıcısının başvuru kaydı reddedildi ve silindi.` : `@${targetUsername} kullanıcısının başvuru kaydı reddedildi.`, ip: req.ip });
      res.json({ success: true, message: deletePermanently ? 'Kayıt başvurusu reddedildi ve silindi.' : 'Kayıt başvurusu reddedildi.' });
    } catch (err) {
      console.warn('Kullanıcı reddetme hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Kullanıcı işlemi geçici olarak tamamlanamadı.' });
    }
  });

  app.post('/api/admin/toggle-status', adminRateLimiter, requireAdmin, async (req, res) => {
    const { userId, isActive } = req.body;
    if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı ID gerekli.' });
    if (String(userId) === String(req.adminUser.id) && !isActive) return res.status(400).json({ success: false, reason: 'Kendi yönetici hesabınızı donduramazsınız.' });
    try {
      const updatedUser = await updateUserById(userId, { is_active: Boolean(isActive) });
      if (!updatedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      await recordAuditLog({ userId: req.adminUser.id, username: req.adminUser.username, role: 'admin', action: 'USER_STATUS_CHANGE', target: updatedUser.username, details: `Hesap durumu: ${isActive ? 'aktif' : 'donduruldu'}`, ip: req.ip });
      res.json({ success: true, is_active: !!isActive });
    } catch (err) {
      console.warn('Kullanıcı durumu güncelleme hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Kullanıcı durumu geçici olarak güncellenemedi.' });
    }
  });

  app.post('/api/admin/toggle-admin', adminRateLimiter, requireAdmin, async (req, res) => {
    const { userId, makeAdmin } = req.body;
    if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı ID gerekli.' });
    if (String(userId) === String(req.adminUser.id) && !makeAdmin) return res.status(400).json({ success: false, reason: 'Kendi yönetici yetkinizi kaldıramazsınız.' });
    try {
      const newRole = makeAdmin ? 'admin' : 'user';
      const updatedUser = await updateUserById(userId, { role: newRole });
      if (!updatedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      await recordAuditLog({ userId: req.adminUser.id, username: req.adminUser.username, role: 'admin', action: 'USER_ROLE_CHANGE', target: updatedUser.username, details: `Yeni rol: ${newRole}`, ip: req.ip });
      res.json({ success: true, role: newRole });
    } catch (err) {
      console.warn('Kullanıcı rolü güncelleme hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Kullanıcı rolü geçici olarak güncellenemedi.' });
    }
  });
}

module.exports = { registerAdminUserRoutes };
