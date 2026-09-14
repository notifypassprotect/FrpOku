function registerAccountPasswordRoute(app, deps) {
  const { PASSWORD_MAX_LENGTH, authRateLimiter, hashPassword, loadUserById, mailer, requireAuth, safeLogStr, signToken, updateUserById, verifyPasswordHash } = deps;

  app.post('/api/auth/change-password', authRateLimiter, requireAuth, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.authUser.id;
    if (!oldPassword || !newPassword) return res.status(400).json({ success: false, reason: 'Lütfen mevcut ve yeni şifrenizi giriniz.' });
    if (newPassword.length < 6 || newPassword.length > PASSWORD_MAX_LENGTH) return res.status(400).json({ success: false, reason: `Yeni şifre en az 6, en fazla ${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.` });
    try {
      const user = await loadUserById(userId);
      if (!user) return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });
      const oldPasswordCheck = await verifyPasswordHash(oldPassword, user.password_hash);
      if (!oldPasswordCheck.valid) return res.status(400).json({ success: false, reason: 'Mevcut şifrenizi hatalı girdiniz!' });
      const previousHashes = Array.isArray(user.previous_password_hashes) ? user.previous_password_hashes : [];
      for (const passwordHash of [user.password_hash, ...previousHashes].filter(Boolean)) {
        if ((await verifyPasswordHash(newPassword, passwordHash)).valid) return res.status(400).json({ success: false, reason: 'Yeni şifreniz, mevcut şifreniz veya daha önce kullandığınız son 3 şifrenizden biriyle aynı olamaz.' });
      }
      const nowIso = new Date().toISOString();
      await updateUserById(userId, { password_hash: await hashPassword(newPassword), password_changed_at: nowIso, previous_password_hashes: [user.password_hash, ...previousHashes].filter(Boolean).slice(0, 3) });
      const token = signToken({ id: user.id, username: user.username, role: user.role, department: user.department, iat: Date.now() });
      const mailResult = await mailer.sendPasswordChanged({ to: user.email, fullName: user.full_name || user.username, username: user.username, ip: req.ip, timestamp: nowIso });
      res.json({ success: true, message: mailResult.sent ? 'Şifreniz değiştirildi ve güvenlik bildirimi e-posta adresinize gönderildi.' : 'Şifreniz değiştirildi; ancak güvenlik bildirimi gönderilemedi.', token, notification: { email: { sent: mailResult.sent, status: mailResult.status } } });
    } catch (err) {
      console.warn('Şifre güncelleme hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Şifre geçici olarak güncellenemedi.' });
    }
  });
}

module.exports = { registerAccountPasswordRoute };
