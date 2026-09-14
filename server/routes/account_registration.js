function registerAccountRegistrationRoute(app, deps) {
  const { PASSWORD_MAX_LENGTH, authRateLimiter, crypto, generateEmergencyRecoveryKey, getLocalUsers, hashPassword, isValidEmail, isValidText, isValidUsername, mailer, normalizeEmail, normalizePhone, normalizeText, normalizeUsername, safeLogStr, saveLocalUsers, supabase } = deps;

  app.post('/api/auth/register', authRateLimiter, async (req, res) => {
    const { fullName, username, email, phone, department, password } = req.body;
    const cleanEmail = normalizeEmail(email);
    const cleanUser = normalizeUsername(username);
    const cleanName = normalizeText(fullName);
    const cleanPhone = normalizePhone(phone);
    const cleanDepartment = normalizeText(department || 'Bilgi İşlem');
  
    if (!cleanName || !cleanUser || !cleanEmail || !password) {
      return res.status(400).json({ success: false, reason: 'Lütfen zorunlu alanları (Ad Soyad, Kullanıcı Adı, E-Posta, Şifre) eksiksiz doldurunuz.' });
    }
  
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, reason: 'Lütfen geçerli bir e-posta formatı giriniz (Örn: ad.soyad@kurum.com).' });
    }
  
    if (!isValidUsername(cleanUser)) {
      return res.status(400).json({ success: false, reason: 'Kullanıcı adı 3-50 karakter olmalı; yalnızca küçük harf, rakam, nokta, alt çizgi ve tire içermelidir.' });
    }
  
    if (!isValidText(cleanName, { min: 2, max: 120 }) || !isValidText(cleanDepartment, { min: 1, max: 120 })) {
      return res.status(400).json({ success: false, reason: 'Ad soyad veya bölüm alanı izin verilen uzunlukta değildir.' });
    }
  
    if (password.length < 6 || password.length > PASSWORD_MAX_LENGTH) {
      return res.status(400).json({ success: false, reason: `Şifreniz en az 6, en fazla ${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.` });
    }
  
    try {
      if (supabase) {
        const usernameResult = await supabase.from('app_users').select('id').eq('username', cleanUser).limit(1);
        if (usernameResult.error) throw usernameResult.error;
        if (usernameResult.data?.length) return res.status(400).json({ success: false, reason: `'${cleanUser}' kullanıcı adı zaten kullanımda.` });
  
        const emailResult = await supabase.from('app_users').select('id').eq('email', cleanEmail).limit(1);
        if (emailResult.error) throw emailResult.error;
        if (emailResult.data?.length) return res.status(400).json({ success: false, reason: `'${cleanEmail}' e-posta adresi zaten kayıtlıdır.` });
      } else {
        const localUsers = getLocalUsers();
        if (localUsers.some(u => (u.username || '').toLowerCase() === cleanUser)) {
          return res.status(400).json({ success: false, reason: `'${cleanUser}' kullanıcı adı zaten kullanımda.` });
        }
        if (localUsers.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
          return res.status(400).json({ success: false, reason: `'${cleanEmail}' e-posta adresi zaten kayıtlıdır.` });
        }
      }
  
      const rawRecoveryKeys = [
        generateEmergencyRecoveryKey(),
        generateEmergencyRecoveryKey(),
        generateEmergencyRecoveryKey(),
        generateEmergencyRecoveryKey()
      ];
      const storedRecoveryKeys = rawRecoveryKeys.map(k => ({
        keyHash: crypto.createHash('sha256').update(k).digest('hex'),
        used: false,
        usedAt: null
      }));
  
      const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const newRecord = {
        id: newUserId,
        username: cleanUser,
        password_hash: await hashPassword(password),
        email: cleanEmail,
        full_name: cleanName,
        phone: cleanPhone,
        department: cleanDepartment,
        role: 'user',
        is_active: false, // Yönetici onayı bekliyor (false = pending)
        avatar: 'U',
        recovery_keys: storedRecoveryKeys,
        previous_password_hashes: [],
        created_at: new Date().toISOString(),
        last_login: null
      };
  
      if (supabase) {
        const { error: insertErr } = await supabase.from('app_users').insert([newRecord]);
        if (insertErr) throw insertErr;
      } else {
        const localUsers = getLocalUsers();
        localUsers.unshift(newRecord);
        saveLocalUsers(localUsers);
      }
  
      console.log(`Yeni Kullanıcı Kaydı Alındı (Admin Onayı Bekliyor): ${cleanUser} (${cleanName})`);
  
      // Kullanıcıya 4 adet acil kurtarma anahtarını e-posta ile ilet
      if (cleanEmail) {
        mailer.sendEmergencyRecoveryKeys({
          to: cleanEmail,
          fullName: cleanName,
          username: cleanUser,
          keys: rawRecoveryKeys
        }).catch(() => {});
      }
  
      let adminNotification = { attempted: 0, sent: 0, failed: 0 };
      try {
        let adminUsers = [];
        if (supabase) {
          const { data: admData, error: admError } = await supabase.from('app_users').select('email, full_name, username').eq('role', 'admin').eq('is_active', true);
          if (admError) throw admError;
          if (admData) adminUsers = admData;
        } else {
          adminUsers = getLocalUsers().filter(u => u.role === 'admin' && u.is_active !== false && u.is_frozen !== true);
        }
        const uniqueAdmins = Array.from(new Map(adminUsers.filter(adm => isValidEmail(normalizeEmail(adm.email))).map(adm => [normalizeEmail(adm.email), adm])).values());
        const results = await Promise.all(uniqueAdmins.map(adm =>
          mailer.sendAdminNewRegistrationNotification({
              to: adm.email,
              adminName: adm.full_name || adm.username,
              newUser: {
                fullName: cleanName,
                username: cleanUser,
                email: cleanEmail,
                department: cleanDepartment
              }
          })
        ));
        adminNotification = {
          attempted: results.length,
          sent: results.filter(result => result.sent).length,
          failed: results.filter(result => !result.sent).length
        };
      } catch (admErr) {
        console.warn('Admin kullanıcıları listeleme uyarısı:', admErr.message);
        adminNotification.failed += 1;
      }
  
      res.json({
        success: true,
        pendingApproval: true,
        recoveryKeys: rawRecoveryKeys,
        notification: { admins: adminNotification },
        message: 'Kayıt başvurunuz başarıyla alınmıştır. Sistem yöneticisi (Admin) onayladıktan sonra hesabınız açılacak ve giriş yapabileceksiniz.',
        user: {
          id: newRecord.id,
          username: newRecord.username,
          full_name: newRecord.full_name,
          email: newRecord.email,
          is_active: false
        }
      });
    } catch (err) {
      console.error('Kayıt hatası:', safeLogStr(err.message));
      res.status(503).json({ success: false, reason: 'Kayıt servisi geçici olarak kullanılamıyor.' });
    }
  });
}

module.exports = { registerAccountRegistrationRoute };
