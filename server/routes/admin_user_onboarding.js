function registerAdminUserOnboardingRoutes(app, deps) {
  const { adminRateLimiter, getLocalUsers, mailer, recordAuditLog, requireAdmin, safeLogStr, supabase, updateUserById } = deps;

  // ── 3. ADMİN: ONAY BEKLEYEN KULLANICILARI LİSTELE ──────────────
  app.get('/api/admin/pending-users', adminRateLimiter, requireAdmin, async (req, res) => {
    try {
      let pendingList = [];
      if (supabase) {
        const { data, error } = await supabase
          .from('app_users')
          .select('id, username, email, full_name, phone, department, role, is_active, created_at, avatar')
          .eq('is_active', false)
          .order('created_at', { ascending: false });
        if (error) throw error;
        pendingList = data || [];
      } else {
        pendingList = getLocalUsers().filter(user => user.is_active === false).map(user => {
          const safe = { ...user };
          delete safe.password_hash;
          return safe;
        }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }
  
      res.json({
        success: true,
        count: pendingList.length,
        users: pendingList
      });
    } catch (err) {
      console.warn('Onay bekleyen kullanıcı listesi hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Onay bekleyen kullanıcılar geçici olarak alınamıyor.' });
    }
  });
  
  // ── 4. ADMİN: TÜM KULLANICILARI LİSTELE ───────────────────────
  app.get('/api/admin/all-users', adminRateLimiter, requireAdmin, async (req, res) => {
    try {
      let allUsers = [];
      if (supabase) {
        const { data, error } = await supabase
          .from('app_users')
          .select('id, username, email, full_name, phone, department, role, is_active, created_at, last_login, avatar')
          .order('created_at', { ascending: false });
        if (error) throw error;
        allUsers = data || [];
      } else {
        allUsers = getLocalUsers().map(user => {
          const safe = { ...user };
          delete safe.password_hash;
          return safe;
        }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }
  
      res.json({
        success: true,
        count: allUsers.length,
        users: allUsers
      });
    } catch (err) {
      console.warn('Kullanıcı listesi hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Kullanıcı listesi geçici olarak alınamıyor.' });
    }
  });
  
  // ── 5. ADMİN: KULLANICIYI ONAYLA (Approve & Activate) ─────────
  app.post('/api/admin/approve-user', adminRateLimiter, requireAdmin, async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği (userId) belirtilmedi.' });
    }
  
    try {
      const approvedUser = await updateUserById(userId, { is_active: true });
      if (!approvedUser) return res.status(404).json({ success: false, reason: 'Onaylanacak kullanıcı bulunamadı.' });
      const targetUsername = approvedUser.username || String(userId);
  
      await recordAuditLog({
        userId: req.adminUser.id,
        username: req.adminUser.username,
        role: 'admin',
        action: 'USER_APPROVE',
        target: targetUsername,
        details: `@${targetUsername} kullanıcısının kaydı onaylandı ve hesabı aktifleştirildi.`,
        ip: req.ip
      });
  
      console.log('Kullanıcı Başarıyla Onaylandı:', safeLogStr(targetUsername));
  
      // Mail hatası hesap onayını geri almaz; durum ayrıca audit kaydına yazılır.
      const mailResult = await mailer.sendAccountApproved({
        to: approvedUser.email,
        fullName: approvedUser.full_name,
        username: approvedUser.username
      });
  
      await recordAuditLog({
        userId: req.adminUser.id,
        username: req.adminUser.username,
        role: 'admin',
        action: mailResult.sent ? 'MAIL_ACCOUNT_APPROVED' : 'MAIL_ACCOUNT_APPROVED_SKIPPED',
        target: approvedUser.email || '-',
        details: `Hesap onay e-postası durumu: ${mailResult.status}`,
        ip: req.ip
      });
  
      res.json({
        success: true,
        message: 'Kullanıcı hesabı başarıyla onaylandı ve aktifleştirildi.',
        notification: {
          email: {
            sent: mailResult.sent,
            status: mailResult.status
          }
        }
      });
    } catch (err) {
      console.error('Onaylama hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Kullanıcı geçici olarak onaylanamadı.' });
    }
  });
}

module.exports = { registerAdminUserOnboardingRoutes };
