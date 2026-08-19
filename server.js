require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

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
