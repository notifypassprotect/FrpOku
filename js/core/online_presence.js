/**
 * online_presence.js — FRP Kurumsal Ekip İletişimi, Varlık Takibi & Canlı Sohbet
 */
(function() {
  'use strict';

  let cachedUsers = [];
  let pollInterval = null;
  let isPanelOpen = false;
  let dockEl = null;
  let activeChatWindows = new Map(); // peerId/roomId -> { el, timer, lastMsgCount }
  let currentTab = 'users'; // 'users' | 'rooms'
  let unreadData = { bySender: {}, total: 0 };
  let lastTotalUnread = 0;

  const ROOMS = [
    { id: 'room_general', name: 'Genel Ekip Duyuruları', icon: '📢', desc: 'Tüm birimler ortak iletişim kanalı' },
    { id: 'room_ops', name: 'Operasyon & Saha', icon: '⚙️', desc: 'Raporlama ve operasyon koordinasyonu' },
    { id: 'room_finance', name: 'Muhasebe & Finans', icon: '📊', desc: 'Mali tablolar ve mutabakat' }
  ];

  const STATUS_CONFIG = {
    online: { label: 'Çevrimiçi', color: '#10b981', class: 'online' },
    busy: { label: 'Meşgul', color: '#f59e0b', class: 'busy' },
    dnd: { label: 'Rahatsız Etmeyin', color: '#ef4444', class: 'dnd' },
    invisible: { label: 'Görünmez', color: '#94a3b8', class: 'offline' }
  };

  const EMOJI_CATEGORIES = {
    faces: ['😀', '😃', '😄', '😁', '😊', '😍', '😎', '🤔', '😅', '🙌', '🤝', '👏', '🙏'],
    hands: ['👍', '👎', '👌', '✌️', '💪', '👋', '🎉', '✨', '🔥', '⭐', '🚀', '💯'],
    work: ['📁', '📊', '📈', '📋', '📌', '📎', '💼', '🏢', '📝', '✉️', '📞', '💡'],
    hearts: ['❤️', '💙', '💚', '💛', '💜', '🖤', '✅', '❌', '⚠️', 'ℹ️', '🕒', '☕']
  };

  // ── SES BİLDİRİMİ (WEB AUDIO API) ──
  function playNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(587.33, now); // D5
      g1.gain.setValueAtTime(0.12, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      o1.connect(g1);
      g1.connect(ctx.destination);
      o1.start(now);
      o1.stop(now + 0.3);

      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(880, now + 0.1); // A5
      g2.gain.setValueAtTime(0.12, now + 0.1);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.start(now + 0.1);
      o2.stop(now + 0.4);
    } catch {}
  }

  function requestDesktopNotification() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  function showDesktopNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch {}
    }
  }

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

  // ── HEARTBEAT & KULLANICI / OKUNMAMIŞ VERİLERİ ──
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
        if (data && data.success) {
          if (Array.isArray(data.users)) {
            cachedUsers = data.users;
          }
          if (data.unreadCounts) {
            handleUnreadUpdate(data.unreadCounts);
          }
          renderUsers();
        }
      }
    } catch {}
  }

  function handleUnreadUpdate(newUnread) {
    unreadData = newUnread || { bySender: {}, total: 0 };
    const currentTotal = unreadData.total || 0;

    // Yeni mesaj geldiğinde bildirim sesi ve masaüstü uyarısı
    if (currentTotal > lastTotalUnread && lastTotalUnread !== 0) {
      playNotificationChime();
      showDesktopNotification('Yeni Kurumsal Mesaj', `${currentTotal} adet okunmamış mesajınız bulunmaktadır.`);
    }
    lastTotalUnread = currentTotal;

    // Pill badge güncelle
    updatePillBadge();
  }

  function updatePillBadge() {
    if (!dockEl) return;
    const pill = dockEl.querySelector('#frpPresencePill');
    let badge = dockEl.querySelector('#frpPresencePillUnread');

    const total = unreadData.total || 0;
    if (total > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'frpPresencePillUnread';
        badge.className = 'frp-presence-pill-unread-badge';
        pill.appendChild(badge);
      }
      badge.textContent = total > 99 ? '99+' : total;
      badge.style.display = 'inline-flex';
    } else if (badge) {
      badge.style.display = 'none';
    }
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
    
    const pillPulse = dockEl.querySelector('.frp-presence-pill-pulse');
    if (pillPulse) {
      pillPulse.style.backgroundColor = config.color;
    }

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
      <div id="frpPresencePill" class="frp-presence-pill" title="Ekip İletişimi & Sohbet Paneli">
        <span class="frp-presence-pill-pulse"></span>
        <span class="frp-presence-pill-text">Ekip İletişimi</span>
        <span id="frpPresencePillCount" class="frp-presence-pill-count">0</span>
      </div>

      <!-- AÇILIR ANA PANEL -->
      <div id="frpPresencePanel" class="frp-presence-panel">
        
        <!-- HEADER -->
        <div class="frp-presence-header">
          <div class="frp-presence-title-area">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
            <span class="frp-presence-title">Ekip & Mesajlar</span>
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
          <select id="frpPresenceStatusSelect" class="frp-presence-status-select" title="Durumunuzu Belirleyin">
            <option value="online">🟢 Çevrimiçi</option>
            <option value="busy">🟡 Meşgul</option>
            <option value="dnd">🔴 Rahatsız Etmeyin</option>
            <option value="invisible">⚪ Görünmez</option>
          </select>
        </div>

        <!-- TABLAR (KİŞİLER vs DEPARTMAN ODALARI) -->
        <div class="frp-presence-nav-tabs">
          <button type="button" id="tabBtnUsers" class="frp-presence-tab-btn active">👤 Kişiler</button>
          <button type="button" id="tabBtnRooms" class="frp-presence-tab-btn">🏢 Departman Odaları</button>
        </div>

        <!-- ARAMA ÇUBUĞU -->
        <div class="frp-presence-search-wrap">
          <input type="text" id="frpPresenceSearch" class="frp-presence-search-input" placeholder="İsim veya departman ara..." />
        </div>

        <!-- LİSTE -->
        <ul id="frpPresenceList" class="frp-presence-list">
          <li class="frp-presence-empty">Yükleniyor...</li>
        </ul>

        <!-- FOOTER -->
        <div class="frp-presence-footer">
          <span style="display:flex;align-items:center;gap:5px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Sohbet etmek için kişiye tıklayın
          </span>
          <span style="font-size: 0.68rem; opacity: 0.75;">v1.3 Kurumsal</span>
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
    const tabUsers = dockEl.querySelector('#tabBtnUsers');
    const tabRooms = dockEl.querySelector('#tabBtnRooms');

    pill.addEventListener('click', () => {
      isPanelOpen = !isPanelOpen;
      if (isPanelOpen) {
        panel.classList.add('open');
        pill.style.display = 'none';
        requestDesktopNotification();
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

    tabUsers.addEventListener('click', () => {
      currentTab = 'users';
      tabUsers.classList.add('active');
      tabRooms.classList.remove('active');
      searchInput.placeholder = 'İsim veya departman ara...';
      renderUsers(searchInput.value);
    });

    tabRooms.addEventListener('click', () => {
      currentTab = 'rooms';
      tabRooms.classList.add('active');
      tabUsers.classList.remove('active');
      searchInput.placeholder = 'Oda ara...';
      renderRooms(searchInput.value);
    });

    updateSelfStatusUI();
  }

  function renderUsers(query = '') {
    if (!dockEl || currentTab !== 'users') return;
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

      const unreadCount = (unreadData.bySender && unreadData.bySender[String(u.id)]) || 0;
      if (unreadCount > 0) {
        li.classList.add('unread');
      }

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
            <div style="display:flex;align-items:center;gap:0.35rem;">
              ${unreadCount > 0 ? `<span class="frp-presence-unread-badge">${unreadCount}</span>` : ''}
              <span class="frp-presence-time ${statusClass}">${escHtml(statusLabel)}</span>
            </div>
          </div>
          <div class="frp-presence-sub">
            <span>@${escHtml(u.username)}</span>
            ${u.department ? `<span class="frp-presence-dept-badge">${escHtml(u.department)}</span>` : ''}
          </div>
        </div>
      `;

      li.addEventListener('click', () => {
        openChatWindow({ targetUser: u });
      });

      listEl.appendChild(li);
    });
  }

  function renderRooms(query = '') {
    if (!dockEl || currentTab !== 'rooms') return;
    const listEl = dockEl.querySelector('#frpPresenceList');
    const q = (query || '').toLowerCase().trim();

    const filtered = ROOMS.filter(r => {
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<li class="frp-presence-empty">Oda bulunamadı.</li>`;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(room => {
      const li = document.createElement('li');
      li.className = 'frp-presence-item';

      li.innerHTML = `
        <div class="frp-presence-avatar-wrap">
          <div class="frp-presence-avatar" style="background: linear-gradient(135deg, #059669, #10b981); font-size: 1.1rem;">${room.icon}</div>
        </div>
        <div class="frp-presence-info">
          <div class="frp-presence-name-row">
            <span class="frp-presence-name">${escHtml(room.name)}</span>
            <span class="frp-presence-dept-badge" style="background: rgba(16,185,129,0.15); color: #059669;">Kanal</span>
          </div>
          <div class="frp-presence-sub">
            <span>${escHtml(room.desc)}</span>
          </div>
        </div>
      `;

      li.addEventListener('click', () => {
        openChatWindow({ room });
      });

      listEl.appendChild(li);
    });
  }

  // ── GERÇEK ZAMANLI KURUMSAL SOHBET PENCERESİ ──────────
  function openChatWindow({ targetUser, room }) {
    const isRoom = Boolean(room);
    const chatId = isRoom ? room.id : String(targetUser.id);
    const chatTitle = isRoom ? room.name : (targetUser.fullName || targetUser.username);

    // Zaten açıksa öne al
    if (activeChatWindows.has(chatId)) {
      const activeObj = activeChatWindows.get(chatId);
      activeObj.el.classList.remove('minimized');
      const inp = activeObj.el.querySelector('.frp-chat-input');
      if (inp) inp.focus();
      return;
    }

    // Ekrandaki pencerelere göre sağ konumu hesapla
    const openIndex = activeChatWindows.size;
    const rightOffset = 340 + (openIndex * 335);

    const chatEl = document.createElement('div');
    chatEl.className = 'frp-chat-window';
    chatEl.style.right = `${rightOffset}px`;

    const userStatus = !isRoom ? (targetUser.status || (targetUser.isOnline ? 'online' : 'offline')) : 'online';
    let statusDotColor = '#10b981';
    let statusText = isRoom ? 'Kurumsal Kanal' : (userStatus === 'online' ? 'Çevrimiçi' : (userStatus === 'busy' ? 'Meşgul' : (userStatus === 'dnd' ? 'Rahatsız Etmeyin' : formatRelativeTime(targetUser.lastSeen))));

    if (!isRoom) {
      if (userStatus === 'busy') statusDotColor = '#f59e0b';
      else if (userStatus === 'dnd') statusDotColor = '#ef4444';
      else if (userStatus === 'offline') statusDotColor = '#94a3b8';
    }

    const initial = isRoom ? room.icon : (targetUser.avatar || targetUser.fullName || targetUser.username || 'U')[0].toUpperCase();

    chatEl.innerHTML = `
      <!-- BAŞLIK BARI -->
      <div class="frp-chat-header">
        <div class="frp-chat-header-user">
          <div class="frp-chat-avatar-wrap">
            <div class="frp-chat-avatar" style="${isRoom ? 'background: linear-gradient(135deg, #059669, #10b981);' : ''}">${escHtml(initial)}</div>
            ${!isRoom ? `<span class="frp-chat-status-dot" style="background-color: ${statusDotColor};"></span>` : ''}
          </div>
          <div class="frp-chat-header-text">
            <div class="frp-chat-header-name">${escHtml(chatTitle)}</div>
            <div class="frp-chat-header-status">${escHtml(statusText)}</div>
          </div>
        </div>
        <div class="frp-chat-header-controls">
          <button type="button" class="frp-chat-btn-ctrl btn-search" title="Sohbette Ara">🔍</button>
          <button type="button" class="frp-chat-btn-ctrl btn-minimize" title="Simge Durumuna Küçült">─</button>
          <button type="button" class="frp-chat-btn-ctrl btn-close" title="Kapat">✕</button>
        </div>
      </div>

      <!-- SOHBET İÇİ ARAMA ÇUBUĞU -->
      <div class="frp-chat-search-bar" style="display: none;">
        <input type="text" class="frp-chat-search-input" placeholder="Bu sohbette ara..." />
        <button type="button" class="frp-chat-search-close">✕</button>
      </div>

      <!-- MESAJ AKIŞI -->
      <div class="frp-chat-body">
        <div class="frp-chat-date-chip">Bugün</div>
        <div class="frp-chat-intro-card">
          <strong>${escHtml(chatTitle)}</strong> ile güvenli kurumsal iletişim oturumu.
        </div>
        <div class="frp-chat-messages-stream"></div>
      </div>

      <!-- EMOJI SEÇİCİ POPUP -->
      <div class="frp-chat-emoji-picker" style="display: none;">
        <div class="frp-chat-emoji-tabs">
          <button type="button" class="emoji-tab-btn active" data-cat="faces">😀 Yüzler</button>
          <button type="button" class="emoji-tab-btn" data-cat="hands">👍 İfadeler</button>
          <button type="button" class="emoji-tab-btn" data-cat="work">💼 Kurumsal</button>
          <button type="button" class="emoji-tab-btn" data-cat="hearts">❤️ Semboller</button>
        </div>
        <div class="frp-chat-emoji-grid"></div>
      </div>

      <!-- FOOTER / GİRİŞ ALANI -->
      <div class="frp-chat-footer">
        <div class="frp-chat-input-row">
          <input type="file" class="frp-chat-file-input" accept="image/*,application/pdf" style="display: none;" />
          <button type="button" class="frp-chat-btn-action btn-attach" title="Dosya veya Görsel Ekle">📎</button>
          <button type="button" class="frp-chat-btn-action btn-emoji-toggle" title="Emoji Ekle">😀</button>
          <input type="text" class="frp-chat-input" placeholder="Bir mesaj yazın..." maxlength="800" />
          <button type="button" class="frp-chat-btn-action btn-mic" title="Sesli Mesaj (Bas Konuş)">🎙️</button>
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

    // Kontroller
    const btnClose = chatEl.querySelector('.btn-close');
    const btnMinimize = chatEl.querySelector('.btn-minimize');
    const btnSearch = chatEl.querySelector('.btn-search');
    const searchBar = chatEl.querySelector('.frp-chat-search-bar');
    const searchInput = chatEl.querySelector('.frp-chat-search-input');
    const searchClose = chatEl.querySelector('.frp-chat-search-close');

    const input = chatEl.querySelector('.frp-chat-input');
    const btnSend = chatEl.querySelector('.frp-chat-send-btn');
    const btnEmojiToggle = chatEl.querySelector('.btn-emoji-toggle');
    const emojiPicker = chatEl.querySelector('.frp-chat-emoji-picker');
    const emojiGrid = chatEl.querySelector('.frp-chat-emoji-grid');
    const btnAttach = chatEl.querySelector('.btn-attach');
    const fileInput = chatEl.querySelector('.frp-chat-file-input');
    const btnMic = chatEl.querySelector('.btn-mic');
    const msgStream = chatEl.querySelector('.frp-chat-messages-stream');
    const chatHeader = chatEl.querySelector('.frp-chat-header');

    let isRecordingVoice = false;

    // Pencere Takibi ve Otomatik Polling (Her 2.5 saniyede bir yeni mesajları sorgula)
    async function loadMessages() {
      if (!window.FrpAuth || !window.FrpAuth.isLoggedIn()) return;
      try {
        const query = isRoom ? `roomId=${encodeURIComponent(chatId)}` : `peerId=${encodeURIComponent(chatId)}`;
        const res = await fetch(`/api/chat/messages?${query}`, {
          headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.messages)) {
            renderMessageStream(data.messages);
          }
        }
      } catch {}
    }

    // Okundu işaretleme
    if (!isRoom) {
      fetch('/api/chat/mark-read', {
        method: 'POST',
        headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: chatId })
      }).then(() => {
        if (unreadData.bySender) delete unreadData.bySender[chatId];
        renderUsers();
      }).catch(() => {});
    }

    loadMessages();
    const pollTimer = setInterval(loadMessages, 2500);

    activeChatWindows.set(chatId, {
      el: chatEl,
      timer: pollTimer,
      lastCount: 0
    });

    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(pollTimer);
      chatEl.remove();
      activeChatWindows.delete(chatId);
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

    // Sohbet İçi Arama
    btnSearch.addEventListener('click', (e) => {
      e.stopPropagation();
      searchBar.style.display = searchBar.style.display === 'none' ? 'flex' : 'none';
      if (searchBar.style.display === 'flex') {
        searchInput.focus();
      }
    });

    searchClose.addEventListener('click', () => {
      searchBar.style.display = 'none';
      searchInput.value = '';
      filterStreamMessages('');
    });

    searchInput.addEventListener('input', () => {
      filterStreamMessages(searchInput.value);
    });

    function filterStreamMessages(q) {
      const term = (q || '').toLowerCase().trim();
      const bubbles = msgStream.querySelectorAll('.frp-chat-msg');
      bubbles.forEach(b => {
        if (!term) {
          b.style.display = 'flex';
          return;
        }
        const text = b.textContent.toLowerCase();
        b.style.display = text.includes(term) ? 'flex' : 'none';
      });
    }

    // Emoji Paneli
    function renderEmojiGrid(cat = 'faces') {
      const list = EMOJI_CATEGORIES[cat] || EMOJI_CATEGORIES.faces;
      emojiGrid.innerHTML = '';
      list.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'frp-chat-emoji-item';
        btn.textContent = emoji;
        btn.addEventListener('click', () => {
          input.value += emoji;
          input.focus();
        });
        emojiGrid.appendChild(btn);
      });
    }

    btnEmojiToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = emojiPicker.style.display === 'block';
      emojiPicker.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        renderEmojiGrid('faces');
      }
    });

    emojiPicker.querySelectorAll('.emoji-tab-btn').forEach(tbtn => {
      tbtn.addEventListener('click', () => {
        emojiPicker.querySelectorAll('.emoji-tab-btn').forEach(b => b.classList.remove('active'));
        tbtn.classList.add('active');
        renderEmojiGrid(tbtn.dataset.cat);
      });
    });

    // Dosya Ekleme
    btnAttach.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        sendMessage({
          text: `[Ek: ${file.name}]`,
          attachment: {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: reader.result
          }
        });
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });

    // Sesli Mesaj Kaydı (Simülasyon / Prototip)
    btnMic.addEventListener('click', () => {
      if (!isRecordingVoice) {
        isRecordingVoice = true;
        btnMic.style.color = '#ef4444';
        btnMic.classList.add('recording-pulse');
        input.placeholder = 'Ses kaydediliyor... Göndermek için mikrofona tekrar basın.';
      } else {
        isRecordingVoice = false;
        btnMic.style.color = 'inherit';
        btnMic.classList.remove('recording-pulse');
        input.placeholder = 'Bir mesaj yazın...';
        sendMessage({
          text: 'Sesli Mesaj (0:07)',
          voice: { duration: 7 }
        });
      }
    });

    // Mesaj Gönderme Mantığı
    async function sendMessage(payload) {
      const currentAuthUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
      if (!currentAuthUser) return;

      const bodyData = {
        receiverId: !isRoom ? chatId : null,
        roomId: isRoom ? chatId : null,
        text: payload.text || '',
        attachment: payload.attachment || null,
        voice: payload.voice || null
      };

      try {
        const res = await fetch('/api/chat/send', {
          method: 'POST',
          headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.message) {
            loadMessages();
          }
        }
      } catch {}
    }

    function handleSend() {
      const text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      emojiPicker.style.display = 'none';
      sendMessage({ text });
    }

    btnSend.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Mesajları Akışa Basma
    function renderMessageStream(messages) {
      const currentAuthUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
      const myId = currentAuthUser ? String(currentAuthUser.id) : '';

      msgStream.innerHTML = '';
      messages.forEach(m => {
        const isSelf = String(m.senderId) === myId;
        const msgDiv = document.createElement('div');
        msgDiv.className = `frp-chat-msg ${isSelf ? 'outgoing' : 'incoming'}`;
        msgDiv.dataset.msgId = m.id;

        const time = new Date(m.createdAt);
        const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

        let contentHtml = escHtml(m.text);

        // Görsel veya Doküman Eki
        if (m.attachment && m.attachment.dataUrl) {
          if ((m.attachment.type || '').startsWith('image/')) {
            contentHtml += `
              <div style="margin-top: 6px; border-radius: 8px; overflow: hidden; max-width: 200px;">
                <img src="${m.attachment.dataUrl}" alt="${escHtml(m.attachment.name)}" style="width: 100%; display: block; cursor: pointer;" />
              </div>
            `;
          } else {
            contentHtml += `
              <div style="margin-top: 6px; padding: 4px 8px; background: rgba(0,0,0,0.06); border-radius: 6px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px;">
                📄 <span>${escHtml(m.attachment.name)}</span>
              </div>
            `;
          }
        }

        // Sesli Mesaj
        if (m.voice) {
          contentHtml = `
            <div style="display: flex; align-items: center; gap: 8px; min-width: 140px;">
              <span style="font-size: 1.1rem;">▶️</span>
              <div class="frp-chat-voice-bars">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
              <span style="font-size: 0.7rem; font-weight: 700;">0:07</span>
            </div>
          `;
        }

        // Reaksiyonlar HTML'i
        let reactionsHtml = '';
        if (m.reactions && Object.keys(m.reactions).length > 0) {
          reactionsHtml = '<div class="frp-chat-reactions-row">';
          Object.entries(m.reactions).forEach(([emoji, userIds]) => {
            if (userIds && userIds.length > 0) {
              const hasMy = userIds.includes(myId);
              reactionsHtml += `<span class="frp-chat-reaction-pill ${hasMy ? 'active' : ''}">${emoji} ${userIds.length}</span>`;
            }
          });
          reactionsHtml += '</div>';
        }

        // Mini Hover Reaksiyon Çubuğu
        const hoverReactionHtml = `
          <div class="frp-chat-hover-bar">
            <button type="button" class="btn-react" data-emoji="👍">👍</button>
            <button type="button" class="btn-react" data-emoji="❤️">❤️</button>
            <button type="button" class="btn-react" data-emoji="😂">😂</button>
            <button type="button" class="btn-react" data-emoji="😮">😮</button>
            <button type="button" class="btn-react" data-emoji="🔥">🔥</button>
          </div>
        `;

        msgDiv.innerHTML = `
          ${hoverReactionHtml}
          ${isRoom && !isSelf ? `<div style="font-size:0.68rem; font-weight:700; color:var(--text-muted); margin-bottom:2px;">${escHtml(m.senderName)}</div>` : ''}
          <div class="frp-chat-bubble">${contentHtml}</div>
          ${reactionsHtml}
          <div class="frp-chat-msg-time">
            ${timeStr}
            ${isSelf ? (m.isRead ? '<span style="color:#3b82f6;" title="Okundu">✓✓</span>' : '<span>✓</span>') : ''}
          </div>
        `;

        // Reaksiyon butonları dinleyicileri
        msgDiv.querySelectorAll('.btn-react').forEach(rbtn => {
          rbtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const emoji = rbtn.dataset.emoji;
            fetch('/api/chat/react', {
              method: 'POST',
              headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messageId: m.id, emoji })
            }).then(() => loadMessages()).catch(() => {});
          });
        });

        msgStream.appendChild(msgDiv);
      });

      msgStream.scrollTop = msgStream.scrollHeight;
    }

    setTimeout(() => input.focus(), 80);
  }

  function startPresence() {
    createDock();
    sendHeartbeat();
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(sendHeartbeat, 15000);

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
    openChat: openChatWindow,
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
