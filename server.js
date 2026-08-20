require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ── Kullanıcı Veri Yönetimi & Yerel Yedekleme ─────────────────
const usersJsonPath = path.join(__dirname, 'data', 'users.json');

function hashPassword(plainText) {
  if (!plainText) return '';
  return crypto.createHash('sha256').update(plainText).digest('hex');
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;

// Yerel kullanıcı dosyasını oku / yaz
function getLocalUsers() {
  try {
    if (fs.existsSync(usersJsonPath)) {
      return JSON.parse(fs.readFileSync(usersJsonPath, 'utf8')) || [];
    }
  } catch (e) {
    console.warn('Yerel kullanıcı dosyası okunamadı:', e.message);
  }
  return [];
}

function saveLocalUsers(users) {
  try {
    const dataDir = path.dirname(usersJsonPath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(usersJsonPath, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.warn('Yerel kullanıcı dosyası yazılamadı:', e.message);
  }
}

// Varsayılan Admin Kullanıcısını Güvenceye Al
async function ensureAdminUser() {
  const defaultAdmin = {
    id: 'usr_admin_root',
    username: 'admin',
    password_hash: hashPassword('admin123'),
    email: 'admin@frpoku.com',
    full_name: 'Sistem Yöneticisi (Admin)',
    phone: '05000000000',
    department: 'Bilgi İşlem ve Yönetim',
    role: 'admin',
    is_active: true,
    avatar: '👑',
    created_at: new Date().toISOString(),
    last_login: null
  };

  if (supabase) {
    try {
      const { data: admins } = await supabase
        .from('app_users')
        .select('id, role')
        .eq('role', 'admin')
        .limit(1);

      if (!admins || admins.length === 0) {
        console.log('⚡ Admin kullanıcısı bulunamadı, varsayılan admin oluşturuluyor...');
        await supabase.from('app_users').upsert([defaultAdmin], { onConflict: 'username' });
      }
    } catch (e) {
      console.warn('Supabase admin denetimi hatası:', e.message);
    }
  }

  // Yerel dosyayı da güncelle
  const localUsers = getLocalUsers();
  if (!localUsers.some(u => u.role === 'admin' || u.username === 'admin')) {
    localUsers.unshift(defaultAdmin);
    saveLocalUsers(localUsers);
  }
}
ensureAdminUser();

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// Config endpoint for client-side Supabase connection
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL || '',
    supabaseKey: SUPABASE_KEY || ''
  });
});

