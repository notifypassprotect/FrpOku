function registerAdminUserStatusRoutes(app, deps) {
  const { adminRateLimiter, getLocalUsers, loadUserById, mailer, readLocalReports, recordAuditLog, requireAdmin, safeLogStr, saveLocalUsers, supabase, updateUserById, writeLocalReports } = deps;

  // ── ADMİN: KULLANICIYI KALICI SİL ──────────────────────────────────────────
  app.post('/api/admin/delete-user', adminRateLimiter, requireAdmin, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği belirtilmedi.' });
    if (String(userId) === String(req.adminUser.id)) {
      return res.status(400).json({ success: false, reason: 'Kendi yönetici hesabınızı silemezsiniz.' });
    }
  
    try {
      const userObj = await loadUserById(userId);
      if (!userObj) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      const targetUsername = userObj.username || String(userId);
  
      if (supabase) {
        const reportDelete = await supabase.from('reports').delete().eq('user_id', String(userId));
        if (reportDelete.error) console.warn('Kullanıcı raporları silme uyarısı:', reportDelete.error.message);
        const userDelete = await supabase.from('app_users').delete().eq('id', String(userId));
        if (userDelete.error) throw userDelete.error;
      } else {
        saveLocalUsers(getLocalUsers().filter(user => String(user.id) !== String(userId)));
        writeLocalReports(readLocalReports().filter(report => String(report.user_id) !== String(userId)));
      }
  
      await recordAuditLog({
        userId: req.adminUser.id,
        username: req.adminUser.username,
        role: 'admin',
        action: 'USER_DELETE',
        target: targetUsername,
        details: `@${targetUsername} kullanıcısı ve kişisel kayıtları sistemden silindi.`,
        ip: req.ip
      });
  
      res.json({ success: true, message: `@${targetUsername} kullanıcısı başarıyla silindi.` });
    } catch (err) {
      console.warn('Kullanıcı silme hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Kullanıcı silme işlemi tamamlanamadı.' });
    }
  });
  
  // ── ADMİN: HESAP DONDUR / AÇ (Freeze / Unfreeze) ───────────────────────────
  app.post('/api/admin/freeze-user', adminRateLimiter, requireAdmin, async (req, res) => {
    const { userId, freeze = true } = req.body;
    if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği gerekli.' });
    if (String(userId) === String(req.adminUser.id) && freeze) {
      return res.status(400).json({ success: false, reason: 'Kendi yönetici hesabınızı donduramazsınız.' });
    }
  
    try {
      const isFrozen = Boolean(freeze);
      const updatedUser = await updateUserById(userId, {
        is_frozen: isFrozen,
        is_active: !isFrozen
      });
      if (!updatedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
  
      if (updatedUser.email) {
        mailer.sendAccountStatusChanged({
          to: updatedUser.email,
          fullName: updatedUser.full_name || updatedUser.username,
          username: updatedUser.username,
          action: isFrozen ? 'frozen' : 'activated'
        }).catch(() => {});
      }
  
      await recordAuditLog({
        userId: req.adminUser.id,
        username: req.adminUser.username,
        role: 'admin',
        action: isFrozen ? 'USER_FROZEN' : 'USER_UNFROZEN',
        target: updatedUser.username,
        details: `Hesap durumu: ${isFrozen ? 'donduruldu' : 'aktifleştirildi'}`,
        ip: req.ip
      });
  
      res.json({ success: true, is_frozen: isFrozen, is_active: !isFrozen });
    } catch (err) {
      console.warn('Hesap dondurma hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Hesap dondurma işlemi tamamlanamadı.' });
    }
  });
}

module.exports = { registerAdminUserStatusRoutes };
