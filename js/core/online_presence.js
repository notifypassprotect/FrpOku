/**
 * online_presence.js — Facebook Tarzı Çevrimiçi Kullanıcı Paneli & Varlık Takibi
 */
(function() {
  'use strict';

  let cachedUsers = [];
  let pollInterval = null;
  let isPanelOpen = false;
  let dockEl = null;

  function formatRelativeTime(dateString) {
    if (!dateString) return 'Çevrimdışı';
    const time = new Date(dateString).getTime();
    if (isNaN(time)) return 'Çevrimdışı';
    const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (diffSec < 60) return 'Az önce';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}d önce`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}s önce`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 30) return `${diffDays}g önce`;
    return `${Math.floor(diffDays / 30)} ay önce`;
  }

  function escHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function sendHeartbeat() {
    if (!window.FrpAuth || !window.FrpAuth.isLoggedIn || !window.FrpAuth.isLoggedIn()) {
      return;
    }
    try {
      const res = await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.users)) {
          cachedUsers = data.users;
          renderUsers();
        }
      }
    } catch {}
  }

  function sendOffline() {
    const user = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
    if (!user || !user.id) return;
    try {
      const payload = JSON.stringify({ userId: user.id });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/presence/offline', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/presence/offline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    } catch {}
  }

  function createDock() {
    if (document.getElementById('frpPresenceDock')) return;

    dockEl = document.createElement('div');
    dockEl.id = 'frpPresenceDock';
    dockEl.className = 'frp-presence-dock';

    dockEl.innerHTML = `
      <!-- PİLL BUTON -->
      <div id="frpPresencePill" class="frp-presence-pill" title="Çevrimiçi Kullanıcıları Göster">
        <span class="frp-presence-pill-pulse"></span>
        <span class="frp-presence-pill-text">Çevrimiçi</span>
        <span id="frpPresencePillCount" class="frp-presence-pill-count">0</span>
      </div>

      <!-- AÇILIR PANEL -->
      <div id="frpPresencePanel" class="frp-presence-panel">
        <div class="frp-presence-header">
          <div class="frp-presence-title-area">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
            <span class="frp-presence-title">Kullanıcılar</span>
            <span id="frpPresenceHeaderCount" style="font-size: 0.72rem; font-weight: 700; color: #10b981; background: rgba(16,185,129,0.12); padding: 2px 7px; border-radius: 9999px;">0 Çevrimiçi</span>
          </div>
          <div class="frp-presence-header-actions">
            <button type="button" id="frpPresenceBtnRefresh" class="frp-presence-btn-icon" title="Yenile">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
            <button type="button" id="frpPresenceBtnClose" class="frp-presence-btn-icon" title="Kapat">✕</button>
          </div>
        </div>

        <div class="frp-presence-search-wrap">
          <input type="text" id="frpPresenceSearch" class="frp-presence-search-input" placeholder="İsim veya bölüm ara..." />
        </div>

        <ul id="frpPresenceList" class="frp-presence-list">
          <li class="frp-presence-empty">Kullanıcılar yükleniyor...</li>
        </ul>

        <div class="frp-presence-footer">
          <span id="frpPresenceSelfStatus">Siz: Çevrimdışı</span>
          <span style="font-size: 0.7rem; opacity: 0.8;">Sohbet v1.0 Altyapısı</span>
        </div>
      </div>
    `;

    document.body.appendChild(dockEl);

    // Event listeners
    const pill = dockEl.querySelector('#frpPresencePill');
    const panel = dockEl.querySelector('#frpPresencePanel');
    const btnClose = dockEl.querySelector('#frpPresenceBtnClose');
    const btnRefresh = dockEl.querySelector('#frpPresenceBtnRefresh');
    const searchInput = dockEl.querySelector('#frpPresenceSearch');

    pill.addEventListener('click', () => {
      isPanelOpen = !isPanelOpen;
      if (isPanelOpen) {
        panel.classList.add('open');
        pill.style.display = 'none';
        sendHeartbeat();
        setTimeout(() => searchInput.focus(), 80);
      } else {
        panel.classList.remove('open');
        pill.style.display = 'inline-flex';
      }
    });

    btnClose.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('open');
      pill.style.display = 'inline-flex';
    });

    btnRefresh.addEventListener('click', () => {
      sendHeartbeat();
    });

    searchInput.addEventListener('input', () => {
      renderUsers(searchInput.value);
    });
  }

  function renderUsers(query = '') {
    if (!dockEl) return;
    const listEl = dockEl.querySelector('#frpPresenceList');
    const pillCount = dockEl.querySelector('#frpPresencePillCount');
    const headerCount = dockEl.querySelector('#frpPresenceHeaderCount');
    const selfStatus = dockEl.querySelector('#frpPresenceSelfStatus');

    const currentUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
    if (selfStatus) {
      selfStatus.textContent = currentUser ? `Siz: ${currentUser.full_name || currentUser.username} (Çevrimiçi)` : 'Giriş yapılmadı';
    }

    const onlineList = cachedUsers.filter(u => u.isOnline);
    const count = onlineList.length;

    if (pillCount) pillCount.textContent = count;
    if (headerCount) headerCount.textContent = `${count} Çevrimiçi`;

    const q = (query || '').toLowerCase().trim();
    const filtered = cachedUsers.filter(u => {
      if (!q) return true;
      const fn = (u.fullName || '').toLowerCase();
      const un = (u.username || '').toLowerCase();
      const dp = (u.department || '').toLowerCase();
      return fn.includes(q) || un.includes(q) || dp.includes(q);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<li class="frp-presence-empty">${q ? 'Aramaya uygun kullanıcı bulunamadı.' : 'Henüz kayıtlı kullanıcı bulunmuyor.'}</li>`;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(u => {
      const li = document.createElement('li');
      li.className = 'frp-presence-item';
      const isOnline = u.isOnline;
      const timeLabel = isOnline ? 'Çevrimiçi' : formatRelativeTime(u.lastSeen);
      const initial = (u.avatar || u.fullName || u.username || 'U')[0].toUpperCase();

      li.innerHTML = `
        <div class="frp-presence-avatar-wrap">
          <div class="frp-presence-avatar">${escHtml(initial)}</div>
          <span class="frp-presence-status-dot ${isOnline ? 'online' : 'offline'}"></span>
        </div>
        <div class="frp-presence-info">
          <div class="frp-presence-name-row">
            <span class="frp-presence-name">${escHtml(u.fullName || u.username)}</span>
            <span class="frp-presence-time ${isOnline ? 'online' : ''}">${escHtml(timeLabel)}</span>
          </div>
          <div class="frp-presence-sub">
            <span>@${escHtml(u.username)}</span>
            ${u.department ? `<span class="frp-presence-dept-badge">${escHtml(u.department)}</span>` : ''}
          </div>
        </div>
      `;

      li.addEventListener('click', () => {
        openChatPlaceholder(u);
      });

      listEl.appendChild(li);
    });
  }

  function openChatPlaceholder(targetUser) {
    const existing = document.getElementById('frpChatPlaceholderModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'frpChatPlaceholderModal';
    modal.className = 'frp-chat-placeholder-modal';

    const isOnline = targetUser.isOnline;
    const timeLabel = isOnline ? 'Çevrimiçi' : formatRelativeTime(targetUser.lastSeen);

    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem;">
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <span style="width:8px;height:8px;border-radius:50%;background:${isOnline ? '#10b981' : '#94a3b8'};"></span>
          <span class="frp-chat-placeholder-title" style="margin-bottom:0;">${escHtml(targetUser.fullName || targetUser.username)}</span>
        </div>
        <button type="button" id="frpChatModalClose" style="border:none;background:none;cursor:pointer;font-size:1rem;color:var(--text-muted);">✕</button>
      </div>
      <div class="frp-chat-placeholder-sub">
        <strong>${escHtml(targetUser.department || 'Genel')}</strong> • ${escHtml(timeLabel)}
        <div style="margin-top:0.4rem;color:var(--accent,#2563eb);font-weight:600;">
          💬 Canlı mesajlaşma altyapısı hazırlandı.
        </div>
        <div style="margin-top:0.25rem;font-size:0.74rem;">
          Bu kullanıcı ile doğrudan sohbet başlatma özelliği bir sonraki güncellemeyle aktif olacaktır.
        </div>
      </div>
      <div style="display:flex;gap:0.4rem;justify-content:flex-end;">
        <button type="button" id="frpChatModalBtnOk" class="btn btn-sm btn-primary" style="padding:0.35rem 0.85rem;font-size:0.75rem;font-weight:700;">Tamam</button>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#frpChatModalClose').addEventListener('click', close);
    modal.querySelector('#frpChatModalBtnOk').addEventListener('click', close);
  }

  function startPresence() {
    createDock();
    sendHeartbeat();
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(sendHeartbeat, 20000);

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    });

    window.addEventListener('focus', () => {
      sendHeartbeat();
    });

    window.addEventListener('beforeunload', sendOffline);
    window.addEventListener('pagehide', sendOffline);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPresence);
  } else {
    startPresence();
  }

  window.FrpPresence = {
    heartbeat: sendHeartbeat,
    leave: sendOffline,
    refresh: sendHeartbeat,
    openDock: () => {
      if (dockEl) {
        const pill = dockEl.querySelector('#frpPresencePill');
        const panel = dockEl.querySelector('#frpPresencePanel');
        if (pill && panel) {
          isPanelOpen = true;
          panel.classList.add('open');
          pill.style.display = 'none';
        }
      }
    }
  };
})();
