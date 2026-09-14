function registerAccountRecoveryRoutes(app, deps) {
  const { PASSWORD_MAX_LENGTH, authRateLimiter, crypto, getLocalUsers, hashPassword, isValidEmail, isValidUsername, loginFailures, mailer, normalizeEmail, normalizeUsername, recordAuditLog, safeLogStr, signToken, supabase, updateUserById } = deps;

  // ── 2.5. ACİL ERİŞİM ANAHTARI İLE ŞİFRE SIFIRLAMA & GİRİŞ ─────────
  app.post('/api/auth/recover-with-key', authRateLimiter, async (req, res) => {
    const { identifier, recoveryKey, newPassword } = req.body || {};
    const ident = String(identifier || '').trim().toLowerCase();
    const rawKey = String(recoveryKey || '').trim().toUpperCase();
    const pass = String(newPassword || '');
  
    if (!ident || !rawKey || !pass) {
      return res.status(400).json({ success: false, reason: 'Kullanıcı adı, acil erişim anahtarı ve yeni şifre gereklidir.' });
    }
  
    if (pass.length < 6 || pass.length > PASSWORD_MAX_LENGTH) {
      return res.status(400).json({ success: false, reason: `Yeni şifreniz en az 6, en fazla ${PASSWORD_MAX_LENGTH} karakter olmalıdır.` });
    }
  
    try {
      let user = null;
      if (supabase) {
        const isEmail = ident.includes('@');
        const cleanEmail = normalizeEmail(ident);
        const cleanUser = normalizeUsername(ident);
        if (isEmail && isValidEmail(cleanEmail)) {
          const { data, error } = await supabase.from('app_users').select('*').eq('email', cleanEmail).limit(1);
          if (error) throw error;
          if (data && data.length) user = data[0];
        } else if (isValidUsername(cleanUser)) {
          const { data, error } = await supabase.from('app_users').select('*').eq('username', cleanUser).limit(1);
          if (error) throw error;
          if (data && data.length) user = data[0];
        }
      } else {
        const localUsers = getLocalUsers();
        user = localUsers.find(u => (u.username || '').toLowerCase() === ident || (u.email || '').toLowerCase() === ident);
      }
  
      if (!user) {
        return res.status(400).json({ success: false, reason: 'Kurtarma bilgileri doğrulanamadı.' });
      }
  
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const keysList = Array.isArray(user.recovery_keys) ? user.recovery_keys : [];
      const matchIdx = keysList.findIndex(k => k.keyHash === keyHash && !k.used);
  
      if (matchIdx === -1) {
        return res.status(400).json({ success: false, reason: 'Kurtarma bilgileri doğrulanamadı.' });
      }
  
      // Anahtarı kullanıldı olarak işaretle
      keysList[matchIdx].used = true;
      keysList[matchIdx].usedAt = new Date().toISOString();
  
      const newHash = await hashPassword(pass);
      const nowIso = new Date().toISOString();
      const prevHashes = [user.password_hash, ...(Array.isArray(user.previous_password_hashes) ? user.previous_password_hashes : [])].filter(Boolean).slice(0, 3);
  
      const updates = {
        password_hash: newHash,
        password_changed_at: nowIso,
        previous_password_hashes: prevHashes,
        recovery_keys: keysList,
        last_login: nowIso
      };
  
      await updateUserById(user.id, updates);
  
      await recordAuditLog({
        userId: user.id,
        username: user.username,
        role: user.role,
        action: 'SECURITY_RECOVERY',
        target: user.username,
        details: 'Hesap acil erişim anahtarı ile kurtarıldı ve şifre sıfırlandı.',
        ip: req.ip
      });
  
      const safeUser = { ...user, ...updates };
      delete safeUser.password_hash;
      delete safeUser.previous_password_hashes;
      delete safeUser.recovery_keys;
  
      const token = signToken({
        id: safeUser.id,
        username: safeUser.username,
        role: safeUser.role,
        department: safeUser.department,
        exp: Date.now() + 7 * 24 * 3600 * 1000
      });
  
      res.json({
        success: true,
        message: 'Hesabınız acil kurtarma anahtarı ile başarıyla kurtarıldı. Yeni şifreniz aktif.',
        token,
        user: safeUser
      });
    } catch (err) {
      console.error('Acil kurtarma hatası:', safeLogStr(err.message));
      res.status(500).json({ success: false, reason: 'Kurtarma işlemi gerçekleştirilemedi.' });
    }
  });
  
  // In-memory 6-haneli doğrulama kodu deposu
  const passwordResetVerificationCodes = new Map();
  
  // ── 2.5. E-POSTA İLE DOĞRULAMA KODU GÖNDERME (Self-Service Forgot Password) ──
  app.post('/api/auth/forgot-password-code', authRateLimiter, async (req, res) => {
    const { identifier } = req.body || {};
    const ident = String(identifier || '').trim().toLowerCase();
  
    if (!ident) {
      return res.status(400).json({ success: false, reason: 'Lütfen kullanıcı adınızı veya e-posta adresinizi giriniz.' });
    }
  
    try {
      let user = null;
      if (supabase) {
        const isEmail = ident.includes('@');
        const cleanEmail = normalizeEmail(ident);
        const cleanUser = normalizeUsername(ident);
        if (isEmail && isValidEmail(cleanEmail)) {
          const { data, error } = await supabase.from('app_users').select('*').eq('email', cleanEmail).limit(1);
          if (error) throw error;
          if (data && data.length) user = data[0];
        } else if (isValidUsername(cleanUser)) {
          const { data, error } = await supabase.from('app_users').select('*').eq('username', cleanUser).limit(1);
          if (error) throw error;
          if (data && data.length) user = data[0];
        }
      } else {
        const localUsers = getLocalUsers();
        user = localUsers.find(u => (u.username || '').toLowerCase() === ident || (u.email || '').toLowerCase() === ident);
      }
  
      const genericResetResponse = {
        success: true,
        message: 'Bilgiler kayıtlı bir hesapla eşleşiyorsa şifre sıfırlama kodu e-posta adresine gönderildi.',
        expiresInMinutes: 15
      };
      if (!user || !user.email) return res.json(genericResetResponse);
  
      // 6 haneli rastgele kod oluştur (100000 - 999999)
      const code = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 dakika
  
      passwordResetVerificationCodes.set(ident, {
        code,
        userId: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        expiresAt
      });
      passwordResetVerificationCodes.set(user.email.toLowerCase(), {
        code,
        userId: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        expiresAt
      });
  
      await mailer.sendSelfServiceResetCode({
        to: user.email,
        fullName: user.full_name || user.username,
        username: user.username,
        code,
        expiresIn: '15'
      });
  
      res.json(genericResetResponse);
    } catch (err) {
      console.error('Şifre sıfırlama kodu hatası:', safeLogStr(err.message));
      res.json({
        success: true,
        message: 'Bilgiler kayıtlı bir hesapla eşleşiyorsa şifre sıfırlama kodu e-posta adresine gönderildi.',
        expiresInMinutes: 15
      });
    }
  });
  
  // ── 2.6. E-POSTA KODU İLE ŞİFRE SIFIRLAMA ────────────────────────
  app.post('/api/auth/reset-password-with-code', authRateLimiter, async (req, res) => {
    const { identifier, code, newPassword } = req.body || {};
    const ident = String(identifier || '').trim().toLowerCase();
    const rawCode = String(code || '').trim();
    const pass = String(newPassword || '');
  
    if (!ident || !rawCode || !pass) {
      return res.status(400).json({ success: false, reason: 'Kullanıcı adı/e-posta, 6 haneli kod ve yeni şifre gereklidir.' });
    }
  
    if (pass.length < 6 || pass.length > PASSWORD_MAX_LENGTH) {
      return res.status(400).json({ success: false, reason: `Yeni şifreniz en az 6, en fazla ${PASSWORD_MAX_LENGTH} karakter olmalıdır.` });
    }
  
    const entry = passwordResetVerificationCodes.get(ident);
    if (!entry || entry.code !== rawCode) {
      return res.status(400).json({ success: false, reason: 'Girilen doğrulama kodu hatalı veya geçersiz!' });
    }
  
    if (Date.now() > entry.expiresAt) {
      passwordResetVerificationCodes.delete(ident);
      return res.status(400).json({ success: false, reason: 'Doğrulama kodunun 15 dakikalık kullanım süresi dolmuş. Lütfen yeni bir kod isteyiniz.' });
    }
  
    try {
      const passwordHash = await hashPassword(pass);
      const nowIso = new Date().toISOString();
  
      const updatedUser = await updateUserById(entry.userId, {
        password_hash: passwordHash,
        password_changed_at: nowIso,
        last_login: nowIso
      });
  
      if (!updatedUser) {
        return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });
      }
  
      // Kodları ve başarısız giriş deneme sayacını temizle
      passwordResetVerificationCodes.delete(ident);
      if (entry.email) passwordResetVerificationCodes.delete(entry.email.toLowerCase());
      const cleanU = (updatedUser.username || '').toLowerCase();
      const cleanE = (updatedUser.email || '').toLowerCase();
      for (const [key] of loginFailures.entries()) {
        if (key.startsWith(cleanU + '_') || (cleanE && key.startsWith(cleanE + '_'))) {
          loginFailures.delete(key);
        }
      }
  
      await recordAuditLog({
        userId: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        action: 'PASSWORD_RESET_SELF_CODE',
        target: updatedUser.username,
        details: 'Kullanıcı e-posta doğrulama kodu ile şifresini sıfırladı.',
        ip: req.ip
      });
  
      const token = signToken({
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        department: updatedUser.department,
        exp: Date.now() + 7 * 24 * 3600 * 1000
      });
  
      const safeUser = { ...updatedUser };
      delete safeUser.password_hash;
      delete safeUser.previous_password_hashes;
      delete safeUser.recovery_keys;
  
      res.json({
        success: true,
        message: 'Şifreniz başarıyla sıfırlandı ve oturum açıldı.',
        token,
        user: safeUser
      });
    } catch (err) {
      console.error('Kod ile şifre sıfırlama hatası:', safeLogStr(err.message));
      res.status(500).json({ success: false, reason: 'Şifre güncellenemedi.' });
    }
  });
}

module.exports = { registerAccountRecoveryRoutes };
