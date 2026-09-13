const path = require('path');
const { createJsonStore } = require('../../lib/json_store');

const SYSTEM_CATEGORY_IDS = new Set(['cat_genel', 'cat_fatura', 'cat_muhasebe', 'cat_stok', 'cat_rapor', 'genel', 'default', 'general']);

function registerCatalogRoutes(app, { apiWriteRateLimiter, dataRoot, requireAuth, supabase }) {
  const categoriesStore = createJsonStore(path.join(dataRoot, 'categories.json'), { label: 'Kategori' });
  const snippetsStore = createJsonStore(path.join(dataRoot, 'snippets.json'), { label: 'Sorgu kütüphanesi' });
  const readList = store => {
    const value = store.read();
    return Array.isArray(value) ? value : [];
  };

  app.get('/api/categories', requireAuth, async (req, res) => {
    try {
      if (supabase) {
        const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        return res.json({ success: true, categories: data || [] });
      }
      res.json({ success: true, categories: readList(categoriesStore) });
    } catch (error) {
      res.status(503).json({ success: false, reason: 'Kategoriler alınamadı.' });
    }
  });

  app.post('/api/categories', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const category = req.body;
    if (!category || !category.id) return res.status(400).json({ success: false, reason: 'Kategori ID gereklidir.' });
    const row = {
      id: String(category.id).slice(0, 100), name: String(category.name || 'Genel').slice(0, 150),
      color: String(category.color || '#3b82f6').slice(0, 50), icon: String(category.icon || 'folder').slice(0, 50),
      created_at: category.created_at || new Date().toISOString()
    };
    try {
      if (supabase) {
        const { error } = await supabase.from('categories').upsert(row, { onConflict: 'id' });
        if (error) throw error;
      } else {
        const categories = readList(categoriesStore);
        const index = categories.findIndex(item => item.id === row.id);
        if (index >= 0) categories[index] = row; else categories.push(row);
        categoriesStore.write(categories);
      }
      res.json({ success: true, category: row });
    } catch (error) {
      res.status(503).json({ success: false, reason: 'Kategori kaydedilemedi.' });
    }
  });

  app.delete('/api/categories/:id', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const categoryId = String(req.params.id || '').trim();
    if (SYSTEM_CATEGORY_IDS.has(categoryId.toLowerCase())) {
      return res.status(403).json({ success: false, reason: 'Sistem varsayılan kategorileri silinemez.' });
    }
    try {
      if (supabase) {
        const { error } = await supabase.from('categories').delete().eq('id', categoryId);
        if (error) throw error;
      } else {
        categoriesStore.write(readList(categoriesStore).filter(item => item.id !== categoryId));
      }
      res.json({ success: true });
    } catch (error) {
      res.status(503).json({ success: false, reason: 'Kategori silinemedi.' });
    }
  });

  app.get('/api/snippets', requireAuth, async (req, res) => {
    try {
      if (supabase) {
        const { data, error } = await supabase.from('snippets').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const snippets = (data || []).map(item => ({ id: item.id, title: item.title, sql: item.sql, reportName: item.report_name, category: item.category, createdAt: item.created_at }));
        return res.json({ success: true, snippets });
      }
      res.json({ success: true, snippets: readList(snippetsStore) });
    } catch (error) {
      res.status(503).json({ success: false, reason: 'Sorgular alınamadı.' });
    }
  });

  app.post('/api/snippets', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const snippet = req.body;
    if (!snippet) return res.status(400).json({ success: false, reason: 'Sorgu verisi gereklidir.' });
    const row = {
      id: String(snippet.id || Date.now()), title: String(snippet.title || 'SQL Sorgusu').slice(0, 200), sql: String(snippet.sql || ''),
      report_name: String(snippet.reportName || snippet.report_name || '—').slice(0, 300), category: String(snippet.category || 'Genel').slice(0, 100),
      created_at: snippet.createdAt || snippet.created_at || new Date().toISOString(), updated_at: new Date().toISOString()
    };
    try {
      if (supabase) {
        const { error } = await supabase.from('snippets').upsert(row, { onConflict: 'id' });
        if (error) throw error;
      } else {
        const snippets = readList(snippetsStore);
        const index = snippets.findIndex(item => item.id === row.id);
        if (index >= 0) snippets[index] = row; else snippets.unshift(row);
        snippetsStore.write(snippets);
      }
      res.json({ success: true, snippet: row });
    } catch (error) {
      res.status(503).json({ success: false, reason: 'Sorgu kaydedilemedi.' });
    }
  });

  app.delete('/api/snippets/:id', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const snippetId = String(req.params.id);
    try {
      if (supabase) {
        const { error } = await supabase.from('snippets').delete().eq('id', snippetId);
        if (error) throw error;
      } else {
        snippetsStore.write(readList(snippetsStore).filter(item => item.id !== snippetId));
      }
      res.json({ success: true });
    } catch (error) {
      res.status(503).json({ success: false, reason: 'Sorgu silinemedi.' });
    }
  });
}

module.exports = { registerCatalogRoutes };
