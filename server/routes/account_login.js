function registerAccountLoginRoutes(app, deps) {
  const { PASSWORD_MAX_LENGTH, authRateLimiter, generateCaptcha, getLocalUsers, hashPassword, isValidEmail, loginFailures, safeLogStr, saveLocalUsers, signToken, supabase, verifyCaptcha, verifyPasswordHash } = deps;

  app.get('/api/auth/captcha', authRateLimiter, (req, res) => {
    const c = generateCaptcha();
    res.json({ success: true, question: c.question, token: c.token, captchaToken: c.token });
  });
  
  // ── 2. KULLANICI GİRİŞİ (Login) ──────────────────────────────
  app.post('/api/auth/login', authRateLimiter, async (req, res) => {
    const { identifier, password, captchaToken, captchaAnswer } = req.body;
    const ident = String(identifier || '').trim();
    if (!ident || !password || ident.length > 254 || String(password).length > PASSWORD_MAX_LENGTH) {
      return res.status(400).json({ success: false, reason: 'Lütfen kullanıcı bilgilerinizi ve şifrenizi giriniz.' });
    }
  
    const cleanIdent = ident.toLowerCase();
    const failKey = `${cleanIdent}_${(req.ip || '127.0.0.1').replace(/^::ffff:/, '')}`;
    const currentFailures = loginFailures.get(failKey) || 0;
    const isCaptchaRequired = currentFailures >= 3;
  
    if (isCaptchaRequired) {
      if (!captchaToken || !captchaAnswer || !verifyCaptcha(captchaToken, captchaAnswer)) {
        return res.status(400).json({
          success: false,
          requireCaptcha: true,
          failedAttempts: currentFailures,
          reason: '3 ve üzeri hatalı deneme nedeniyle güvenlik doğrulaması (Captcha) gereklidir. Lütfen soruyu doğru yanıtlayınız.'
        });
      }
    }
  
    const phoneDigits = ident.replace(/\D/g, '');
    let user = null;
  
    try {
      if (supabase) {
        let query = supabase.from('app_users').select('*');
        if (isValidEmail(cleanIdent)) {
          query = query.eq('email', cleanIdent);
        } else if (phoneDigits.length >= 10) {
          query = query.eq('phone', phoneDigits);
        } else {
          query = query.eq('username', cleanIdent);
        }
  
        const { data: users, error } = await query.limit(1);
        if (error) throw error;
        if (users?.length) user = users[0];
      }
  
      if (!supabase) {
        const localUsers = getLocalUsers();
        user = localUsers.find(u => 
          (u.username || '').toLowerCase() === cleanIdent ||
          (u.email || '').toLowerCase() === cleanIdent ||
          (phoneDigits.length >= 10 && (u.phone || '').replace(/\D/g, '') === phoneDigits)
        );
      }
  
      if (!user) {
        const newFailures = currentFailures + 1;
        loginFailures.set(failKey, newFailures);
        const requireNow = newFailures >= 3;
        return res.status(401).json({
          success: false,
          requireCaptcha: requireNow,
          failedAttempts: newFailures,
          reason: requireNow ? '3 hatalı deneme yapıldı. Güvenlik doğrulaması (Captcha) gereklidir.' : 'Kullanıcı bilgileriniz veya şifreniz hatalı.'
        });
      }
  
      const passwordCheck = await verifyPasswordHash(password, user.password_hash);
      if (!passwordCheck.valid) {
        const newFailures = currentFailures + 1;
        loginFailures.set(failKey, newFailures);
        const requireNow = newFailures >= 3;
        return res.status(401).json({
          success: false,
          requireCaptcha: requireNow,
          failedAttempts: newFailures,
          reason: requireNow ? '3 hatalı deneme yapıldı. Güvenlik doğrulaması (Captcha) gereklidir.' : 'Kullanıcı bilgileriniz veya şifreniz hatalı.'
        });
      }
  
      // Başarılı girişte başarısız sayaçları temizle
      loginFailures.delete(failKey);
  
      // Başarılı girişte eski SHA-256 kaydını otomatik olarak scrypt'e yükselt.
      if (passwordCheck.needsRehash) {
        const upgradedHash = await hashPassword(password);
        user.password_hash = upgradedHash;
        if (supabase) {
          const { error: upgradeError } = await supabase.from('app_users').update({ password_hash: upgradedHash }).eq('id', user.id);
          if (upgradeError) console.warn('Parola hash yükseltme uyarısı:', upgradeError.message);
        }
        if (!supabase) {
          const upgradeUsers = getLocalUsers();
          const upgradeIndex = upgradeUsers.findIndex(u => u.id === user.id);
          if (upgradeIndex !== -1) {
            upgradeUsers[upgradeIndex].password_hash = upgradedHash;
            saveLocalUsers(upgradeUsers);
          }
        }
      }
  
      // Onay ve Aktiflik Durumu Denetimi
      if (user.is_active === false) {
        return res.status(403).json({
          success: false,
          pendingApproval: true,
          reason: '⏳ Hesabınız henüz sistem yöneticisi (Admin) tarafından onaylanmamıştır. Lütfen yöneticinizle iletişime geçiniz.'
        });
      }
  
      // Son giriş zamanını güncelle
      const nowIso = new Date().toISOString();
      user.last_login = nowIso;
  
      if (supabase) {
        const { error: lastLoginError } = await supabase.from('app_users').update({ last_login: nowIso }).eq('id', user.id);
        if (lastLoginError) console.warn('Last login update warning:', safeLogStr(lastLoginError.message));
      } else {
        const localUsers = getLocalUsers();
        const locIdx = localUsers.findIndex(u => u.id === user.id);
        if (locIdx !== -1) {
          localUsers[locIdx].last_login = nowIso;
          saveLocalUsers(localUsers);
        }
      }
  
      const safeUser = { ...user };
      delete safeUser.password_hash;
      delete safeUser.previous_password_hashes;
  
      const token = signToken({
        id: safeUser.id,
        username: safeUser.username,
        role: safeUser.role,
        department: safeUser.department,
        exp: Date.now() + 7 * 24 * 3600 * 1000 // 7 gün geçerli
      });
  
      res.json({
        success: true,
        token,
        user: safeUser
      });
    } catch (err) {
      console.error('Giriş hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Giriş servisi geçici olarak kullanılamıyor.' });
    }
  });
}

module.exports = { registerAccountLoginRoutes };
