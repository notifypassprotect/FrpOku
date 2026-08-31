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
 <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg, #f59e0b, #ef4444);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#fff;box-shadow:0 4px 12px rgba(245,158,11,0.35);">
 
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
 body.innerHTML = `<div style="text-align:center;padding:2.5rem;color:var(--text-muted,#64748b);"><div class="splash-spinner" style="margin-bottom:1rem;"></div><div>SMTP durumu kontrol ediliyor...</div></div>`;

 try {
 const headers = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')? window.FrpAuth.getAuthHeaders(): {};
 const response = await fetch('/api/admin/mail/status', { headers });
 const data = await response.json();
 if (!response.ok || !data.success) throw new Error(data.reason || 'Mail durumu alınamadı.');

 const mail = data.mail || {};
 const ready = mail.enabled && mail.configured;
 body.innerHTML = `
 <div style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:1rem;">
 <div style="padding:1.1rem;border:1px solid var(--border,#cbd5e1);border-radius:14px;background:var(--bg-surface,#fff);">
 <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
 <div><div style="font-size:1rem;font-weight:900;">SMTP Gönderim Durumu</div><div style="font-size:.78rem;color:var(--text-muted,#64748b);margin-top:.25rem;">Google App Password daha sonra Render secret alanlarına eklenecek.</div></div>
 <span class="badge ${ready? 'badge-green': 'badge-amber'}">${ready? 'Hazır': mail.enabled? 'Eksik Yapılandırma': 'Kapalı'}</span>
 </div>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;margin-top:1rem;font-size:.8rem;">
 <div><strong>Sunucu</strong><br>${escHtml(mail.provider || 'Tanımlanmadı')}</div>
 <div><strong>Gönderen</strong><br>${escHtml(mail.from || 'Tanımlanmadı')}</div>
 <div><strong>Mail Enabled</strong><br>${mail.enabled? 'Evet': 'Hayır'}</div>
 </div>
 </div>
 <div style="padding:1.1rem;border:1px solid var(--border,#cbd5e1);border-radius:14px;background:var(--bg-surface,#fff);">
 <div style="font-size:.95rem;font-weight:900;margin-bottom:.3rem;">Test E-postası</div>
 <div style="font-size:.78rem;color:var(--text-muted,#64748b);margin-bottom:.9rem;">SMTP etkinleştirildikten sonra bu alandan gerçek gönderim testi yapılabilir.</div>
 <div style="display:flex;gap:.6rem;flex-wrap:wrap;">
 <input type="email" id="adminMailTestAddress" class="master-search-input" placeholder="ornek@gmail.com" style="flex:1;min-width:220px;" />
 <button type="button" id="btnAdminMailTest" class="btn btn-primary" ${ready? '': 'disabled'}>Test Maili Gönder</button>
 </div>
 <div id="adminMailTestResult" style="font-size:.78rem;margin-top:.7rem;color:var(--text-muted,#64748b);"></div>
 </div>
 </div>`;

 body.querySelector('#btnAdminMailTest')?.addEventListener('click', async event => {
 const email = (body.querySelector('#adminMailTestAddress')?.value || '').trim();
 const resultEl = body.querySelector('#adminMailTestResult');
 if (!email || !email.includes('@')) {
 resultEl.textContent = 'Geçerli bir e-posta adresi girin.';
 return;
 }
 event.currentTarget.disabled = true;
 resultEl.textContent = 'Test e-postası gönderiliyor...';
 try {
 const testResponse = await fetch('/api/admin/mail/test', {
 method: 'POST',
 headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')? window.FrpAuth.getAuthHeaders(): { 'Content-Type': 'application/json' },
 body: JSON.stringify({ email })
 });
 const testData = await testResponse.json();
 resultEl.textContent = testData.success? 'Test e-postası başarıyla gönderildi.': (testData.reason || 'E-posta gönderilemedi.');
 } catch (error) {
 resultEl.textContent = 'Mail servisine ulaşılamadı.';
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
 pendingFetchError = '🔐 Yetki hatası — Admin oturumunuz süresi dolmuş veya geçersiz. Lütfen çıkış yapıp tekrar giriş yapın.';
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
 <div style="font-size:2.5rem;margin-bottom:.75rem;">🔐</div>
 <div style="font-size:.95rem;font-weight:800;color:#ef4444;margin-bottom:.5rem;">Kayıtlar Yüklenemedi</div>
 <div style="font-size:.82rem;color:var(--text-muted,#64748b);max-width:360px;margin:0 auto 1.25rem;">${escHtml(pendingFetchError)}</div>
 <button type="button" class="btn btn-sm btn-primary" onclick="this.closest('.admin-modal-wrap').querySelector('#tabAdminPending').click()">Tekrar Dene</button>
 </div>`;
 return;
 }

 if (pendingUsers.length === 0) {
 body.innerHTML = `
 <div style="text-align:center;padding:3.5rem 1rem;">
 <div style="font-size:3.5rem;margin-bottom:1rem;animation:pulse 2s infinite;">✨</div>
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
 <button type="button" id="btnRefreshPendingList" class="btn btn-sm btn-ghost" style="font-size:.78rem;"> Listeyi Yenile</button>
 </div>
 <div class="admin-card-grid" id="pendingGridList">
 `;

 pendingUsers.forEach(u => {
 const timeAgo = formatRelativeTime(u.created_at);
 html += `
 <div class="admin-user-card" id="pendingCard_${u.id}">
 <div class="admin-user-info">
 <div class="admin-user-avatar">${u.avatar || ''}</div>
 <div style="min-width:0;flex:1;">
 <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.2rem;">
 <span style="font-weight:900;font-size:1rem;color:var(--text-primary,#0f172a);">${escHtml(u.full_name || u.username)}</span>
 <span style="font-size:.78rem;font-weight:700;font-family:monospace;color:#2563eb;background:rgba(37,99,235,0.08);padding:.15rem.45rem;border-radius:6px;">@${escHtml(u.username)}</span>
 <span class="badge badge-amber" style="font-size:.7rem;">⏳ Onay Bekliyor</span>
 </div>
 <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;font-size:.78rem;color:var(--text-secondary,#475569);">
 <span> ${escHtml(u.email || '-')}</span>
 ${u.phone? `<span> ${escHtml(u.phone)}</span>`: ''}
 <span> <strong>${escHtml(u.department || 'Bilgi İşlem')}</strong></span>
 <span style="color:var(--text-muted,#94a3b8);"> ${timeAgo}</span>
 </div>
 </div>
 </div>
 <div class="admin-actions">
 <button type="button" class="btn btn-sm btn-success btn-approve-user" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" style="font-weight:800;padding:.45rem.85rem;box-shadow:0 2px 6px rgba(16,185,129,0.25);">
 ✅ Onayla
 </button>
 <button type="button" class="btn btn-sm btn-danger btn-reject-user" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" style="font-weight:800;padding:.45rem.85rem;">
 ❌ Reddet
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
 if (typeof window.toast === 'function') window.toast(`✅ "${uName}" kullanıcısı başarıyla onaylandı!${emailNote}`, emailStatus === 'failed' ? 'warning' : 'success');
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
 fetchError = '🔐 Yetki hatası — Admin oturumunuz geçersiz. Lütfen çıkış yapıp tekrar giriş yapın.';
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
 <div style="font-size:2.5rem;margin-bottom:.75rem;">🔐</div>
 <div style="font-size:.95rem;font-weight:800;color:#ef4444;margin-bottom:.5rem;">Kullanıcılar Yüklenemedi</div>
 <div style="font-size:.82rem;color:var(--text-muted,#64748b);max-width:360px;margin:0 auto 1.25rem;">${escHtml(fetchError)}</div>
 <button type="button" class="btn btn-sm btn-primary" onclick="this.closest('.admin-modal-wrap').querySelector('#tabAdminAll').click()">Tekrar Dene</button>
 </div>`;
 return;
 }

 let html = `
 <div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
 <input type="text" id="adminUserSearchInput" class="master-search-input" placeholder=" Kullanıcı adı, e-posta veya departmanda ara..." style="flex:1;max-width:320px;font-size:.84rem;padding:.45rem.8rem;" />
 <button type="button" id="btnRefreshAllUsers" class="btn btn-sm btn-ghost" style="font-size:.78rem;"> Listeyi Yenile</button>
 </div>
 <div class="admin-card-grid" id="allUsersGridList">
 `;

 allUsers.forEach(u => {
 const isUsrAdmin = (u.role === 'admin' || u.username === 'admin');
 const isPending = (u.is_active === false);

 html += `
 <div class="admin-user-card" id="userCard_${u.id}">
 <div class="admin-user-info">
 <div class="admin-user-avatar">${u.avatar || (isUsrAdmin? '': '')}</div>
 <div style="min-width:0;flex:1;">
 <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.2rem;">
 <span style="font-weight:800;font-size:.95rem;color:var(--text-primary,#0f172a);">${escHtml(u.full_name || u.username)}</span>
 <span style="font-size:.78rem;font-weight:700;font-family:monospace;color:#2563eb;background:rgba(37,99,235,0.08);padding:.15rem.45rem;border-radius:6px;display:inline-flex;align-items:center;gap:.35rem;">
 @${escHtml(u.username)}
 <button type="button" class="btn btn-sm btn-ghost btn-edit-username" data-id="${u.id}" data-name="${escHtml(u.username)}" style="padding:1px 6px;font-size:.72rem;font-weight:700;color:#2563eb;background:#ffffff;border:1px solid rgba(37,99,235,0.25);border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;gap:2px;box-shadow:0 1px 3px rgba(0,0,0,0.06);" title="Kullanıcı Adını Değiştir">
 <span>✏️</span><span>Düzenle</span>
 </button>
 </span>
 ${isUsrAdmin? `<span class="badge badge-purple" style="font-size:.68rem;"> Admin</span>`: `<span class="badge badge-blue" style="font-size:.68rem;">Kullanıcı</span>`}
 ${isPending? `<span class="badge badge-amber" style="font-size:.68rem;">⏳ Onay Bekliyor</span>`: `<span class="badge badge-green" style="font-size:.68rem;"> Aktif</span>`}
 </div>
 <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;font-size:.75rem;color:var(--text-secondary,#64748b);">
 <span> ${escHtml(u.email || '-')}</span>
 ${u.phone? `<span> ${escHtml(u.phone)}</span>`: ''}
 <span> ${escHtml(u.department || 'Bilgi İşlem')}</span>
 </div>
 </div>
 </div>
 <div class="admin-actions">
 <button type="button" class="btn btn-sm btn-ghost btn-admin-reset-pass" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" title="Şifre Sıfırla" style="font-size:.78rem;font-weight:700;">
 Şifre Sıfırla
 </button>
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
 headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')? window.FrpAuth.getAuthHeaders(): {},
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
 headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')? window.FrpAuth.getAuthHeaders(): {},
 body: JSON.stringify({ userId: uId, newPassword: newPass })
 }).then(r => r.json()).then(data => {
 if (data.success) {
 if (typeof window.toast === 'function') window.toast(`"${uName}" şifresi başarıyla güncellendi! `, 'success');
 } else {
 alert(data.reason || 'Şifre güncellenemedi.');
 }
 });
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
