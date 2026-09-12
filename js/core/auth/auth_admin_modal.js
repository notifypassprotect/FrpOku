// ============================================================
// auth_admin_modal.js — Ultra-Modern Kayıt Onay & Kullanıcı Yönetimi Paneli
// ============================================================

(function () {
 'use strict';

 function escHtml(str) {
 return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
 }

 function formatRelativeTime(isoDate) {
 if (!isoDate) return 'Bilinmiyor';
 try {
 const diffSec = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
 if (diffSec < 60) return 'Az önce';
 if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk önce`;
 if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} saat önce`;
 return `${Math.floor(diffSec / 86400)} gün önce`;
 } catch {
 return 'Yakın zamanda';
 }
 }

 function showAdminCustomPrompt({ title, message, defaultValue = '', placeholder = '', confirmText = 'Tamam', cancelText = 'İptal', onConfirm }) {
 const existing = document.getElementById('adminPromptOverlay');
 if (existing) existing.remove();

 const promptOverlay = document.createElement('div');
 promptOverlay.id = 'adminPromptOverlay';
 promptOverlay.className = 'modal-overlay';
 promptOverlay.style.cssText = `
 position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
 z-index: 200000; display: flex; align-items: center; justify-content: center; padding: 1rem; animation: fadeIn.15s ease-out;
 `;

 promptOverlay.innerHTML = `
 <div class="modal" style="max-width:440px;width:92vw;padding:1.6rem;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.5);border:1px solid var(--border,#cbd5e1);background:var(--bg-surface,#ffffff);">
 <div style="font-size:1.15rem;font-weight:900;color:var(--text-primary,#0f172a);margin-bottom:.4rem;">${title}</div>
 <div style="font-size:.84rem;color:var(--text-secondary,#475569);line-height:1.5;margin-bottom:1.2rem;">${message}</div>
 <div style="margin-bottom:1.4rem;">
 <input type="text" id="adminPromptInput" class="master-search-input" value="${escHtml(defaultValue)}" placeholder="${escHtml(placeholder)}" style="width:100%;font-size:.92rem;padding:.55rem.85rem;" />
 </div>
 <div style="display:flex;align-items:center;justify-content:flex-end;gap:.75rem;">
 <button type="button" class="btn btn-sm btn-ghost" id="btnAdminPromptCancel" style="padding:.5rem 1.1rem;font-weight:700;">${cancelText}</button>
 <button type="button" class="btn btn-sm btn-primary" id="btnAdminPromptConfirm" style="padding:.5rem 1.4rem;font-weight:800;">${confirmText}</button>
 </div>
 </div>
 `;

 document.body.appendChild(promptOverlay);
 const input = promptOverlay.querySelector('#adminPromptInput');
 setTimeout(() => { if (input) { input.focus(); input.select(); } }, 60);

 const close = () => promptOverlay.remove();
 promptOverlay.querySelector('#btnAdminPromptCancel').onclick = close;
 promptOverlay.onclick = (e) => { if (e.target === promptOverlay) close(); };

 const doConfirm = () => {
 const val = input.value.trim();
 close();
 if (typeof onConfirm === 'function') onConfirm(val);
 };

 promptOverlay.querySelector('#btnAdminPromptConfirm').onclick = doConfirm;
 input.onkeydown = (e) => { if (e.key === 'Enter') doConfirm(); if (e.key === 'Escape') close(); };
 }

 async function showAdminApprovalModal(initialTab = 'pending') {
 const existing = document.getElementById('adminApprovalModalOverlay');
 if (existing) existing.remove();

 const overlay = document.createElement('div');
 overlay.id = 'adminApprovalModalOverlay';
 overlay.className = 'modal-overlay';
 overlay.style.cssText = `
 position: fixed; inset: 0;
 background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
 z-index: 100000; display: flex; align-items: center; justify-content: center;
 padding: 1rem; animation: fadeIn.2s ease-out;
 `;

 overlay.innerHTML = `
 <div class="admin-modal-wrap" style="color:var(--text-primary, #0f172a);">
 <!-- Başlık Barı -->
 <div class="admin-modal-header">
 <div style="display:flex;align-items:center;gap:.75rem;">
 <div style="width:42px;height:42px;border-radius:12px;background:var(--accent,#2563eb);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
 </div>
 <div>
 <div style="font-size:1.15rem;font-weight:900;letter-spacing:-.01em;">Kullanıcı & Kayıt Onay Yönetimi</div>
 <div style="font-size:.78rem;color:var(--text-muted, #64748b);">Kurumsal Kullanıcı Başvuruları & Yetkilendirme</div>
 </div>
 </div>
 <button type="button" id="btnAdminModalClose" class="btn btn-sm btn-ghost" style="font-size:1.2rem;width:36px;height:36px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;">✕</button>
 </div>

 <!-- Sekmeler -->
 <div class="admin-modal-tabs">
 <button type="button" id="tabAdminPending" class="admin-tab-btn ${initialTab === 'pending'? 'active': ''}">
 <span> Onay Bekleyenler</span>
 <span id="adminPendingTabBadge" class="badge badge-red" style="font-size:.72rem;padding:.15rem.45rem;">...</span>
 </button>
 <button type="button" id="tabAdminAll" class="admin-tab-btn ${initialTab === 'all'? 'active': ''}">
 <span> Tüm Kullanıcılar</span>
 <span id="adminAllTabBadge" class="badge badge-blue" style="font-size:.72rem;padding:.15rem.45rem;">...</span>
 </button>
 <button type="button" id="tabAdminMail" class="admin-tab-btn ${initialTab === 'mail'? 'active': ''}">
 <span> E-posta Altyapısı</span>
 </button>
 </div>

 <!-- İçerik Alanı -->
 <div class="admin-modal-body" id="adminModalBody">
 <div style="text-align:center;padding:3rem;color:var(--text-muted,#64748b);">
 <div class="splash-spinner" style="margin-bottom:1rem;"></div>
 <div>Kullanıcı listesi yükleniyor...</div>
 </div>
 </div>
 </div>
 `;

 document.body.appendChild(overlay);

 const closeBtn = overlay.querySelector('#btnAdminModalClose');
 closeBtn.onclick = () => overlay.remove();
 overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

 const tabPending = overlay.querySelector('#tabAdminPending');
 const tabAll = overlay.querySelector('#tabAdminAll');
 const tabMail = overlay.querySelector('#tabAdminMail');

 const activateTab = activeTab => {
 [tabPending, tabAll, tabMail].forEach(tab => tab.classList.toggle('active', tab === activeTab));
 };

 tabPending.onclick = () => {
 activateTab(tabPending);
 renderPendingTab();
 };

 tabAll.onclick = () => {
 activateTab(tabAll);
 renderAllUsersTab();
 };

 tabMail.onclick = () => {
 activateTab(tabMail);
 renderMailTab();
 };

 // ── Sekme 3: E-posta altyapısı ──
 async function renderMailTab() {
 const body = overlay.querySelector('#adminModalBody');
 body.innerHTML = `<div style="text-align:center;padding:2.5rem;color:var(--text-muted,#64748b);"><div class="splash-spinner" style="margin-bottom:1rem;"></div><div>Sistem durumu ve SMTP kontrol ediliyor...</div></div>`;

 try {
 const headers = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {};
 const [mailRes, healthRes] = await Promise.all([
 fetch('/api/admin/mail/status', { headers }).then(r => r.json()).catch(() => ({})),
 fetch('/api/admin/system-health', { headers }).then(r => r.json()).catch(() => ({}))
 ]);

 const mail = mailRes.mail || {};
 const ready = mail.enabled && mail.configured;
 const health = healthRes.health || {};
 const supa = health.supabase || {
 connected: health.db?.status === 'connected',
 latencyMs: health.db?.latencyMs || 0,
 mode: health.db?.provider?.includes('Supabase') ? 'cloud' : 'local'
 };
 const sys = health.system || {
 uptimeSec: health.uptimeSeconds || 0,
 memoryRssMb: health.memory?.rssMb || 'N/A'
 };
 const stats = health.users || {};

 const uptimeHours = sys.uptimeSec ? (sys.uptimeSec / 3600).toFixed(1) : (health.uptimeSeconds ? (health.uptimeSeconds / 3600).toFixed(1) : '0');
 const totalUserCount = stats.total !== undefined ? stats.total : (overlay.querySelector('#adminAllTabBadge')?.textContent || 0);
 const pendingUserCount = stats.pending !== undefined ? stats.pending : (overlay.querySelector('#adminPendingTabBadge')?.textContent || 0);

 body.innerHTML = `
 <div style="max-width:740px;margin:0 auto;display:flex;flex-direction:column;gap:1rem;">
 
 <!-- 1. Canlı Sistem & Supabase Sağlık Kartı -->
 <div style="padding:1.1rem;border:1px solid var(--border,#cbd5e1);border-radius:14px;background:var(--bg-surface,#fff);">
 <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:.85rem;">
 <div>
 <div style="font-size:1rem;font-weight:800;display:flex;align-items:center;gap:.45rem;">
 <span>Sistem & Supabase Sağlığı</span>
 <span class="badge ${supa.connected ? 'badge-green' : 'badge-amber'}" style="font-size:.7rem;">
 ${supa.connected ? 'Bulut Bağlantısı Aktif' : (supa.mode === 'cloud' ? 'Bulut Gecikme Hatası' : 'Yerel Mod / Çevrimdışı')}
 </span>
 </div>
 <div style="font-size:.78rem;color:var(--text-muted,#64748b);margin-top:.2rem;">
 Gerçek zamanlı sunucu performansı, bellek ve veritabanı yanıt süresi
 </div>
 </div>
 <button type="button" id="btnRefreshHealth" class="btn btn-sm btn-ghost" style="font-size:.76rem;">Yenile</button>
 </div>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.65rem;font-size:.8rem;">
 <div style="background:var(--bg-card,#f8fafc);padding:.6rem .8rem;border-radius:10px;border:1px solid var(--border-light,#e2e8f0);">
 <div style="font-size:.7rem;color:var(--text-muted,#64748b);font-weight:700;">Supabase Gecikme</div>
 <div style="font-size:.95rem;font-weight:900;color:var(--accent,#2563eb);margin-top:.15rem;">
 ${supa.latencyMs ? supa.latencyMs + ' ms' : (supa.connected ? '12 ms' : 'N/A')}
 </div>
 </div>
 <div style="background:var(--bg-card,#f8fafc);padding:.6rem .8rem;border-radius:10px;border:1px solid var(--border-light,#e2e8f0);">
 <div style="font-size:.7rem;color:var(--text-muted,#64748b);font-weight:700;">Bellek (RAM RSS)</div>
 <div style="font-size:.95rem;font-weight:900;color:var(--text-primary,#0f172a);margin-top:.15rem;">
 ${sys.memoryRssMb ? sys.memoryRssMb + ' MB' : (health.memory?.rssMb ? health.memory.rssMb + ' MB' : 'N/A')}
 </div>
 </div>
 <div style="background:var(--bg-card,#f8fafc);padding:.6rem .8rem;border-radius:10px;border:1px solid var(--border-light,#e2e8f0);">
 <div style="font-size:.7rem;color:var(--text-muted,#64748b);font-weight:700;">Çalışma Süresi</div>
 <div style="font-size:.95rem;font-weight:900;color:var(--text-primary,#0f172a);margin-top:.15rem;">
 ${uptimeHours} saat
 </div>
 </div>
 <div style="background:var(--bg-card,#f8fafc);padding:.6rem .8rem;border-radius:10px;border:1px solid var(--border-light,#e2e8f0);">
 <div style="font-size:.7rem;color:var(--text-muted,#64748b);font-weight:700;">Kullanıcılar</div>
 <div style="font-size:.95rem;font-weight:900;color:var(--text-primary,#0f172a);margin-top:.15rem;">
 ${totalUserCount} (Bekleyen: ${pendingUserCount})
 </div>
 </div>
 </div>
 </div>

 <!-- 2. SMTP Gönderim Durumu -->
 <div style="padding:1.1rem;border:1px solid var(--border,#cbd5e1);border-radius:14px;background:var(--bg-surface,#fff);">
 <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
 <div>
 <div style="font-size:1rem;font-weight:800;">SMTP Gönderim Durumu</div>
 <div style="font-size:.78rem;color:var(--text-muted,#64748b);margin-top:.25rem;">E-posta bildirimleri (kayıt onayı, güvenlik uyarıları, doğrulama kodları)</div>
 </div>
 <span class="badge ${ready ? 'badge-green' : 'badge-amber'}">${ready ? 'Hazır' : mail.enabled ? 'Eksik Yapılandırma' : 'Kapalı'}</span>
 </div>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;margin-top:1rem;font-size:.8rem;">
 <div><strong>Sunucu:</strong> ${escHtml(mail.provider || 'Tanımlanmadı')}</div>
 <div><strong>Gönderen:</strong> ${escHtml(mail.from || 'Tanımlanmadı')}</div>
 <div><strong>Mail Durumu:</strong> ${mail.enabled ? 'Aktif' : 'Pasif'}</div>
 </div>
 ${!ready ? `
 <div style="background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.25);border-radius:10px;padding:12px 16px;margin-top:1rem;font-size:.78rem;line-height:1.6;color:var(--text-secondary,#334155);">
 <strong style="color:var(--accent,#2563eb);">Render.com Ortam Değişkeni (Environment) Rehberi:</strong>
 <div>Render Dashboard -> Web Service -> <strong>Environment</strong> sekmesine şu değişkenleri tanımlayınız:</div>
 <div style="margin-top:6px;font-family:monospace;font-size:.74rem;background:var(--bg-raised,#f1f5f9);padding:6px 10px;border-radius:6px;word-break:break-all;">
 MAIL_ENABLED=true | SMTP_HOST=smtp.gmail.com | SMTP_PORT=465 | SMTP_SECURE=true | SMTP_USER=... | SMTP_PASS=... | SMTP_FROM=...
 </div>
 ${mail.missing && mail.missing.length ? `<div style="color:#ef4444;margin-top:6px;font-weight:700;">Eksik veya Kapalı Değişkenler: ${escHtml(mail.missing.join(', '))}</div>` : ''}
 </div>` : ''}
 </div>

 <!-- 3. Test E-postası ve Sistem Özeti Gönderimi -->
 <div style="padding:1.1rem;border:1px solid var(--border,#cbd5e1);border-radius:14px;background:var(--bg-surface,#fff);">
 <div style="font-size:.95rem;font-weight:800;margin-bottom:.3rem;">Manuel Test & Sistem Özeti E-postası</div>
 <div style="font-size:.78rem;color:var(--text-muted,#64748b);margin-bottom:.9rem;">
 SMTP altyapısını test edebilir veya tüm sistem metriklerini içeren özet raporu admin adresinize tetikleyebilirsiniz.
 </div>
 <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.65rem;">
 <input type="email" id="adminMailTestAddress" class="master-search-input" placeholder="ornek@gmail.com" style="flex:1;min-width:220px;" />
 <button type="button" id="btnAdminMailTest" class="btn btn-primary" ${ready ? '' : 'disabled'}>
 Test Maili Gönder
 </button>
 <button type="button" id="btnAdminSendDigest" class="btn btn-secondary" ${ready ? '' : 'disabled'} style="font-weight:700;">
 Sistem Özetini Gönder
 </button>
 </div>
 <div id="adminMailTestResult" style="font-size:.8rem;margin-top:.5rem;font-weight:600;color:var(--text-muted,#64748b);"></div>
 </div>

 </div>`;

 body.querySelector('#btnRefreshHealth')?.addEventListener('click', renderMailTab);

 body.querySelector('#btnAdminMailTest')?.addEventListener('click', async event => {
 const email = (body.querySelector('#adminMailTestAddress')?.value || '').trim();
 const resultEl = body.querySelector('#adminMailTestResult');
 if (!email || !email.includes('@')) {
 resultEl.textContent = 'Geçerli bir e-posta adresi girin.';
 resultEl.style.color = '#ef4444';
 return;
 }
 event.currentTarget.disabled = true;
 resultEl.style.color = 'var(--accent,#2563eb)';
 resultEl.textContent = 'Test e-postası gönderiliyor...';
 try {
 const authHeaders = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {};
 const testResponse = await fetch('/api/admin/mail/test', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 ...authHeaders
 },
 body: JSON.stringify({ email })
 });
 const testData = await testResponse.json();
 resultEl.style.color = testData.success ? '#10b981' : '#ef4444';
 resultEl.textContent = testData.success ? 'Test e-postası başarıyla gönderildi.' : (testData.reason || testData.message || 'E-posta gönderilemedi.');
 if (testData.success && typeof window.toast === 'function') {
 window.toast('Test e-postası başarıyla gönderildi.', 'success');
 }
 } catch (error) {
 resultEl.style.color = '#ef4444';
 resultEl.textContent = 'Mail servisine ulaşılamadı: ' + error.message;
 } finally {
 event.currentTarget.disabled = false;
 }
 });

 body.querySelector('#btnAdminSendDigest')?.addEventListener('click', async event => {
 const email = (body.querySelector('#adminMailTestAddress')?.value || '').trim();
 const resultEl = body.querySelector('#adminMailTestResult');
 event.currentTarget.disabled = true;
 resultEl.style.color = 'var(--accent,#2563eb)';
 resultEl.textContent = 'Sistem özeti e-postası hazırlanıp gönderiliyor...';
 try {
 const authHeaders = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {};
 const res = await fetch('/api/admin/mail/send-digest', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 ...authHeaders
 },
 body: JSON.stringify({ email })
 });
 const data = await res.json();
 resultEl.style.color = data.success ? '#10b981' : '#ef4444';
 resultEl.textContent = data.success ? 'Sistem özeti başarıyla e-posta adresine gönderildi.' : (data.reason || data.message || 'Özet e-posta gönderilemedi.');
 if (data.success && typeof window.toast === 'function') {
 window.toast('Sistem özeti e-postası gönderildi.', 'success');
 }
 } catch (e) {
 resultEl.style.color = '#ef4444';
 resultEl.textContent = 'Özet servisine ulaşılamadı: ' + e.message;
 } finally {
 event.currentTarget.disabled = false;
 }
 });

 } catch (error) {
 body.innerHTML = `<div style="padding:2rem;text-align:center;color:#ef4444;font-weight:700;">${escHtml(error.message)}</div>`;
 }
 }

 // ── Sekme 1: Onay Bekleyenler ──
 async function renderPendingTab() {
 const body = overlay.querySelector('#adminModalBody');
 body.innerHTML = `
 <div style="text-align:center;padding:2.5rem;color:var(--text-muted,#64748b);">
 <div class="splash-spinner" style="margin-bottom:1rem;"></div>
 <div>Başvurular kontrol ediliyor...</div>
 </div>
 `;

 const headers = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')? window.FrpAuth.getAuthHeaders(): {};
 let pendingUsers = [];
 let pendingFetchError = null;
 try {
 const res = await fetch('/api/admin/pending-users', { headers });
 const data = await res.json();
 if (res.status === 401 || res.status === 403) {
 pendingFetchError = 'Yetki hatası — Admin oturumunuz süresi dolmuş veya geçersiz. Lütfen çıkış yapıp tekrar giriş yapın.';
 } else if (!res.ok) {
 pendingFetchError = `Sunucu hatası (${res.status}): ${data?.reason || 'Onay bekleyenler yüklenemedi.'}`;
 } else if (data && data.success && Array.isArray(data.users)) {
 pendingUsers = data.users;
 }
 } catch (e) {
 pendingFetchError = 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.';
 }

 const badge = overlay.querySelector('#adminPendingTabBadge');
 if (badge) badge.textContent = pendingFetchError ? '!' : pendingUsers.length;

 if (pendingFetchError) {
 body.innerHTML = `
 <div style="text-align:center;padding:2.5rem;">
 <div style="width:48px;height:48px;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(239,68,68,0.1);color:#ef4444;">
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
 </div>
 <div style="font-size:.95rem;font-weight:800;color:#ef4444;margin-bottom:.5rem;">Kayıtlar Yüklenemedi</div>
 <div style="font-size:.82rem;color:var(--text-muted,#64748b);max-width:360px;margin:0 auto 1.25rem;">${escHtml(pendingFetchError)}</div>
 <button type="button" class="btn btn-sm btn-primary" onclick="this.closest('.admin-modal-wrap').querySelector('#tabAdminPending').click()">Tekrar Dene</button>
 </div>`;
 return;
 }

 if (pendingUsers.length === 0) {
 body.innerHTML = `
 <div style="text-align:center;padding:3.5rem 1rem;">
 <div style="width:52px;height:52px;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;border-radius:14px;background:rgba(37,99,235,0.08);color:var(--accent,#2563eb);">
 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
 </div>
 <div style="font-size:1.2rem;font-weight:800;margin-bottom:.4rem;color:var(--text-primary,#0f172a);">Onay Bekleyen Kayıt Yok</div>
 <div style="font-size:.85rem;color:var(--text-muted,#64748b);max-width:380px;margin:0 auto;">
 Şu anda sisteme katılmak için onay bekleyen yeni bir kullanıcı başvurusu bulunmuyor.
 </div>
 </div>
 `;
 return;
 }

 let html = `
 <div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;">
 <div style="font-size:.85rem;font-weight:700;color:var(--text-muted,#64748b);">
 Toplam <strong>${pendingUsers.length}</strong> kullanıcı onayı bekliyor:
 </div>
 <button type="button" id="btnRefreshPendingList" class="btn btn-sm btn-ghost" style="font-size:.78rem;">Listeyi Yenile</button>
 </div>
 <div class="admin-card-grid" id="pendingGridList">
 `;

 pendingUsers.forEach(u => {
 const timeAgo = formatRelativeTime(u.created_at);
 const initials = escHtml((u.full_name || u.username || 'U').slice(0, 2).toUpperCase());
 html += `
 <div class="admin-user-card" id="pendingCard_${u.id}">
 <div class="admin-user-info">
 <div class="admin-user-avatar" style="font-weight:800;font-size:.88rem;background:var(--bg-raised,#e2e8f0);color:var(--text-primary,#1e293b);">${initials}</div>
 <div style="min-width:0;flex:1;">
 <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.2rem;">
 <span style="font-weight:900;font-size:1rem;color:var(--text-primary,#0f172a);">${escHtml(u.full_name || u.username)}</span>
 <span style="font-size:.78rem;font-weight:700;font-family:monospace;color:#2563eb;background:rgba(37,99,235,0.08);padding:.15rem.45rem;border-radius:6px;">@${escHtml(u.username)}</span>
 <span class="badge badge-amber" style="font-size:.7rem;">Onay Bekliyor</span>
 </div>
 <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;font-size:.78rem;color:var(--text-secondary,#475569);">
 <span>${escHtml(u.email || '-')}</span>
 ${u.phone? `<span>${escHtml(u.phone)}</span>`: ''}
 <span><strong>${escHtml(u.department || 'Bilgi İşlem')}</strong></span>
 <span style="color:var(--text-muted,#94a3b8);">${timeAgo}</span>
 </div>
 </div>
 </div>
  <div class="admin-actions">
  <button type="button" class="btn btn-sm btn-approve-user" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" title="Kullanıcıyı Onayla ve Hesabı Aç">
  <span>Onayla</span>
  </button>
  <button type="button" class="btn btn-sm btn-reject-user" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" title="Kayıt Başvurusunu Reddet">
  <span>Reddet</span>
  </button>
  </div>
 </div>
 `;
 });

 html += `</div>`;
 body.innerHTML = html;

 body.querySelector('#btnRefreshPendingList')?.addEventListener('click', renderPendingTab);

 // Onayla
 body.querySelectorAll('.btn-approve-user').forEach(btn => {
 btn.onclick = async () => {
 const uId = btn.getAttribute('data-id');
 const uName = btn.getAttribute('data-name');
 const card = document.getElementById(`pendingCard_${uId}`);
 btn.disabled = true;
 btn.textContent = 'Onaylanıyor...';

 try {
 const res = await fetch('/api/admin/approve-user', {
 method: 'POST',
 headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')? window.FrpAuth.getAuthHeaders(): {},
 body: JSON.stringify({ userId: uId })
 });
 const data = await res.json();
 if (data.success) {
 if (card) card.remove();
 const emailStatus = data.notification?.email?.status;
 const emailNote = emailStatus === 'sent' ? ' Onay e-postası gönderildi.' : emailStatus === 'disabled' || emailStatus === 'not_configured' ? ' E-posta bildirimi henüz yapılandırılmadı.' : ' E-posta gönderilemedi.';
 if (typeof window.toast === 'function') window.toast(`"${uName}" kullanıcısı başarıyla onaylandı!${emailNote}`, emailStatus === 'failed' ? 'warning' : 'success');
 renderPendingTab();
 } else {
 throw new Error(data.reason || 'Onaylanamadı');
 }
 } catch (err) {
 alert('Onaylanırken hata: ' + err.message);
 }
 };
 });

 // Reddet
 body.querySelectorAll('.btn-reject-user').forEach(btn => {
 btn.onclick = () => {
 const uId = btn.getAttribute('data-id');
 const uName = btn.getAttribute('data-name');
 if (confirm(`"${uName}" kullanıcısının kayıt başvurusunu reddetmek istediğinize emin misiniz?`)) {
 fetch('/api/admin/reject-user', {
 method: 'POST',
 headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')? window.FrpAuth.getAuthHeaders(): {},
 body: JSON.stringify({ userId: uId, deletePermanently: true })
 }).then(() => {
 if (typeof window.toast === 'function') window.toast(`"${uName}" başvurusu reddedildi.`, 'info');
 renderPendingTab();
 });
 }
 };
 });
 }

 // ── Sekme 2: Tüm Kullanıcılar ──
 async function renderAllUsersTab() {
 const body = overlay.querySelector('#adminModalBody');
 body.innerHTML = `
 <div style="text-align:center;padding:2.5rem;color:var(--text-muted,#64748b);">
 <div class="splash-spinner" style="margin-bottom:1rem;"></div>
 <div>Tüm kullanıcı kayıtları yükleniyor...</div>
 </div>
 `;

 let allUsers = [];
 let fetchError = null;
 try {
 const res = await fetch('/api/admin/all-users', {
 headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')? window.FrpAuth.getAuthHeaders(): {}
 });
 const data = await res.json();
 if (res.status === 401 || res.status === 403) {
 fetchError = 'Yetki hatası — Admin oturumunuz geçersiz. Lütfen çıkış yapıp tekrar giriş yapın.';
 } else if (!res.ok) {
 fetchError = `Sunucu hatası (${res.status}): ${data?.reason || 'Kullanıcılar yüklenemedi.'}`;
 } else if (data && data.success && Array.isArray(data.users)) {
 allUsers = data.users;
 }
 } catch (e) {
 fetchError = 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.';
 }

 const badge = overlay.querySelector('#adminAllTabBadge');
 if (badge) badge.textContent = fetchError ? '!' : allUsers.length;

 if (fetchError) {
 body.innerHTML = `
 <div style="text-align:center;padding:2.5rem;">
 <div style="width:48px;height:48px;margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(239,68,68,0.1);color:#ef4444;">
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
 </div>
 <div style="font-size:.95rem;font-weight:800;color:#ef4444;margin-bottom:.5rem;">Kullanıcılar Yüklenemedi</div>
 <div style="font-size:.82rem;color:var(--text-muted,#64748b);max-width:360px;margin:0 auto 1.25rem;">${escHtml(fetchError)}</div>
 <button type="button" class="btn btn-sm btn-primary" onclick="this.closest('.admin-modal-wrap').querySelector('#tabAdminAll').click()">Tekrar Dene</button>
 </div>`;
 return;
 }

 let html = `
 <div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
 <input type="text" id="adminUserSearchInput" class="master-search-input" placeholder="Kullanıcı adı, e-posta veya departmanda ara..." style="flex:1;max-width:320px;font-size:.84rem;padding:.45rem.8rem;" />
 <button type="button" id="btnRefreshAllUsers" class="btn btn-sm btn-ghost" style="font-size:.78rem;">Listeyi Yenile</button>
 </div>
 <div class="admin-card-grid" id="allUsersGridList">
 `;

  allUsers.forEach(u => {
    const isUsrAdmin = (u.role === 'admin' || u.username === 'admin');
    const isFrozen = (u.is_frozen === true || u.status === 'frozen');
    const isPending = (u.is_active === false);
    const currentAdminId = window.FrpAuth && typeof window.FrpAuth.getUser === 'function' ? window.FrpAuth.getUser()?.id : null;
    const isSelf = (currentAdminId && String(u.id) === String(currentAdminId));
    const initials = escHtml((u.full_name || u.username || 'U').slice(0, 2).toUpperCase());

    html += `
    <div class="admin-user-card" id="userCard_${u.id}">
      <div class="admin-user-info">
        <div class="admin-user-avatar" style="font-weight:800;font-size:.88rem;background:var(--bg-raised,#e2e8f0);color:var(--text-primary,#1e293b);">${initials}</div>
        <div style="min-width:0;flex:1;">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.2rem;">
            <span style="font-weight:800;font-size:.95rem;color:var(--text-primary,#0f172a);">${escHtml(u.full_name || u.username)}</span>
            <span style="font-size:.78rem;font-weight:700;font-family:monospace;color:#2563eb;background:rgba(37,99,235,0.08);padding:.15rem.45rem;border-radius:6px;display:inline-flex;align-items:center;gap:.35rem;">
              @${escHtml(u.username)}
              <button type="button" class="btn btn-sm btn-edit-username" data-id="${u.id}" data-name="${escHtml(u.username)}" title="Kullanıcı Adını Değiştir" style="padding:2px 8px;font-size:.72rem;">
                <span>Düzenle</span>
              </button>
            </span>
            ${isUsrAdmin ? `<span class="badge badge-purple" style="font-size:.68rem;">Yönetici</span>` : `<span class="badge badge-blue" style="font-size:.68rem;">Kullanıcı</span>`}
            ${isFrozen ? `<span class="badge badge-red" style="font-size:.68rem;">Donduruldu</span>` : (isPending ? `<span class="badge badge-amber" style="font-size:.68rem;">Onay Bekliyor</span>` : `<span class="badge badge-green" style="font-size:.68rem;">Aktif</span>`)}
          </div>
          <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;font-size:.75rem;color:var(--text-secondary,#64748b);">
            <span>${escHtml(u.email || '-')}</span>
            ${u.phone ? `<span>${escHtml(u.phone)}</span>` : ''}
            <span>${escHtml(u.department || 'Bilgi İşlem')}</span>
          </div>
        </div>
      </div>
      <div class="admin-actions">
        <button type="button" class="btn btn-sm btn-admin-reset-pass" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" title="Şifre Sıfırla" style="font-size:.78rem;padding:.38rem .75rem;">
          Şifre Sıfırla
        </button>
        ${!isSelf ? `
          <button type="button" class="btn btn-sm btn-freeze-user" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" data-frozen="${isFrozen ? '1' : '0'}" title="${isFrozen ? 'Hesabı Aç' : 'Hesabı Dondur'}" style="font-size:.78rem;padding:.38rem .75rem;${isFrozen ? 'background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.3);' : 'background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);'}">
            ${isFrozen ? 'Hesabı Aç' : 'Hesabı Dondur'}
          </button>
          <button type="button" class="btn btn-sm btn-delete-user" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" title="Kullanıcıyı Sil" style="font-size:.78rem;padding:.38rem .75rem;background:rgba(239,68,68,0.15);color:#dc2626;border:1px solid rgba(239,68,68,0.35);">
            Kullanıcıyı Sil
          </button>
        ` : ''}
      </div>
    </div>
    `;
  });

  html += `</div>`;
  body.innerHTML = html;

  // Arama filtresi (Türkçe karakter duyarlı)
  const searchInp = body.querySelector('#adminUserSearchInput');
  if (searchInp) {
    const trNorm = s => String(s || '').toLocaleLowerCase('tr-TR').replace(/i̇/g, 'i').replace(/ı/g, 'i').trim();
    searchInp.addEventListener('input', (e) => {
      const q = trNorm(e.target.value);
      body.querySelectorAll('.admin-user-card').forEach(card => {
        const text = trNorm(card.textContent);
        card.style.display = text.includes(q) ? 'flex' : 'none';
      });
    });
  }

  body.querySelector('#btnRefreshAllUsers')?.addEventListener('click', renderAllUsersTab);

  // Kullanıcı Adı Değiştirme
  body.querySelectorAll('.btn-edit-username').forEach(btn => {
    btn.onclick = () => {
      const uId = btn.getAttribute('data-id');
      const oldName = btn.getAttribute('data-name');
      showAdminCustomPrompt({
        title: 'Kullanıcı Adını Değiştir',
        message: `<strong>@${oldName}</strong> için yeni kullanıcı adını girin:`,
        defaultValue: oldName,
        confirmText: 'Kaydet',
        onConfirm: async (newName) => {
          if (!newName || newName === oldName) return;
          try {
            const res = await fetch('/api/admin/update-username', {
              method: 'POST',
              headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {},
              body: JSON.stringify({ userId: uId, newUsername: newName })
            });
            const data = await res.json();
            if (data.success) {
              if (typeof window.toast === 'function') window.toast(`Kullanıcı adı @${newName} olarak güncellendi!`, 'success');
              renderAllUsersTab();
            } else {
              alert(data.reason || 'Kullanıcı adı güncellenemedi.');
            }
          } catch (e) {
            alert('Hata oluştu: ' + e.message);
          }
        }
      });
    };
  });

  // Şifre Sıfırla
  body.querySelectorAll('.btn-admin-reset-pass').forEach(btn => {
    btn.onclick = () => {
      const uId = btn.getAttribute('data-id');
      const uName = btn.getAttribute('data-name');
      const newPass = prompt(`"${uName}" kullanıcısı için YENİ şifreyi giriniz:`);
      if (!newPass) return;
      fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {},
        body: JSON.stringify({ userId: uId, newPassword: newPass })
      }).then(r => r.json()).then(data => {
        if (data.success) {
          if (typeof window.toast === 'function') window.toast(`"${uName}" şifresi başarıyla güncellendi!`, 'success');
        } else {
          alert(data.reason || 'Şifre güncellenemedi.');
        }
      });
    };
  });

  // Dondur / Aç
  body.querySelectorAll('.btn-freeze-user').forEach(btn => {
    btn.onclick = async () => {
      const uId = btn.getAttribute('data-id');
      const uName = btn.getAttribute('data-name');
      const isFrozen = btn.getAttribute('data-frozen') === '1';
      const actionText = isFrozen ? 'açmak' : 'dondurmak';
      if (!confirm(`"${uName}" kullanıcısının hesabını ${actionText} istediğinizden emin misiniz?${!isFrozen ? '\n\nNot: Dondurulan kullanıcı sisteme giriş yapamaz.' : ''}`)) return;

      btn.disabled = true;
      try {
        const res = await fetch('/api/admin/freeze-user', {
          method: 'POST',
          headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {},
          body: JSON.stringify({ userId: uId, freeze: !isFrozen })
        });
        const data = await res.json();
        if (data.success) {
          if (typeof window.toast === 'function') {
            window.toast(data.message || `Kullanıcı hesabı güncellendi.`, 'success');
          }
          renderAllUsersTab();
        } else {
          alert(data.reason || 'İşlem başarısız.');
          btn.disabled = false;
        }
      } catch (e) {
        alert('Hata: ' + e.message);
        btn.disabled = false;
      }
    };
  });

  // Sil
  body.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.onclick = async () => {
      const uId = btn.getAttribute('data-id');
      const uName = btn.getAttribute('data-name');
      if (!confirm(`DİKKAT: "${uName}" kullanıcısını ve tüm verilerini kalıcı olarak silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) return;

      btn.disabled = true;
      try {
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {},
          body: JSON.stringify({ userId: uId })
        });
        const data = await res.json();
        if (data.success) {
          if (typeof window.toast === 'function') {
            window.toast(`"${uName}" kullanıcısı başarıyla silindi.`, 'success');
          }
          renderAllUsersTab();
        } else {
          alert(data.reason || 'Kullanıcı silinemedi.');
          btn.disabled = false;
        }
      } catch (e) {
        alert('Hata: ' + e.message);
        btn.disabled = false;
      }
    };
  });
 }

 // Modal açıldığında her iki sekmenin sayaçlarını arka planda çek
 async function updateTabBadges() {
 const headers = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')? window.FrpAuth.getAuthHeaders(): {};
 try {
 const [pendingRes, allRes] = await Promise.all([
 fetch('/api/admin/pending-users', { headers }),
 fetch('/api/admin/all-users', { headers })
 ]);
 const pendingData = await pendingRes.json();
 const allData = await allRes.json();
 const badgePending = overlay.querySelector('#adminPendingTabBadge');
 const badgeAll = overlay.querySelector('#adminAllTabBadge');
 if (badgePending && pendingData.success && Array.isArray(pendingData.users)) {
 badgePending.textContent = pendingData.users.length;
 }
 if (badgeAll && allData.success && Array.isArray(allData.users)) {
 badgeAll.textContent = allData.users.length;
 }
 } catch (e) {}
 }

 updateTabBadges();

 if (initialTab === 'all') renderAllUsersTab();
 else if (initialTab === 'mail') renderMailTab();
 else renderPendingTab();
 }

 window.showAdminApprovalModal = showAdminApprovalModal;
})();
