document.addEventListener('click', event => {
 const target = event.target.closest('[data-dashboard-action]');
 if (!target) return;
 if (target.dataset.dashboardAction === 'open-index') window.location.href = 'index.html';
 if (target.dataset.dashboardAction === 'reload') window.location.reload();
 if (target.dataset.dashboardAction === 'filter-table') filterByTable(decodeURIComponent(target.dataset.table || ''));
});
(function() {
'use strict';

// ── ADMİN YETKİ KONTROLÜ (Pentest & Access Control Guard) ──────
function verifyAdminAccess() {
 const isAdmin = window.FrpAuth? window.FrpAuth.isAdmin(): false;
 if (!isAdmin) {
 document.body.innerHTML = `
 <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1020;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:1.5rem;">
 <div style="background:rgba(26,34,53,0.95);border:1px solid rgba(239,68,68,0.4);border-radius:20px;padding:2.5rem 2rem;max-width:440px;box-shadow:0 25px 50px rgba(0,0,0,0.5);">
 <div style="font-size:3.5rem;margin-bottom:.8rem;">️</div>
 <h2 style="font-size:1.35rem;font-weight:800;color:#f87171;margin:0 0.5rem;">Yetkisiz Erişim (403 Forbidden)</h2>
 <p style="font-size:.88rem;color:#94a3b8;line-height:1.6;margin-bottom:1.5rem;">İstatistik ve Analiz Paneli yalnızca <strong>Sistem Yöneticisi (Admin)</strong> yetkisine sahip kullanıcılar tarafından görüntülenebilir.</p>
 <a href="index.html" style="display:inline-block;background:#2563eb;color:#fff;padding:.65rem 1.3rem;border-radius:10px;font-weight:700;font-size:.88rem;text-decoration:none;transition:background.2s;">← Ana Sayfaya Dön</a>
 </div>
 </div>
 `;
 setTimeout(() => { window.location.href = 'index.html'; }, 2200);
 return false;
 }
 return true;
}

if (!verifyAdminAccess()) return;

function esc(s) {
 return String(s || '')
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#39;');
}

function encodeInlineArg(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
window.encodeInlineArg = encodeInlineArg;

function toast(msg, type = 'info') {
  if (window.FrpNotify && typeof window.FrpNotify[type] === 'function') {
    window.FrpNotify[type](msg);
    return;
  }
  if (typeof window.showToast === 'function') {
    window.showToast(msg, type);
    return;
  }
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast-item ' + (type || 'info');
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
window.toast = toast;

function renderDashboard() {
  const wrap = document.getElementById('dashWrap');
  try {
    const files = FrpStore.getAll();

    if (files.length === 0) {
      wrap.innerHTML = `
      <div style="text-align:center;padding:5rem;color:var(--text-muted);">
        <div style="font-size:1.1rem;font-weight:700;color:var(--text-muted);margin-bottom:1rem;">Kayıt Yok</div>
        <div style="font-size:1.1rem;font-weight:600;">Henüz rapor yüklenmedi</div>
        <div style="margin-top:1rem;"><a href="index.html" class="btn btn-primary btn-sm">← Rapora Git</a></div>
      </div>`;
      return;
    }

    // — Hesaplamalar —
    const totalReports = files.length;
    const totalFav = files.filter(f => f.isFavorite).length;
    const totalQueries = files.reduce((a,f) => a + (Array.isArray(f.queries) && f.queries.length > 0 ? f.queries.length : (Number(f.stats?.sqlCount || f.sql_count || f.sqlCount || 0) || 0)), 0);
    const totalPascal = files.filter(f => f.pascalScript).length;

    // SQL Parametre Kullanım Analizi
    const paramUsageMap = {};
    files.forEach(file => {
      (file.queries || []).forEach(q => {
        const fn = window.extractParamsFromSql || (() => []);
        const params = fn(q.sql || '');
        params.forEach(p => {
          if (!paramUsageMap[p]) paramUsageMap[p] = { param: p, count: 0, reports: new Set() };
          paramUsageMap[p].count++;
          paramUsageMap[p].reports.add(file.meta?.reportName || file.name);
        });
      });
    });

    const paramAnalytics = Object.values(paramUsageMap)
      .map(item => ({
        param: item.param,
        count: item.count,
        reportCount: item.reports.size,
        reports: Array.from(item.reports)
      }))
      .sort((a, b) => b.count !== a.count ? b.count - a.count : b.reportCount - a.reportCount);

    const totalParams = paramAnalytics.length;
    const avgQueries = totalReports > 0 ? (totalQueries / totalReports).toFixed(1) : 0;

    // En çok kullanılan tablolar
    const tableUsage = (typeof FrpStore !== 'undefined' && typeof FrpStore.getTableUsage === 'function')
      ? FrpStore.getTableUsage()
      : [];
    const topTables = tableUsage.slice(0, 10).map(t => [t.tableName, t.count]);

    // Kullanıcı Bazlı Rapor Yükleme İstatistiği
    const userUploadMap = {};
    files.forEach(f => {
      const uName = f.ownerName || f.owner_name || f.ownerUsername || (f.userId === 'usr_admin_root' ? 'Admin' : 'Sistem');
      const uDept = f.ownerDepartment || f.owner_department || '';
      const uKey = uName;
      if (!userUploadMap[uKey]) {
        userUploadMap[uKey] = {
          name: uName,
          department: uDept,
          reportCount: 0,
          poolCount: 0,
          sqlCount: 0,
          totalBytes: 0,
          reports: []
        };
      }
      userUploadMap[uKey].reportCount++;
      if (f.isPublic || f.is_public) userUploadMap[uKey].poolCount++;
      const qCount = Array.isArray(f.queries) && f.queries.length > 0 ? f.queries.length : (Number(f.stats?.sqlCount || f.sql_count || f.sqlCount || 0) || 0);
      userUploadMap[uKey].sqlCount += qCount;
      userUploadMap[uKey].totalBytes += Number(f.sizeBytes || f.size) || 0;
      userUploadMap[uKey].reports.push(f.meta?.reportName || f.name);
    });

    const userAnalytics = Object.values(userUploadMap).sort((a, b) => b.reportCount - a.reportCount);
    const maxUserReports = userAnalytics.length > 0 ? userAnalytics[0].reportCount : 1;

    // En Çok SQL Sorgusu İçeren Raporlar
    const topSqlReports = files
      .map(f => ({ name: f.meta?.reportName || f.name, id: f.id, sqlCount: (Array.isArray(f.queries) && f.queries.length > 0 ? f.queries.length : (Number(f.stats?.sqlCount || f.sql_count || f.sqlCount || 0) || 0)) }))
      .sort((a, b) => b.sqlCount - a.sqlCount)
      .slice(0, 8);

    // Aylık yükleme trendi (son 12 ay)
    const monthLabels = [], monthData = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      monthLabels.push(d.toLocaleString('tr-TR', {month:'short', year:'2-digit'}));
      monthData.push(files.filter(f => {
        const fd = new Date(f.loadedAt);
        return fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth();
      }).length);
    }

 // — HTML Render —
 const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

 wrap.innerHTML = `
 <!-- HEADER -->
 <div class="dash-header">
 <div>
 <div class="dash-title"> FrpOku Analiz & İstatistik Paneli</div>
 <div class="dash-sub">Son güncelleme: ${new Date().toLocaleString('tr-TR')}</div>
 </div>
 </div>

 <!-- ÖZET KARTLARI -->
 <div class="dash-cards">
 <div class="dash-card" style="--card-accent:#3b82f6;">
 <div class="dash-card-icon"></div>
 <div class="dash-card-value">${totalReports}</div>
 <div class="dash-card-label">Toplam Rapor</div>
 </div>
 <div class="dash-card" style="--card-accent:#f59e0b;">
 <div class="dash-card-icon">⭐</div>
 <div class="dash-card-value">${totalFav}</div>
 <div class="dash-card-label">Favori</div>
 <div class="dash-card-trend">${totalReports>0?Math.round(totalFav/totalReports*100):0}% oran</div>
 </div>
 <div class="dash-card" style="--card-accent:#10b981;">
 <div class="dash-card-icon">️</div>
 <div class="dash-card-value">${totalQueries}</div>
 <div class="dash-card-label">SQL Sorgusu</div>
 <div class="dash-card-trend">Ortalama: ${avgQueries}/rapor</div>
 </div>
 <div class="dash-card" style="--card-accent:#8b5cf6;">
 <div class="dash-card-icon"></div>
 <div class="dash-card-value">${totalPascal}</div>
 <div class="dash-card-label">Pascal Script</div>
 </div>
 <div class="dash-card" style="--card-accent:#f97316;">
 <div class="dash-card-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></div>
 <div class="dash-card-value">${totalParams}</div>
 <div class="dash-card-label">Benzersiz Parametre</div>
 </div>
 <div class="dash-card" style="--card-accent:#06b6d4;">
 <div class="dash-card-icon"></div>
 <div class="dash-card-value">${FrpStore.getStats().storageFormatted}</div>
 <div class="dash-card-label">Depolama Boyutu</div>
 </div>
 </div>

 <!-- GRAFIKLER -->
 <div class="dash-charts" style="grid-template-columns: 1fr;">
 <!-- Aylık trend -->
 <div class="chart-box">
 <div class="chart-title"> Aylık Rapor Yükleme Trendi</div>
 <canvas id="trendChart" class="chart-canvas" height="220"></canvas>
 </div>
 </div>

 <!-- PARAMETRE ANALİTİĞİ -->
 ${paramAnalytics.length > 0? `
 <div class="dash-table-wrap">
 <div class="dash-table-header">SQL Parametre Kullanım Analitiği (Top ${Math.min(15, paramAnalytics.length)}) <span style="font-size:.72rem;color:var(--text-muted);font-weight:400;">— Hangi parametrenin kaç raporda geçtiğini görün</span></div>
 <table class="dash-tbl">
 <thead><tr><th>#</th><th>Parametre Adı</th><th>Kullanım Sayısı</th><th>Bağımlı Rapor Sayısı</th><th>Örnek Raporlar</th></tr></thead>
 <tbody>
 ${paramAnalytics.slice(0, 15).map((p, i) => `
 <tr>
 <td style="color:var(--text-muted);font-size:.78rem;">${i+1}</td>
 <td><code style="color:var(--orange);font-family:var(--mono);font-weight:700;">${p.param}</code></td>
 <td><strong>${p.count} kez</strong></td>
 <td><span class="badge badge-purple">${p.reportCount} rapor</span></td>
 <td style="font-size:.75rem;color:var(--text-secondary);">${p.reports.slice(0,3).join(', ')}${p.reports.length > 3? '...': ''}</td>
 </tr>
 `).join('')}
 </tbody>
 </table>
 </div>`: ''}

  <!-- KULLANICI BAZLI RAPOR YÜKLEME İSTATİSTİĞİ -->
  ${userAnalytics.length > 0 ? `
  <div class="dash-table-wrap">
    <div class="dash-table-header">
      <span>Kullanıcı Bazlı Rapor Yükleme & Katkı İstatistiği</span>
      <span style="font-size:.72rem;color:var(--text-muted);font-weight:400;">(${userAnalytics.length} Kullanıcı) — Hangi personelin sisteme kaç rapor yüklediğini ve havuza katkısını inceleyin</span>
    </div>
    <table class="dash-tbl">
      <thead>
        <tr>
          <th>#</th>
          <th>Kullanıcı / Personel</th>
          <th>Yüklenen Rapor</th>
          <th>Ortak Havuz Katkısı</th>
          <th>Toplam SQL</th>
          <th>Toplam Boyut</th>
          <th>Dağılım Payı</th>
        </tr>
      </thead>
      <tbody>
        ${userAnalytics.map((u, i) => {
          const pct = Math.round((u.reportCount / totalReports) * 100);
          const sizeStr = u.totalBytes > 1048576 ? (u.totalBytes/1048576).toFixed(1) + ' MB' : (u.totalBytes > 1024 ? Math.round(u.totalBytes/1024) + ' KB' : u.totalBytes + ' B');
          return `
            <tr>
              <td style="color:var(--text-muted);font-size:.78rem;">${i + 1}</td>
              <td>
                <div style="display:flex;align-items:center;gap:.4rem;">
                  <strong style="color:var(--text-primary);">${esc(u.name)}</strong>
                  ${u.department ? `<span class="badge badge-gray" style="font-size:.68rem;">${esc(u.department)}</span>` : ''}
                </div>
              </td>
              <td><strong style="color:var(--accent);">${u.reportCount}</strong> rapor</td>
              <td><span class="badge badge-pool" style="font-size:.72rem;">${u.poolCount} Havuzda</span></td>
              <td><span class="badge badge-blue" style="font-size:.72rem;">${u.sqlCount} SQL</span></td>
              <td style="font-family:var(--mono);font-size:.76rem;color:var(--text-muted);">${sizeStr}</td>
              <td style="min-width:140px;">
                <div class="pbar-wrap">
                  <div class="pbar"><div class="pbar-fill" style="width:${Math.round((u.reportCount / maxUserReports) * 100)}%;background:${CHART_COLORS[i % CHART_COLORS.length]};"></div></div>
                  <span style="font-size:.75rem;color:var(--text-muted);font-weight:700;">%${pct}</span>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

 <!-- EN ÇOK KULLANILAN TABLOLAR -->
 ${topTables.length > 0? `
 <div class="dash-table-wrap">
 <div class="dash-table-header">️ En Çok Kullanılan Veritabanı Tabloları (Top ${topTables.length}) <span style="font-size:.72rem;color:var(--text-muted);font-weight:400;">— Filtrelemek için tabloya tıklayın</span></div>
 <table class="dash-tbl">
 <thead><tr><th>#</th><th>Tablo Adı</th><th>Kullanım</th><th>Oran</th></tr></thead>
 <tbody>
 ${topTables.map(([name, count], i) => `
 <tr style="cursor:pointer;" data-dashboard-action="filter-table" data-table="${encodeInlineArg(name)}" title="${name} tablosunu index.html'de filtrele">
 <td style="color:var(--text-muted);font-size:.78rem;">${i+1}</td>
 <td>️ <strong>${name}</strong></td>
 <td>${count} sorgu</td>
 <td>
 <div class="pbar-wrap">
 <div class="pbar"><div class="pbar-fill" style="width:${Math.round(count/topTables[0][1]*100)}%;background:${CHART_COLORS[i%CHART_COLORS.length]};"></div></div>
 <span style="font-size:.75rem;color:var(--text-muted);">${Math.round(count/topTables[0][1]*100)}%</span>
 </div>
 </td>
 </tr>
 `).join('')}
 </tbody>
 </table>
 </div>`: ''}

 <!-- EN ÇOK SQL SORGUSU İÇEREN RAPORLAR -->
 ${topSqlReports.length > 0? `
 <div class="dash-table-wrap">
 <div class="dash-table-header">️ En Çok SQL Sorgusu İçeren Raporlar</div>
 <table class="dash-tbl">
 <thead><tr><th>#</th><th>Rapor Adı</th><th>SQL Adedi</th><th>Aksiyon</th></tr></thead>
 <tbody>
 ${topSqlReports.map((item, i) => `
 <tr>
 <td style="color:var(--text-muted);font-size:.78rem;">${i+1}</td>
 <td style="font-weight:700;color:var(--text-primary);">${esc(item.name)}</td>
 <td><span class="badge badge-blue">${item.sqlCount} Sorgu</span></td>
 <td><a href="detail.html?id=${item.id}" class="btn btn-sm" style="text-decoration:none;">Detay</a></td>
 </tr>
 `).join('')}
 </tbody>
 </table>
 </div>`: ''}
 `;

  // — Canvas Grafikleri —
  drawTrendChart(document.getElementById('trendChart'), monthLabels, monthData);
  } catch (err) {
    console.error('Dashboard render error:', err);
    if (wrap) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:4rem 1.5rem;color:var(--text-muted);">
          <div style="width:48px;height:48px;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(239,68,68,0.1);color:#ef4444;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--red);">İstatistikler hesaplanırken bir sorun oluştu</div>
          <div style="font-size:.82rem;margin-top:.4rem;color:var(--text-secondary);">${esc(err?.message || 'Bilinmeyen hata')}</div>
          <div style="margin-top:1.5rem;">
            <button class="btn btn-primary btn-sm" data-dashboard-action="reload">Sayfayı Yenile</button>
            <a href="index.html" class="btn btn-ghost btn-sm" style="margin-left:.5rem;">← Rapor Listesine Dön</a>
          </div>
        </div>`;
    }
  }
}

// Bar chart — aylık trend
function drawTrendChart(canvas, labels, data) {
 if (!canvas) return;
 const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
 const W = canvas.offsetWidth || 400;
 canvas.width = W; canvas.height = 220;
 const ctx = canvas.getContext('2d');
 const PAD = { top: 20, right: 20, bottom: 45, left: 35 };
 const cW = W - PAD.left - PAD.right;
 const cH = 220 - PAD.top - PAD.bottom;
 const maxVal = Math.max(...data, 1);
 const GRID = isDark? '#334155': '#e2e8f0';
 const TEXT = isDark? '#94a3b8': '#6b7280';
 const ACCENT = '#3b82f6';

 ctx.clearRect(0, 0, W, 220);

 // Grid lines
 for (let i = 0; i <= 4; i++) {
 const y = PAD.top + cH - (i / 4) * cH;
 ctx.strokeStyle = GRID; ctx.lineWidth = 1;
 ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
 ctx.fillStyle = TEXT; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
 ctx.fillText(Math.round(maxVal * i / 4), PAD.left - 5, y + 3);
 }

 // Bars
 const barW = cW / labels.length * 0.6;
 const gap = cW / labels.length;
 data.forEach((val, i) => {
 const x = PAD.left + i * gap + gap * 0.2;
 const h = (val / maxVal) * cH;
 const y = PAD.top + cH - h;
 // Gradient
 const grad = ctx.createLinearGradient(x, y, x, PAD.top + cH);
 grad.addColorStop(0, ACCENT);
 grad.addColorStop(1, ACCENT + '44');
 ctx.fillStyle = grad;
 // Rounded rect top
 const r = Math.min(4, barW/2, h/2);
 if (h > 0) {
 ctx.beginPath();
 ctx.moveTo(x + r, y);
 ctx.lineTo(x + barW - r, y);
 ctx.arc(x + barW - r, y + r, r, -Math.PI/2, 0);
 ctx.lineTo(x + barW, PAD.top + cH);
 ctx.lineTo(x, PAD.top + cH);
 ctx.arc(x + r, y + r, r, Math.PI, -Math.PI/2);
 ctx.fill();
 }
 // Label
 ctx.fillStyle = TEXT; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
 ctx.fillText(labels[i], x + barW/2, PAD.top + cH + 14);
 if (val > 0) {
 ctx.fillStyle = isDark? '#e2e8f0': '#374151';
 ctx.font = 'bold 9px sans-serif';
 ctx.fillText(val, x + barW/2, y - 4);
 }
 });
}


// Tabloya tıklayınca index.html'e SQL filtresiyle git
function filterByTable(tableName) {
 window.location.href = 'index.html?filter_sql=' + encodeURIComponent(tableName);
}
window.filterByTable = filterByTable;

// Init
async function initDashboard() {
  // Eski oturumlardan kalan çakışma artıklarını localStorage'dan temizle
  try {
    localStorage.removeItem('frpoku_pending_sync');
  } catch (e) {}

  const wrap = document.getElementById('dashWrap');
  if (window.FrpStoreReady) {
    if (wrap) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:5rem;color:var(--text-muted);">
          <div style="font-size:3rem;margin-bottom:1rem;animation:pulse 1.5s infinite;">⏳</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">Rapor Veritabanı Yükleniyor...</div>
          <div style="font-size:.85rem;margin-top:.4rem;">IndexedDB ve önbellek analizi yapılıyor</div>
        </div>`;
    }
    await window.FrpStoreReady;
  }
  renderDashboard();
}

document.getElementById('btnRefresh')?.addEventListener('click', renderDashboard);

// Tema değişince canvas grafikleri yenile
const _themeObserver = new MutationObserver(() => {
 const trendCanvas = document.getElementById('trendChart');
 if (trendCanvas) {
 setTimeout(renderDashboard, 100);
 }
});
_themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

initDashboard();
})();
