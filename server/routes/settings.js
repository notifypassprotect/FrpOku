const fs = require('fs');
const path = require('path');

function registerSettingsRoutes(app, deps) {
  const { apiWriteRateLimiter, boundedSetting, plainObject, requireAuth, safeLogStr, settingsPath, supabase } = deps;

  function getUserSettingsFileMap() {
    try {
      if (fs.existsSync(settingsPath)) {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
      }
    } catch {}
    return {};
  }
  
  function saveUserSettingsFileMap(map) {
    try {
      const dir = path.dirname(settingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tempFile = settingsPath + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(map, null, 2), 'utf8');
      fs.renameSync(tempFile, settingsPath);
    } catch {}
  }
  
  app.get('/api/settings', requireAuth, async (req, res) => {
    const userId = String(req.authUser.id);
    const localMap = getUserSettingsFileMap();
    let settings = localMap[userId] || null;
  
    if (supabase) {
      try {
        const { data, error } = await supabase.from('user_settings').select('*').eq('id', userId).limit(1);
        if (!error && data && data[0]) {
          settings = { ...data[0], customTags: data[0].custom_tags || [] };
          // Yerel önbelleğe de senkronize et
          localMap[userId] = settings;
          saveUserSettingsFileMap(localMap);
        }
      } catch (error) {
        console.warn('Supabase ayar yükleme uyarısı (yerel yedek kullanılacak):', safeLogStr(error.message));
      }
    }
  
    res.json({ success: true, settings: settings ? { ...settings, customTags: settings.custom_tags || settings.customTags || [] } : null });
  });
  
  app.patch('/api/settings', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const userId = String(req.authUser.id);
    const localMap = getUserSettingsFileMap();
    let current = localMap[userId] || null;
  
    if (!current && supabase) {
      try {
        const { data, error } = await supabase.from('user_settings').select('*').eq('id', userId).limit(1);
        if (!error && data && data[0]) {
          current = { ...data[0], customTags: data[0].custom_tags || [] };
        }
      } catch {}
    }
    current = current || {};
  
    try {
      const customTagsInput = req.body?.custom_tags ?? req.body?.customTags;
      const row = {
        id: userId,
        theme: boundedSetting(req.body?.theme ?? current.theme, 50, 'light'),
        preferences: plainObject(req.body?.preferences) ? req.body.preferences : (current.preferences || {}),
        recent_reports: Array.isArray(req.body?.recent_reports) ? req.body.recent_reports.slice(0, 100) : (current.recent_reports || []),
        custom_tags: Array.isArray(customTagsInput) ? customTagsInput.slice(0, 100).map(tag => boundedSetting(tag, 100)).filter(Boolean) : (current.custom_tags || []),
        updated_at: new Date().toISOString()
      };
  
      // 1. Yerel dosya deposuna kullanıcı bazlı kaydet
      localMap[userId] = row;
      saveUserSettingsFileMap(localMap);
  
      // 2. Supabase varsa buluta da yaz
      if (supabase) {
        try {
          await supabase.from('user_settings').upsert(row, { onConflict: 'id' });
        } catch (sbErr) {
          console.warn('Supabase ayar kaydetme uyarısı:', safeLogStr(sbErr.message));
        }
      }
  
      res.json({ success: true, settings: { ...row, customTags: row.custom_tags } });
    } catch (error) {
      console.warn('Kullanıcı ayarları kaydedilemedi:', safeLogStr(error.message));
      res.status(500).json({ success: false, reason: 'Kullanıcı ayarları kaydedilemedi.' });
    }
  });
}

module.exports = { registerSettingsRoutes };
