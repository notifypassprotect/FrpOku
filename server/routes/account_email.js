function registerAccountEmailRoutes(app, deps) {
  const { authRateLimiter, crypto, getLocalUsers, isValidEmail, loadUserById, mailer, normalizeEmail, pendingEmailVerifications, recordAuditLog, requireAuth, safeLogStr, saveLocalUsers, supabase, verifyPasswordHash } = deps;

  app.post('/api/auth/request-email-change', authRateLimiter, requireAuth, async (req, res) => {
    const { newEmail, currentPassword } = req.body;
    const cleanEmail = normalizeEmail(newEmail);
    if (!cleanEmail || !isValidEmail(cleanEmail)) return res.status(400).json({ success: false, reason: 'Geçerli bir yeni e-posta adresi giriniz.' });
    try {
      const user = await loadUserById(req.authUser.id);
      if (!user) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      if (!currentPassword) return res.status(400).json({ success: false, reason: 'Güvenliğiniz için lütfen mevcut şifrenizi giriniz.' });
      if (!(await verifyPasswordHash(currentPassword, user.password_hash)).valid) return res.status(401).json({ success: false, reason: 'Mevcut şifreniz hatalıdır.' });
      if (user.email && normalizeEmail(user.email) === cleanEmail) return res.status(400).json({ success: false, reason: 'Girdiğiniz adres zaten mevcut e-posta adresinizdir.' });

      if (supabase) {
        const existing = await supabase.from('app_users').select('id').eq('email', cleanEmail).neq('id', user.id).limit(1);
        if (existing.error) throw existing.error;
        if (existing.data?.length) return res.status(409).json({ success: false, reason: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.' });
      } else if (getLocalUsers().some(item => String(item.id) !== String(user.id) && normalizeEmail(item.email) === cleanEmail)) {
        return res.status(409).json({ success: false, reason: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.' });
      }

      const code = crypto.randomInt(100000, 1000000).toString();
      pendingEmailVerifications.set(String(user.id), { userId: String(user.id), code, newEmail: cleanEmail, oldEmail: user.email, expiresAt: Date.now() + 15 * 60 * 1000 });
      const mailResult = await mailer.sendEmailChangeCode({ to: cleanEmail, fullName: user.full_name || user.username, code, expiresIn: '15' });
      if (!mailResult.sent) {
        pendingEmailVerifications.delete(String(user.id));
        await recordAuditLog({ userId: user.id, username: user.username, role: user.role, action: 'EMAIL_CHANGE_CODE_FAILED', target: cleanEmail, details: `Doğrulama kodu gönderilemedi (Durum: ${mailResult.status})`, ip: req.ip });
        return res.status(503).json({ success: false, reason: mailResult.error || mailResult.reason || 'Doğrulama kodu e-posta adresine gönderilemedi.', notification: { email: { sent: false, status: mailResult.status } } });
      }
      await recordAuditLog({ userId: user.id, username: user.username, role: user.role, action: 'EMAIL_CHANGE_CODE_REQUESTED', target: cleanEmail, details: `6 haneli doğrulama kodu gönderildi (Durum: ${mailResult.status})`, ip: req.ip });
      res.json({ success: true, message: `'${cleanEmail}' adresine 6 haneli güvenlik doğrulama kodu gönderildi.`, notification: { email: { sent: true, status: mailResult.status } } });
    } catch (err) {
      console.warn('E-posta kod talebi hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'E-posta doğrulama kodu gönderilemedi.' });
    }
  });

  app.post('/api/auth/confirm-email-change', authRateLimiter, requireAuth, async (req, res) => {
    const userId = String(req.authUser.id);
    const pending = pendingEmailVerifications.get(userId);
    if (!pending || Date.now() > pending.expiresAt) {
      pendingEmailVerifications.delete(userId);
      return res.status(400).json({ success: false, reason: 'Doğrulama kodunun süresi dolmuş veya kod talep edilmemiş. Lütfen yeni kod isteyiniz.' });
    }
    if (String(req.body?.code || '').trim() !== pending.code) return res.status(400).json({ success: false, reason: 'Girdiğiniz doğrulama kodu hatalıdır.' });

    const { newEmail, oldEmail } = pending;
    try {
      if (supabase) {
        const existing = await supabase.from('app_users').select('id').eq('email', newEmail).neq('id', userId).limit(1);
        if (existing.error) throw existing.error;
        if (existing.data?.length) return res.status(409).json({ success: false, reason: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.' });
        const update = await supabase.from('app_users').update({ email: newEmail }).eq('id', userId);
        if (update.error) throw update.error;
      } else {
        const users = getLocalUsers();
        if (users.some(item => String(item.id) !== userId && normalizeEmail(item.email) === newEmail)) return res.status(409).json({ success: false, reason: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.' });
        const index = users.findIndex(item => String(item.id) === userId);
        if (index === -1) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
        users[index].email = newEmail;
        saveLocalUsers(users);
      }
      pendingEmailVerifications.delete(userId);
      const noticeResult = await mailer.sendEmailChangedNotice({ to: oldEmail && oldEmail !== newEmail ? oldEmail : '', fullName: req.authUser.full_name || req.authUser.username, newEmail, ip: req.ip });
      await recordAuditLog({ userId, username: req.authUser.username, role: req.authUser.role, action: 'EMAIL_CHANGED', target: newEmail, details: `E-posta adresi '${oldEmail}' -> '${newEmail}' olarak doğrulandı ve güncellendi.`, ip: req.ip });
      res.json({ success: true, email: newEmail, message: noticeResult.sent ? 'E-posta adresiniz güncellendi; eski adresinize güvenlik bildirimi gönderildi.' : 'E-posta adresiniz başarıyla güncellendi.', notification: { email: { sent: noticeResult.sent, status: noticeResult.status } } });
    } catch (err) {
      console.warn('E-posta onaylama hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'E-posta adresi güncellenirken sunucu hatası oluştu.' });
    }
  });
}

module.exports = { registerAccountEmailRoutes };
