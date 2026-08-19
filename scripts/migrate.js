require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('HATA: SUPABASE_URL veya SUPABASE_KEY .env dosyasında bulunamadı.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function migrate() {
  const storePath = path.join(__dirname, '..', 'data', 'store.json');
  if (!fs.existsSync(storePath)) {
    console.log('store.json dosyası bulunamadı, taşınacak yerel rapor yok.');
    return;
  }

  let reports = [];
  try {
    reports = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  } catch (e) {
    console.error('store.json okunamadı:', e.message);
    return;
  }

  if (!Array.isArray(reports) || reports.length === 0) {
    console.log('store.json içinde aktarılacak rapor bulunmuyor.');
    return;
  }

  console.log(`Toplam ${reports.length} adet yerel rapor Supabase veritabanına aktarılıyor...`);

  for (const report of reports) {
    const id = report.id || report.fileId || String(Date.now());
    const name = report.name || report.fileName || 'İsimsiz Rapor';
    const fileSize = report.size || 0;
    const category = report.category || '';
    const tags = Array.isArray(report.tags) ? report.tags : [];
    const isFavorite = !!report.favorite;
    const isPinned = !!report.pinned;
    const sqlCount = Array.isArray(report.queries) ? report.queries.length : (report.stats?.sqlCount || 0);
    const memoCount = Array.isArray(report.memos) ? report.memos.length : (report.stats?.memoCount || 0);
    const datasetCount = Array.isArray(report.datasets) ? report.datasets.length : 0;
    const pageCount = Array.isArray(report.pages) ? report.pages.length : (report.stats?.pageCount || 1);
    const hasScript = !!(report.pascalScript && report.pascalScript.trim().length > 0);

    const row = {
      id,
      name,
      file_size: fileSize,
      category,
      tags,
      is_favorite: isFavorite,
      is_pinned: isPinned,
      sql_count: sqlCount,
      memo_count: memoCount,
      dataset_count: datasetCount,
      page_count: pageCount,
      has_script: hasScript,
      data: report,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('reports').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error(`❌ "${name}" aktarılamadı:`, error.message);
    } else {
      console.log(`✅ "${name}" başarıyla Supabase'e aktarıldı.`);
    }
  }

  console.log('🎉 Migrasyon tamamlandı!');
}

migrate();