// ── 1. YENİ KULLANICI KAYDI (Admin Onayına Gönderme) ─────────
app.post('/api/auth/register', async (req, res) => {
  const { fullName, username, email, phone, department, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  const cleanPhone = (phone || '').trim();

  if (!cleanName || !cleanUser || !cleanEmail || !password) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen zorunlu alanları (Ad Soyad, Kullanıcı Adı, E-Posta, Şifre) eksiksiz doldurunuz.' });
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen geçerli bir e-posta formatı giriniz (Örn: ad.soyad@kurum.com).' });
  }

  if (password.length < 3) {
    return res.status(400).json({ success: false, reason: '⚠️ Şifreniz en az 3 karakter olmalıdır.' });
  }

  try {
    // 1. Mükerrer Kontrolü (Supabase & Local)
    if (supabase) {
      const { data: existingUsers } = await supabase
        .from('app_users')
        .select('id, username, email')
        .or(`email.ilike.${cleanEmail},username.ilike.${cleanUser}`)
        .limit(2);

      if (existingUsers && existingUsers.length > 0) {
        const matchEmail = existingUsers.some(u => (u.email || '').toLowerCase() === cleanEmail);
        if (matchEmail) {
          return res.status(400).json({ success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi zaten kayıtlıdır.` });
        }
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanUser}' kullanıcı adı zaten kullanımda.` });
      }
    } else {
      const localUsers = getLocalUsers();
      if (localUsers.some(u => (u.username || '').toLowerCase() === cleanUser)) {
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanUser}' kullanıcı adı zaten kullanımda.` });
      }
      if (localUsers.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi zaten kayıtlıdır.` });
      }
    }

    const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const newRecord = {
      id: newUserId,
      username: cleanUser,
      password_hash: hashPassword(password),
      email: cleanEmail,
      full_name: cleanName,
      phone: cleanPhone,
      department: (department || 'Bilgi İşlem').trim(),
      role: 'user',
      is_active: false, // Yönetici onayı bekliyor (false = pending)
      avatar: '👤',
      created_at: new Date().toISOString(),
      last_login: null
    };

    if (supabase) {
      const { error: insertErr } = await supabase.from('app_users').insert([newRecord]);
      if (insertErr) {
        console.warn('Supabase insert error, yerel yedeğe yazılıyor:', insertErr.message);
      }
    }

    // Yerel yedeğe de ekle
    const localUsers = getLocalUsers();
    localUsers.unshift(newRecord);
    saveLocalUsers(localUsers);

    console.log(`📌 Yeni Kullanıcı Kaydı Alındı (Admin Onayı Bekliyor): ${cleanUser} (${cleanName})`);

    res.json({
      success: true,
      pendingApproval: true,
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
    console.error('Kayıt hatası:', err.message);
    res.status(500).json({ success: false, reason: 'Kayıt sırasında hata oluştu: ' + err.message });
  }
});

// ── 2. KULLANICI GİRİŞİ (Login) ──────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  const ident = (identifier || '').trim();
  if (!ident || !password) {
    return res.status(400).json({ success: false, reason: 'Lütfen kullanıcı bilgilerinizi ve şifrenizi giriniz.' });
  }

  const cleanIdent = ident.toLowerCase();
  const phoneDigits = ident.replace(/\D/g, '');
  const pHash = hashPassword(password);

  let user = null;

  try {
    if (supabase) {
      let query = supabase.from('app_users').select('*');
      if (cleanIdent.includes('@')) {
        query = query.ilike('email', cleanIdent);
      } else if (phoneDigits.length >= 10) {
        query = query.or(`phone.eq.${phoneDigits},username.ilike.${cleanIdent}`);
      } else {
        query = query.ilike('username', cleanIdent);
      }

      const { data: users, error } = await query.limit(1);
      if (!error && users && users.length > 0) {
        user = users[0];
      }
    }

    // Fallback: Yerel kayıtlar
    if (!user) {
      const localUsers = getLocalUsers();
      user = localUsers.find(u => 
        (u.username || '').toLowerCase() === cleanIdent ||
        (u.email || '').toLowerCase() === cleanIdent ||
        (phoneDigits.length >= 10 && (u.phone || '').replace(/\D/g, '') === phoneDigits)
      );
    }

    if (!user) {
      return res.status(404).json({ success: false, reason: '❌ Girdiğiniz bilgilere ait bir kullanıcı hesabı bulunamadı.' });
    }

    // Şifre denetimi (Hash veya düz metin eski uyumluluğu)
    if (user.password_hash !== pHash && user.password_hash !== password) {
      return res.status(400).json({ success: false, reason: '🔒 Şifreniz hatalı! Lütfen şifrenizi kontrol edip tekrar deneyin.' });
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
      try {
        await supabase.from('app_users').update({ last_login: nowIso }).eq('id', user.id);
      } catch (e) {
        console.warn('Last login update warning:', e.message);
      }
    }
    const localUsers = getLocalUsers();
    const locIdx = localUsers.findIndex(u => u.id === user.id);
    if (locIdx !== -1) {
      localUsers[locIdx].last_login = nowIso;
      saveLocalUsers(localUsers);
    }

    const safeUser = { ...user };
    delete safeUser.password_hash;

    res.json({
      success: true,
      user: safeUser
    });
  } catch (err) {
    console.error('Giriş hatası:', err.message);
    res.status(500).json({ success: false, reason: 'Giriş sırasında hata oluştu: ' + err.message });
  }
});

// ── 3. ADMİN: ONAY BEKLEYEN KULLANICILARI LİSTELE ──────────────
app.get('/api/admin/pending-users', async (req, res) => {
  try {
    let pendingList = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, username, email, full_name, phone, department, role, is_active, created_at, avatar')
        .eq('is_active', false)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        pendingList = data;
      }
    }

    if (pendingList.length === 0) {
      const localUsers = getLocalUsers();
      pendingList = localUsers
        .filter(u => u.is_active === false)
        .map(u => {
          const safe = { ...u };
          delete safe.password_hash;
          return safe;
        });
    }

    res.json({
      success: true,
      count: pendingList.length,
      users: pendingList
    });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Onay bekleyen kullanıcılar alınamadı: ' + err.message });
  }
});

// ── 4. ADMİN: TÜM KULLANICILARI LİSTELE ───────────────────────
app.get('/api/admin/all-users', async (req, res) => {
  try {
    let allUsers = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, username, email, full_name, phone, department, role, is_active, created_at, last_login, avatar')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        allUsers = data;
      }
    }

    if (allUsers.length === 0) {
      const localUsers = getLocalUsers();
      allUsers = localUsers.map(u => {
        const safe = { ...u };
        delete safe.password_hash;
        return safe;
      });
    }

    res.json({
      success: true,
      count: allUsers.length,
      users: allUsers
    });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Kullanıcı listesi alınamadı: ' + err.message });
  }
});

// ── 5. ADMİN: KULLANICIYI ONAYLA (Approve & Activate) ─────────
app.post('/api/admin/approve-user', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği (userId) belirtilmedi.' });
  }

  try {
    const updates = { is_active: true };

    if (supabase) {
      const { error } = await supabase
        .from('app_users')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
    }

    // Yerel kaydı da güncelle
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx] = { ...localUsers[idx], ...updates };
      saveLocalUsers(localUsers);
    }

    console.log(`✅ Kullanıcı Başarıyla Onaylandı: ${userId}`);

    res.json({
      success: true,
      message: 'Kullanıcı hesabı başarıyla onaylandı ve aktifleştirildi.'
    });
  } catch (err) {
    console.error('Onaylama hatası:', err.message);
    res.status(500).json({ success: false, reason: 'Kullanıcı onaylanamadı: ' + err.message });
  }
});

// ── 6. ADMİN: KULLANICIYI REDDET VEYA SİL ────────────────────
app.post('/api/admin/reject-user', async (req, res) => {
  const { userId, deletePermanently = true } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği (userId) belirtilmedi.' });
  }

  try {
    if (deletePermanently) {
      if (supabase) {
        await supabase.from('app_users').delete().eq('id', userId);
      }
      const localUsers = getLocalUsers().filter(u => u.id !== userId);
      saveLocalUsers(localUsers);
      console.log(`🗑️ Kullanıcı Kaydı Silindi / Reddedildi: ${userId}`);
    } else {
      const updates = { is_active: false };
      if (supabase) {
        await supabase.from('app_users').update(updates).eq('id', userId);
      }
      const localUsers = getLocalUsers();
      const idx = localUsers.findIndex(u => u.id === userId);
      if (idx !== -1) {
        localUsers[idx] = { ...localUsers[idx], ...updates };
        saveLocalUsers(localUsers);
      }
    }

    res.json({
      success: true,
      message: deletePermanently ? 'Kayıt başvurusu reddedildi ve silindi.' : 'Kayıt başvurusu reddedildi.'
    });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'İşlem başarısız: ' + err.message });
  }
});

// ── 7. ADMİN: AKTİFLİK DURUMUNU DEĞİŞTİR (Dondur / Aç) ────────
app.post('/api/admin/toggle-status', async (req, res) => {
  const { userId, isActive } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı ID gerekli.' });

  try {
    const updates = { is_active: !!isActive };
    if (supabase) {
      await supabase.from('app_users').update(updates).eq('id', userId);
    }
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx] = { ...localUsers[idx], ...updates };
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, is_active: !!isActive });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 8. ADMİN: ADMIN ROLÜ VER / GERİ AL ────────────────────────
app.post('/api/admin/toggle-admin', async (req, res) => {
  const { userId, makeAdmin } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı ID gerekli.' });

  try {
    const newRole = makeAdmin ? 'admin' : 'user';
    const newAvatar = makeAdmin ? '👑' : '👤';
    if (supabase) {
      await supabase.from('app_users').update({ role: newRole, avatar: newAvatar }).eq('id', userId);
    }
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx].role = newRole;
      localUsers[idx].avatar = newAvatar;
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, role: newRole });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 9. ADMİN: DOĞRUDAN ŞİFRE SIFIRLAMA ────────────────────────
app.post('/api/admin/reset-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword || newPassword.length < 3) {
    return res.status(400).json({ success: false, reason: 'Lütfen en az 3 karakterden oluşan geçerli bir yeni şifre giriniz.' });
  }

  try {
    const passwordHash = hashPassword(newPassword);
    if (supabase) {
      await supabase.from('app_users').update({ password_hash: passwordHash }).eq('id', userId);
    }
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx].password_hash = passwordHash;
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, message: 'Kullanıcı şifresi başarıyla güncellendi.' });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 10. KULLANICI PROFİL VE ŞİFRE GÜNCELLEME (Self) ───────────
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen mevcut ve yeni şifrenizi giriniz.' });
  }

  if (newPassword.length < 3) {
    return res.status(400).json({ success: false, reason: '⚠️ Yeni şifre en az 3 karakter olmalıdır.' });
  }

  try {
    let user = null;
    if (supabase) {
      const { data: users } = await supabase.from('app_users').select('*').eq('id', userId).limit(1);
      if (users && users.length > 0) user = users[0];
    }
    if (!user) {
      user = getLocalUsers().find(u => u.id === userId);
    }

    if (!user) return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });

    const oldHash = hashPassword(oldPassword);
    if (user.password_hash !== oldHash && user.password_hash !== oldPassword) {
      return res.status(400).json({ success: false, reason: '🔒 Mevcut şifrenizi hatalı girdiniz!' });
    }

    const newHash = hashPassword(newPassword);
    if (supabase) {
      await supabase.from('app_users').update({ password_hash: newHash }).eq('id', userId);
    }
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx].password_hash = newHash;
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, message: 'Şifreniz başarıyla değiştirildi.' });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Şifre güncellenemedi: ' + err.message });
  }
});

app.post('/api/auth/update-profile', async (req, res) => {
  const { userId, fullName, phone, department, email, username } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği bulunamadı.' });

  try {
    const updates = {};
    if (fullName) updates.full_name = fullName.trim();
    if (phone !== undefined) updates.phone = (phone || '').trim();
    if (department !== undefined) updates.department = (department || '').trim();
    if (email) updates.email = email.trim().toLowerCase();
    if (username) updates.username = username.trim().toLowerCase();

    if (supabase) {
      await supabase.from('app_users').update(updates).eq('id', userId);
    }
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx] = { ...localUsers[idx], ...updates };
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, user: updates });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── RAPOR DEPOLAMA VE YÖNETİM ENDPOINTLERİ ──────────────────
// Load all reports from Supabase (with fallback to local store.json)
app.get('/api/store/load', async (req, res) => {
  const storePath = path.join(__dirname, 'data', 'store.json');

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const parsedList = data.map(row => row.data || row);
        // Sync local cache
        try {
          const dataDir = path.dirname(storePath);
          if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
          fs.writeFileSync(storePath, JSON.stringify(parsedList, null, 2), 'utf8');
        } catch {}
        return res.json(parsedList);
      }
    } catch (e) {
      console.warn('Supabase okuma hatası, yerel dosyaya dönülüyor:', e.message);
    }
  }

  // Fallback to local store.json
  if (!fs.existsSync(storePath)) return res.json([]);
  try {
    const localData = fs.readFileSync(storePath, 'utf8');
    res.json(JSON.parse(localData));
  } catch {
    res.json([]);
  }
});

// Save / sync reports
app.post('/api/store/save', async (req, res) => {
  const storePath = path.join(__dirname, 'data', 'store.json');
  const tempPath = path.join(__dirname, 'data', 'store.json.tmp');
  const reports = req.body;

  // 1. Save local backup first
  try {
    const dataDir = path.dirname(storePath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(reports, null, 2), 'utf8');
    fs.renameSync(tempPath, storePath);
  } catch (err) {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
  }

  // 2. Sync to Supabase in parallel
  if (supabase && Array.isArray(reports)) {
    try {
      const rows = reports.map(report => {
        const id = report.id || report.fileId || String(Date.now());
        const name = report.name || report.fileName || 'İsimsiz Rapor';
        return {
          id,
          name,
          file_size: report.size || 0,
          category: report.category || '',
          tags: Array.isArray(report.tags) ? report.tags : [],
          is_favorite: !!report.favorite,
          is_pinned: !!report.pinned,
          sql_count: Array.isArray(report.queries) ? report.queries.length : (report.stats?.sqlCount || 0),
          memo_count: Array.isArray(report.memos) ? report.memos.length : (report.stats?.memoCount || 0),
          dataset_count: Array.isArray(report.datasets) ? report.datasets.length : 0,
          page_count: Array.isArray(report.pages) ? report.pages.length : (report.stats?.pageCount || 1),
          has_script: !!(report.pascalScript && report.pascalScript.trim().length > 0),
          data: report,
          updated_at: new Date().toISOString()
        };
      });

      if (rows.length > 0) {
        // Chunk upserts in batches of 100
        for (let i = 0; i < rows.length; i += 100) {
          const chunk = rows.slice(i, i + 100);
          await supabase.from('reports').upsert(chunk, { onConflict: 'id' });
        }
      }
    } catch (e) {
      console.warn('Supabase sync warning:', e.message);
    }
  }

  res.json({ success: true });
});

// Single report delete from Supabase
app.delete('/api/reports/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    try {
      await supabase.from('reports').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase delete error:', e.message);
    }
  }
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`FrpOku Supabase Bulut Sunucusu http://localhost:${PORT} üzerinde çalışıyor.`);
});
