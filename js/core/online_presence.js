/**
 * online_presence.js — Facebook Tarzı Çevrimiçi Kullanıcı Paneli & Canlı Sohbet Arayüzü
 */
(function() {
  'use strict';

  let cachedUsers = [];
  let pollInterval = null;
  let isPanelOpen = false;
  let dockEl = null;
  let activeChatWindows = new Map(); // userId -> DOM element

  const STATUS_CONFIG = {
    online: { label: 'Çevrimiçi', color: '#10b981', class: 'online' },
    busy: { label: 'Meşgul', color: '#f59e0b', class: 'busy' },
    dnd: { label: 'Rahatsız Etmeyin', color: '#ef4444', class: 'dnd' },
    invisible: { label: 'Görünmez', color: '#94a3b8', class: 'offline' }
  };

  function getMyCustomStatus() {
    try {
      return localStorage.getItem('frp_user_custom_status') || 'online';
    } catch {
      return 'online';
    }
  }

  function setMyCustomStatus(newStatus) {
    try {
      localStorage.setItem('frp_user_custom_status', newStatus);
    } catch {}
    updateSelfStatusUI();
    sendHeartbeat();
  }

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
    const myStatus = getMyCustomStatus();
    try {
      const res = await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customStatus: myStatus })
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

  function updateSelfStatusUI() {
    if (!dockEl) return;
    const myStatus = getMyCustomStatus();
    const config = STATUS_CONFIG[myStatus] || STATUS_CONFIG.online;
    
    // Update pill dot color
    const pillPulse = dockEl.querySelector('.frp-presence-pill-pulse');
    if (pillPulse) {
      pillPulse.style.backgroundColor = config.color;
    }

    // Update select in panel footer
    const select = dockEl.querySelector('#frpPresenceStatusSelect');
    if (select && select.value !== myStatus) {
      select.value = myStatus;
    }

    const selfDot = dockEl.querySelector('#frpPresenceSelfDot');
    if (selfDot) {
      selfDot.style.backgroundColor = config.color;
    }

    const selfStatusLabel = dockEl.querySelector('#frpPresenceSelfStatusLabel');
    if (selfStatusLabel) {
      selfStatusLabel.textContent = config.label;
    }
  }

  function createDock() {
    if (document.getElementById('frpPresenceDock')) return;

    dockEl = document.createElement('div');
    dockEl.id = 'frpPresenceDock';
    dockEl.className = 'frp-presence-dock';

    dockEl.innerHTML = `
      <!-- PİLL BUTON -->
      <div id="frpPresencePill" class="frp-presence-pill" title="Çevrimiçi Kullanıcıları & Sohbeti Göster">
        <span class="frp-presence-pill-pulse"></span>
        <span class="frp-presence-pill-text">Sohbet & Kişiler</span>
        <span id="frpPresencePillCount" class="frp-presence-pill-count">0</span>
      </div>

      <!-- AÇILIR PANEL -->
      <div id="frpPresencePanel" class="frp-presence-panel">
        <div class="frp-presence-header">
          <div class="frp-presence-title-area">
            <span id="frpPresenceHeaderStatusDot" style="width: 9px; height: 9px; border-radius: 50%; background: #10b981;"></span>
            <span class="frp-presence-title">Kişiler & Sohbet</span>
            <span id="frpPresenceHeaderCount" class="frp-presence-count-badge">0 Çevrimiçi</span>
          </div>
          <div class="frp-presence-header-actions">
            <button type="button" id="frpPresenceBtnRefresh" class="frp-presence-btn-icon" title="Yenile">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            </button>
            <button type="button" id="frpPresenceBtnClose" class="frp-presence-btn-icon" title="Kapat">✕</button>
          </div>
        </div>

        <!-- KULLANICI KENDİ DURUM KARTI -->
        <div class="frp-presence-self-card">
          <div class="frp-presence-self-info">
            <span id="frpPresenceSelfDot" class="frp-presence-self-indicator"></span>
            <div style="min-width:0;">
              <div id="frpPresenceSelfName" class="frp-presence-self-name">Kullanıcı</div>
              <div id="frpPresenceSelfStatusLabel" class="frp-presence-self-label">Çevrimiçi</div>
            </div>
          </div>
          <select id="frpPresenceStatusSelect" class="frp-presence-status-select" title="Durumunuzu Değiştirin">
            <option value="online">🟢 Çevrimiçi</option>
            <option value="busy">🟡 Meşgul</option>
            <option value="dnd">🔴 Rahatsız Etmeyin</option>
            <option value="invisible">⚪ Görünmez</option>
          </select>
        </div>

        <div class="frp-presence-search-wrap">
          <input type="text" id="frpPresenceSearch" class="frp-presence-search-input" placeholder="İsim veya departman ara..." />
        </div>

        <ul id="frpPresenceList" class="frp-presence-list">
          <li class="frp-presence-empty">Kullanıcılar yükleniyor...</li>
        </ul>

        <div class="frp-presence-footer">
          <span style="display:flex;align-items:center;gap:5px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Sohbet etmek için kişiye tıklayın
          </span>
          <span style="font-size: 0.68rem; opacity: 0.75;">v1.2</span>
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
    const statusSelect = dockEl.querySelector('#frpPresenceStatusSelect');

    pill.addEventListener('click', () => {
      isPanelOpen = !isPanelOpen;
      if (isPanelOpen) {
        panel.classList.add('open');
        pill.style.display = 'none';
        updateSelfStatusUI();
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

    statusSelect.addEventListener('change', (e) => {
      setMyCustomStatus(e.target.value);
    });

    updateSelfStatusUI();
  }

  function renderUsers(query = '') {
    if (!dockEl) return;
    const listEl = dockEl.querySelector('#frpPresenceList');
    const pillCount = dockEl.querySelector('#frpPresencePillCount');
    const headerCount = dockEl.querySelector('#frpPresenceHeaderCount');
    const selfName = dockEl.querySelector('#frpPresenceSelfName');

    const currentUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
    if (selfName) {
      selfName.textContent = currentUser ? (currentUser.full_name || currentUser.username) : 'Giriş yapılmadı';
    }

    const onlineList = cachedUsers.filter(u => u.isOnline && u.status !== 'offline');
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

      const userStatus = u.status || (u.isOnline ? 'online' : 'offline');
      let statusClass = 'offline';
      let statusLabel = formatRelativeTime(u.lastSeen);

      if (userStatus === 'online') {
        statusClass = 'online';
        statusLabel = 'Çevrimiçi';
      } else if (userStatus === 'busy') {
        statusClass = 'busy';
        statusLabel = 'Meşgul';
      } else if (userStatus === 'dnd') {
        statusClass = 'dnd';
        statusLabel = 'Rahatsız Etmeyin';
      }

      const initial = (u.avatar || u.fullName || u.username || 'U')[0].toUpperCase();

      li.innerHTML = `
        <div class="frp-presence-avatar-wrap">
          <div class="frp-presence-avatar">${escHtml(initial)}</div>
          <span class="frp-presence-status-dot ${statusClass}"></span>
        </div>
        <div class="frp-presence-info">
          <div class="frp-presence-name-row">
            <span class="frp-presence-name">${escHtml(u.fullName || u.username)}</span>
            <span class="frp-presence-time ${statusClass}">${escHtml(statusLabel)}</span>
          </div>
          <div class="frp-presence-sub">
            <span>@${escHtml(u.username)}</span>
            ${u.department ? `<span class="frp-presence-dept-badge">${escHtml(u.department)}</span>` : ''}
          </div>
        </div>
      `;

      li.addEventListener('click', () => {
        openFacebookChatWindow(u);
      });

      listEl.appendChild(li);
    });
  }

  // ── FACEBOOK TARZI YÜZEN SOHBET PENCERESİ ──────────
  function openFacebookChatWindow(targetUser) {
    const userId = String(targetUser.id || targetUser.username);
    
    // Zaten açıksa odaklan
    if (activeChatWindows.has(userId)) {
      const existing = activeChatWindows.get(userId);
      existing.classList.remove('minimized');
      const input = existing.querySelector('.frp-chat-input');
      if (input) input.focus();
      return;
    }

    // Ekrandaki aktif sohbet sayısına göre sağ konumu hesapla
    const openIndex = activeChatWindows.size;
    const rightOffset = 340 + (openIndex * 335);

    const chatEl = document.createElement('div');
    chatEl.className = 'frp-chat-window';
    chatEl.style.right = `${rightOffset}px`;

    const userStatus = targetUser.status || (targetUser.isOnline ? 'online' : 'offline');
    let statusDotColor = '#94a3b8';
    let statusText = formatRelativeTime(targetUser.lastSeen);
    if (userStatus === 'online') {
      statusDotColor = '#10b981';
      statusText = 'Çevrimiçi';
    } else if (userStatus === 'busy') {
      statusDotColor = '#f59e0b';
      statusText = 'Meşgul';
    } else if (userStatus === 'dnd') {
      statusDotColor = '#ef4444';
      statusText = 'Rahatsız Etmeyin';
    }

    const initial = (targetUser.avatar || targetUser.fullName || targetUser.username || 'U')[0].toUpperCase();

    chatEl.innerHTML = `
      <div class="frp-chat-header">
        <div class="frp-chat-header-user">
          <div class="frp-chat-avatar-wrap">
            <div class="frp-chat-avatar">${escHtml(initial)}</div>
            <span class="frp-chat-status-dot" style="background-color: ${statusDotColor};"></span>
          </div>
          <div class="frp-chat-header-text">
            <div class="frp-chat-header-name">${escHtml(targetUser.fullName || targetUser.username)}</div>
            <div class="frp-chat-header-status">${escHtml(statusText)}</div>
          </div>
        </div>
        <div class="frp-chat-header-controls">
          <button type="button" class="frp-chat-btn-ctrl btn-minimize" title="Simge Durumuna Küçült">─</button>
          <button type="button" class="frp-chat-btn-ctrl btn-close" title="Kapat">✕</button>
        </div>
      </div>

      <div class="frp-chat-body">
        <div class="frp-chat-date-chip">Bugün</div>
        <div class="frp-chat-intro-card">
          <strong>${escHtml(targetUser.fullName || targetUser.username)}</strong> ile sohbete başladınız.
          <div class="frp-chat-intro-badge">💬 Canlı Mesajlaşma Önizleme Arayüzü</div>
        </div>
        <div class="frp-chat-messages-stream"></div>
      </div>

      <div class="frp-chat-footer">
        <div class="frp-chat-input-row">
          <input type="text" class="frp-chat-input" placeholder="Bir mesaj yazın..." maxlength="500" />
          <button type="button" class="frp-chat-quick-btn" title="Beğeni gönder">👍</button>
          <button type="button" class="frp-chat-send-btn" title="Gönder">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(chatEl);
    activeChatWindows.set(userId, chatEl);

    // Bind controls
    const btnClose = chatEl.querySelector('.btn-close');
    const btnMinimize = chatEl.querySelector('.btn-minimize');
    const input = chatEl.querySelector('.frp-chat-input');
    const btnSend = chatEl.querySelector('.frp-chat-send-btn');
    const btnQuick = chatEl.querySelector('.frp-chat-quick-btn');
    const msgStream = chatEl.querySelector('.frp-chat-messages-stream');
    const chatHeader = chatEl.querySelector('.frp-chat-header');

    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      chatEl.remove();
      activeChatWindows.delete(userId);
    });

    btnMinimize.addEventListener('click', (e) => {
      e.stopPropagation();
      chatEl.classList.toggle('minimized');
    });

    chatHeader.addEventListener('click', () => {
      if (chatEl.classList.contains('minimized')) {
        chatEl.classList.remove('minimized');
        input.focus();
      }
    });

    // Mesaj gönderme mantığı
    function appendMessage(text, isSelf = true) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const msgDiv = document.createElement('div');
      msgDiv.className = `frp-chat-msg ${isSelf ? 'outgoing' : 'incoming'}`;
      msgDiv.innerHTML = `
        <div class="frp-chat-bubble">${escHtml(text)}</div>
        <div class="frp-chat-msg-time">${timeStr}</div>
      `;
      msgStream.appendChild(msgDiv);
      msgStream.scrollTop = msgStream.scrollHeight;
    }

    function showTypingIndicator() {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'frp-chat-typing';
      typingDiv.id = `typing_${userId}`;
      typingDiv.innerHTML = `<span></span><span></span><span></span>`;
      msgStream.appendChild(typingDiv);
      msgStream.scrollTop = msgStream.scrollHeight;
      return typingDiv;
    }

    function handleSend(overrideText) {
      const text = (overrideText || input.value || '').trim();
      if (!text) return;
      if (!overrideText) input.value = '';

      appendMessage(text, true);

      // Simüle edilen karşı taraf yanıtı (Facebook hissi)
      setTimeout(() => {
        const typingEl = showTypingIndicator();
        setTimeout(() => {
          if (typingEl) typingEl.remove();
          const mockReplies = [
            `Selam! Mesajını aldım: "${text}". Canlı sohbet entegrasyonumuz tam aktif olunca anında yanıtlayacağım!`,
            `Harika, sistem üzerinden mesaj iletildi! Ekip bildirim sistemimiz çalışıyor.`,
            `Görüş bildirimin için teşekkürler. Şuan ${STATUS_CONFIG[userStatus]?.label || 'mevcut'} durumundayım.`
          ];
          const randomReply = mockReplies[Math.floor(Math.random() * mockReplies.length)];
          appendMessage(randomReply, false);
        }, 1200);
      }, 600);
    }

    btnSend.addEventListener('click', () => handleSend());
    btnQuick.addEventListener('click', () => handleSend('👍'));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    setTimeout(() => input.focus(), 100);
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
    setStatus: setMyCustomStatus,
    openChat: openFacebookChatWindow,
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
