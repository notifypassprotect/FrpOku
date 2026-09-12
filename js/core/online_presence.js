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

  let ROOMS = [
    { id: 'room_general', name: 'Genel Ekip Duyuruları', icon: '📢', desc: 'Tüm birimler ortak iletişim kanalı' },
    { id: 'room_ops', name: 'Operasyon & Saha', icon: '⚙️', desc: 'Raporlama ve operasyon koordinasyonu' },
    { id: 'room_finance', name: 'Muhasebe & Finans', icon: '📊', desc: 'Mali tablolar ve mutabakat' }
  ];

  async function fetchDepartmentRooms() {
    try {
      const res = await fetch('/api/chat/rooms', {
        headers: (window.FrpAuth && window.FrpAuth.getAuthHeaders) ? window.FrpAuth.getAuthHeaders() : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.rooms)) {
          ROOMS = data.rooms.map(r => ({
            id: r.id,
            name: r.name,
            icon: r.icon || '💬',
            desc: r.description || 'Departman kanalı'
          }));
          if (currentTab === 'rooms') renderRooms();
        }
      }
    } catch {}
  }

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

    fetchDepartmentRooms();
  }

  function handleUnreadUpdate(newCounts) {
    let total = 0;
    const bySender = {};
    let hasNewIncoming = false;

    if (newCounts && typeof newCounts === 'object') {
      Object.entries(newCounts).forEach(([senderId, count]) => {
        const c = Number(count) || 0;
        if (c > 0) {
          bySender[senderId] = c;
          total += c;
          const oldC = (unreadData.bySender && unreadData.bySender[senderId]) || 0;
          if (c > oldC) hasNewIncoming = true;
        }
      });
    }

    unreadData = { bySender, total };

    if (hasNewIncoming && total > lastTotalUnread) {
      playNotificationChime();
      showDesktopNotification('FRP Ekip Sohbeti', 'Yeni bir ekip mesajınız var.');
    }
    lastTotalUnread = total;

    updateDockBadges();
  }

  function updateDockBadges() {
    if (!dockEl) return;
    const pill = dockEl.querySelector('#frpPresencePill');
    const existingPillBadge = pill?.querySelector('.frp-presence-pill-unread-badge');
    
    if (unreadData.total > 0) {
      if (!existingPillBadge && pill) {
        const b = document.createElement('span');
        b.className = 'frp-presence-pill-unread-badge';
        b.textContent = unreadData.total > 99 ? '99+' : unreadData.total;
        pill.appendChild(b);
      } else if (existingPillBadge) {
        existingPillBadge.textContent = unreadData.total > 99 ? '99+' : unreadData.total;
      }
    } else {
      if (existingPillBadge) existingPillBadge.remove();
    }
  }

  async function sendOffline() {
    if (!window.FrpAuth || !window.FrpAuth.isLoggedIn || !window.FrpAuth.isLoggedIn()) return;
    try {
      const headers = window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' };
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ customStatus: 'invisible' })], { type: 'application/json' });
        navigator.sendBeacon('/api/presence/heartbeat', blob);
      } else {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers,
          body: JSON.stringify({ customStatus: 'invisible' }),
          keepalive: true
        });
      }
    } catch {}
  }

  function updateSelfStatusUI() {
    if (!dockEl) return;
    const current = getMyCustomStatus();
    const config = STATUS_CONFIG[current] || STATUS_CONFIG.online;
    
    const dot = dockEl.querySelector('#frpSelfStatusDot');
    const label = dockEl.querySelector('#frpSelfStatusLabel');
    const select = dockEl.querySelector('#frpSelfStatusSelect');

    if (dot) dot.style.backgroundColor = config.color;
    if (label) label.textContent = config.label;
    if (select) select.value = current;
  }

  // ── DOCK VE PANEL DOM OLUŞTURUCU ──
  function createDock() {
    if (document.getElementById('frpPresenceDock')) return;

    dockEl = document.createElement('div');
    dockEl.id = 'frpPresenceDock';
    dockEl.className = 'frp-presence-dock';

    dockEl.innerHTML = `
      <!-- KAPALI PİLL DURUMU -->
      <div id="frpPresencePill" class="frp-presence-pill" title="Ekip Arkadaşlarım & Canlı Sohbet">
        <span class="frp-presence-pill-pulse"></span>
        <span class="frp-presence-pill-text">Ekip</span>
        <span id="frpPresencePillCount" class="frp-presence-pill-count">0</span>
      </div>

      <!-- AÇILIR PANEL -->
      <div id="frpPresencePanel" class="frp-presence-panel">
        
        <!-- HEADER -->
        <div class="frp-presence-header">
          <div class="frp-presence-title-area">
            <span class="frp-presence-title">Ekip Sohbeti</span>
            <span id="frpPresenceHeaderCount" class="frp-presence-count-badge">0 Çevrimiçi</span>
          </div>
          <div class="frp-presence-header-actions">
            <button type="button" id="btnPresenceSearchToggle" class="frp-presence-btn-icon" title="Kullanıcı veya Oda Ara">🔍</button>
            <button type="button" id="btnPresenceClose" class="frp-presence-btn-icon" title="Kapat">✕</button>
          </div>
        </div>

        <!-- KULLANICI KENDİ DURUM KARTI -->
        <div class="frp-presence-self-card">
          <div class="frp-presence-self-info">
            <span id="frpSelfStatusDot" class="frp-presence-self-dot"></span>
            <div>
              <div id="frpSelfName" class="frp-presence-self-name">Ben</div>
              <div id="frpSelfStatusLabel" class="frp-presence-self-desc">Çevrimiçi</div>
            </div>
          </div>
          <select id="frpSelfStatusSelect" class="frp-presence-status-select" title="Durumumu Değiştir">
            <option value="online">🟢 Çevrimiçi</option>
            <option value="busy">🟡 Meşgul</option>
            <option value="dnd">🔴 Rahatsız Etmeyin</option>
            <option value="invisible">⚪ Görünmez</option>
          </select>
        </div>

        <!-- ARAMA BARI -->
        <div id="frpPresenceSearchBar" class="frp-presence-search-bar" style="display: none;">
          <input type="text" id="frpPresenceSearchInput" class="frp-presence-search-input" placeholder="İsim, departman veya oda ara..." />
        </div>

        <!-- TABLAR (KULLANICILAR / ODALAR) -->
        <div class="frp-presence-tabs">
          <button type="button" class="frp-presence-tab active" data-tab="users">👥 Kişiler</button>
          <button type="button" class="frp-presence-tab" data-tab="rooms">🏢 Odalar & Kanallar</button>
        </div>

        <!-- LİSTE -->
        <div class="frp-presence-list-wrap">
          <ul id="frpPresenceList" class="frp-presence-list">
            <li class="frp-presence-empty">Kullanıcılar yükleniyor...</li>
          </ul>
        </div>

        <!-- FOOTER -->
        <div class="frp-presence-footer">
          <span>FRP Kurumsal İletişim Ağı</span>
          <span style="font-size:0.85rem;cursor:pointer;" id="btnDesktopNotifOpt" title="Masaüstü Bildirimlerini Aç">🔔</span>
        </div>
      </div>
    `;

    document.body.appendChild(dockEl);

    const pill = dockEl.querySelector('#frpPresencePill');
    const panel = dockEl.querySelector('#frpPresencePanel');
    const btnClose = dockEl.querySelector('#btnPresenceClose');
    const searchToggle = dockEl.querySelector('#btnPresenceSearchToggle');
    const searchBar = dockEl.querySelector('#frpPresenceSearchBar');
    const searchInput = dockEl.querySelector('#frpPresenceSearchInput');
    const statusSelect = dockEl.querySelector('#frpSelfStatusSelect');
    const tabs = dockEl.querySelectorAll('.frp-presence-tab');
    const btnNotif = dockEl.querySelector('#btnDesktopNotifOpt');

    pill.addEventListener('click', () => {
      isPanelOpen = true;
      panel.classList.add('open');
      pill.style.display = 'none';
      renderUsers();
      updateSelfStatusUI();
    });

    btnClose.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('open');
      pill.style.display = 'inline-flex';
      updateDockBadges();
    });

    searchToggle.addEventListener('click', () => {
      const isVisible = searchBar.style.display === 'block';
      searchBar.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) searchInput.focus();
    });

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      if (currentTab === 'users') {
        renderUsers(q);
      } else {
        renderRooms(q);
      }
    });

    statusSelect.addEventListener('change', (e) => {
      setMyCustomStatus(e.target.value);
    });

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        const q = searchInput.value.trim();
        if (currentTab === 'users') {
          renderUsers(q);
        } else {
          renderRooms(q);
        }
      });
    });

    btnNotif.addEventListener('click', () => {
      requestDesktopNotification();
      if (typeof window.toast === 'function') window.toast('Masaüstü bildirim izinleri kontrol edildi.', 'info');
    });

    const currentAuthUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
    if (currentAuthUser) {
      const selfNameEl = dockEl.querySelector('#frpSelfName');
      if (selfNameEl) selfNameEl.textContent = currentAuthUser.fullName || currentAuthUser.username || 'Ben';
    }

    updateSelfStatusUI();
  }

  function renderUsers(query = '') {
    if (!dockEl || currentTab !== 'users') return;
    const listEl = dockEl.querySelector('#frpPresenceList');
    const pillCount = dockEl.querySelector('#frpPresencePillCount');
    const headerCount = dockEl.querySelector('#frpPresenceHeaderCount');

    const onlineUsers = cachedUsers.filter(u => u.isOnline || u.status === 'online' || u.status === 'busy');
    const count = onlineUsers.length;
    if (pillCount) pillCount.textContent = count;
    if (headerCount) headerCount.textContent = `${count} Çevrimiçi`;

    const q = (query || '').toLowerCase().trim();
    const currentAuthUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
    const myId = currentAuthUser ? String(currentAuthUser.id) : '';

    const filtered = cachedUsers.filter(u => {
      if (!q && String(u.id) === myId) return false; // Kendisi aşağıda ayrı listelenmesin, yukarıda sabit not kartı olacak
      if (!q) return true;
      const fn = (u.fullName || '').toLowerCase();
      const un = (u.username || '').toLowerCase();
      const dp = (u.department || '').toLowerCase();
      return fn.includes(q) || un.includes(q) || dp.includes(q);
    });

    listEl.innerHTML = '';

    // WHATSAPP TARZI KENDİNE NOTLAR KARTI (EN ÜSTTE SABİT)
    if (!q && currentAuthUser) {
      const selfLi = document.createElement('li');
      selfLi.className = 'frp-presence-item';
      selfLi.style.background = 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(99,102,241,0.06))';
      selfLi.style.borderBottom = '1px solid var(--border-light, #e2e8f0)';
      selfLi.innerHTML = `
        <div class="frp-presence-avatar-wrap">
          <div class="frp-presence-avatar" style="background: linear-gradient(135deg, #2563eb, #6366f1); font-size: 1rem;">📌</div>
          <span class="frp-presence-status-dot online"></span>
        </div>
        <div class="frp-presence-info">
          <div class="frp-presence-name-row">
            <span class="frp-presence-name">Kendinize Notlar (Siz)</span>
            <span class="frp-presence-dept-badge" style="background: rgba(37,99,235,0.15); color: #2563eb;">Kişisel</span>
          </div>
          <div class="frp-presence-sub">
            <span>Kişisel mesajlar, hatırlatıcılar & belgeler</span>
          </div>
        </div>
      `;
      selfLi.addEventListener('click', () => {
        openChatWindow({
          targetUser: {
            id: currentAuthUser.id,
            fullName: 'Kendinize Notlar (Siz)',
            username: currentAuthUser.username || 'siz',
            isSelfNote: true,
            status: 'online'
          }
        });
      });
      listEl.appendChild(selfLi);
    }

    if (filtered.length === 0 && !currentAuthUser) {
      listEl.innerHTML = `<li class="frp-presence-empty">${q ? 'Aramaya uygun kullanıcı bulunamadı.' : 'Henüz kayıtlı kullanıcı bulunmuyor.'}</li>`;
      return;
    }

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

  // ── DİNAMİK PENCERE HİZALAMA (BOŞLUKSUZ YENİDEN YERLEŞİM) ──
  function realignChatWindows() {
    let idx = 0;
    activeChatWindows.forEach((winObj) => {
      const rightOffset = 345 + (idx * 345);
      winObj.el.style.right = `${rightOffset}px`;
      idx++;
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
    const rightOffset = 345 + (openIndex * 345);

    const chatEl = document.createElement('div');
    chatEl.className = 'frp-chat-window';
    chatEl.style.right = `${rightOffset}px`;

    const userStatus = !isRoom ? (targetUser.status || (targetUser.isOnline ? 'online' : 'offline')) : 'online';
    let statusDotColor = '#10b981';
    let statusText = isRoom ? 'Kurumsal Kanal' : (targetUser.isSelfNote ? 'Kişisel Not Kutusu' : (userStatus === 'online' ? 'Çevrimiçi' : (userStatus === 'busy' ? 'Meşgul' : (userStatus === 'dnd' ? 'Rahatsız Etmeyin' : formatRelativeTime(targetUser.lastSeen)))));

    if (!isRoom && !targetUser.isSelfNote) {
      if (userStatus === 'busy') statusDotColor = '#f59e0b';
      else if (userStatus === 'dnd') statusDotColor = '#ef4444';
      else if (userStatus === 'offline') statusDotColor = '#94a3b8';
    }

    const initial = isRoom ? room.icon : (targetUser.isSelfNote ? '📌' : (targetUser.avatar || targetUser.fullName || targetUser.username || 'U')[0].toUpperCase());

    chatEl.innerHTML = `
      <!-- BAŞLIK BARI -->
      <div class="frp-chat-header">
        <div class="frp-chat-header-user">
          <div class="frp-chat-avatar-wrap">
            <div class="frp-chat-avatar" style="${isRoom ? 'background: linear-gradient(135deg, #059669, #10b981);' : (targetUser.isSelfNote ? 'background: linear-gradient(135deg, #2563eb, #6366f1);' : '')}">${escHtml(initial)}</div>
            ${!isRoom ? `<span class="frp-chat-status-dot" style="background-color: ${statusDotColor};"></span>` : ''}
          </div>
          <div class="frp-chat-header-text">
            <div class="frp-chat-header-name">${escHtml(chatTitle)}</div>
            <div class="frp-chat-header-status">${escHtml(statusText)}</div>
          </div>
        </div>
        <div class="frp-chat-header-controls">
          <button type="button" class="frp-chat-btn-ctrl btn-media-gallery" title="Paylaşılan Medya & Belgeler (İnovasyon)">📁</button>
          <button type="button" class="frp-chat-btn-ctrl btn-search" title="Sohbette Ara">🔍</button>
          <button type="button" class="frp-chat-btn-ctrl btn-maximize" title="Ekranı Büyüt / Eski Boyut">⛶</button>
          <button type="button" class="frp-chat-btn-ctrl btn-minimize" title="Simge Durumuna Küçült">─</button>
          <button type="button" class="frp-chat-btn-ctrl btn-close" title="Kapat">✕</button>
        </div>
      </div>

      <!-- PAYLAŞILAN MEDYA ÇEKMECESİ (İNOVASYON 4) -->
      <div class="frp-chat-media-drawer" style="display: none;">
        <div class="frp-chat-media-drawer-header">
          <span>📁 Paylaşılan Medya & Ekler</span>
          <button type="button" class="frp-chat-btn-ctrl btn-media-close">✕</button>
        </div>
        <div class="frp-chat-media-grid">
          <div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--text-muted); font-size: 0.78rem;">Yükleniyor...</div>
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

      <!-- FOOTER / GİRİŞ ALANI (INSTAGRAM DM KAPSÜLÜ) -->
      <div class="frp-chat-footer">
        <div class="frp-chat-input-row">
          <input type="file" class="frp-chat-file-input" accept="image/*,application/pdf" style="display: none;" />
          <button type="button" class="frp-chat-btn-action btn-attach" title="Dosya veya Görsel Ekle">📎</button>
          <button type="button" class="frp-chat-btn-action btn-emoji-toggle" title="Emoji Ekle">😀</button>
          <input type="text" class="frp-chat-input" placeholder="Bir mesaj yazın..." maxlength="1000" />
          <button type="button" class="frp-chat-btn-action btn-mic" title="Gerçek Ses Kaydı (Bas Konuş)">🎙️</button>
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
    const btnMaximize = chatEl.querySelector('.btn-maximize');
    const btnSearch = chatEl.querySelector('.btn-search');
    const searchBar = chatEl.querySelector('.frp-chat-search-bar');
    const searchInput = chatEl.querySelector('.frp-chat-search-input');
    const searchClose = chatEl.querySelector('.frp-chat-search-close');
    const btnMediaGallery = chatEl.querySelector('.btn-media-gallery');
    const mediaDrawer = chatEl.querySelector('.frp-chat-media-drawer');
    const mediaGrid = chatEl.querySelector('.frp-chat-media-grid');
    const btnMediaClose = chatEl.querySelector('.btn-media-close');

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
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingStartTime = 0;
    let recordingTimer = null;

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
    realignChatWindows();

    // Kapatıldığında diğer pencereleri otomatik kaydır (Boşluk kalmaz!)
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      clearInterval(pollTimer);
      if (recordingTimer) clearInterval(recordingTimer);
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      chatEl.remove();
      activeChatWindows.delete(chatId);
      realignChatWindows();
    });

    btnMinimize.addEventListener('click', (e) => {
      e.stopPropagation();
      chatEl.classList.toggle('minimized');
    });

    btnMaximize.addEventListener('click', (e) => {
      e.stopPropagation();
      chatEl.classList.remove('minimized');
      chatEl.classList.toggle('maximized');
    });

    chatHeader.addEventListener('click', () => {
      if (chatEl.classList.contains('minimized')) {
        chatEl.classList.remove('minimized');
        input.focus();
      }
    });

    // Paylaşılan Medya & Belgeler Çekmecesi (İnovasyon 4)
    async function loadSharedMediaGallery() {
      mediaGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--text-muted); font-size: 0.78rem;">Medya ve belgeler taranıyor...</div>`;
      try {
        const query = isRoom ? `roomId=${encodeURIComponent(chatId)}&mediaOnly=true` : `peerId=${encodeURIComponent(chatId)}&mediaOnly=true`;
        const res = await fetch(`/api/chat/messages?${query}`, {
          headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : {}
        });
        if (res.ok) {
          const data = await res.json();
          const mediaMessages = (data && data.messages) || [];
          if (mediaMessages.length === 0) {
            mediaGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.8rem;">Bu sohbette henüz paylaşılan görsel veya dosya bulunmuyor.</div>`;
            return;
          }

          mediaGrid.innerHTML = '';
          mediaMessages.forEach(m => {
            const item = document.createElement('div');
            item.className = 'frp-chat-media-item';

            if (m.attachment) {
              const isImg = (m.attachment.type || '').startsWith('image/');
              if (isImg) {
                item.innerHTML = `<img src="${m.attachment.dataUrl}" alt="${escHtml(m.attachment.name)}" />`;
                item.addEventListener('click', () => {
                  if (typeof window.openImageAnnotator === 'function') {
                    window.openImageAnnotator({ imageUrl: m.attachment.dataUrl, imageName: m.attachment.name });
                  } else {
                    window.open(m.attachment.dataUrl, '_blank');
                  }
                });
              } else {
                item.innerHTML = `
                  <div style="font-size: 1.5rem;">📄</div>
                  <div style="font-size: 0.65rem; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 3px;">${escHtml(m.attachment.name)}</div>
                `;
                item.addEventListener('click', () => {
                  const a = document.createElement('a');
                  a.href = m.attachment.dataUrl;
                  a.download = m.attachment.name || 'belge.pdf';
                  a.click();
                });
              }
            } else if (m.voice) {
              item.innerHTML = `
                <div style="font-size: 1.5rem;">🎙️</div>
                <div style="font-size: 0.65rem; margin-top: 3px;">Ses (${m.voice.duration || 0}sn)</div>
              `;
              item.addEventListener('click', () => {
                const aud = new Audio(m.voice.dataUrl);
                aud.play().catch(() => {});
              });
            }

            mediaGrid.appendChild(item);
          });
        }
      } catch {
        mediaGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: #ef4444; font-size: 0.78rem;">Medya yüklenemedi.</div>`;
      }
    }

    btnMediaGallery.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mediaDrawer.style.display === 'flex';
      mediaDrawer.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) loadSharedMediaGallery();
    });

    btnMediaClose.addEventListener('click', () => {
      mediaDrawer.style.display = 'none';
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

    // Gerçek Ses Kaydı (MediaRecorder API)
    btnMic.addEventListener('click', async () => {
      if (!isRecordingVoice) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];
          recordingStartTime = Date.now();

          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) audioChunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
            clearInterval(recordingTimer);
            const durationSec = Math.max(1, Math.round((Date.now() - recordingStartTime) / 1000));
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
              sendMessage({
                text: `Sesli Mesaj (${durationSec}sn)`,
                voice: {
                  dataUrl: reader.result,
                  duration: durationSec
                }
              });
            };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(t => t.stop());
          };

          mediaRecorder.start();
          isRecordingVoice = true;
          btnMic.style.color = '#ef4444';
          btnMic.classList.add('recording-pulse');
          input.placeholder = 'Ses kaydediliyor (0sn)... Göndermek için mikrofona tekrar basın.';
          recordingTimer = setInterval(() => {
            const sec = Math.round((Date.now() - recordingStartTime) / 1000);
            input.placeholder = `Ses kaydediliyor (${sec}sn)... Göndermek için mikrofona tekrar basın.`;
          }, 1000);
        } catch (err) {
          if (typeof window.toast === 'function') window.toast('Mikrofon erişimi sağlanamadı: ' + err.message, 'error');
        }
      } else {
        isRecordingVoice = false;
        btnMic.style.color = 'inherit';
        btnMic.classList.remove('recording-pulse');
        clearInterval(recordingTimer);
        input.placeholder = 'Bir mesaj yazın...';
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
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

    // Mesajları Akışa Basma (Instagram DM Stili + Gerçek Ses Çalar)
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
              <div style="margin-top: 6px; border-radius: 8px; overflow: hidden; max-width: 220px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <img src="${m.attachment.dataUrl}" alt="${escHtml(m.attachment.name)}" style="width: 100%; display: block; cursor: pointer;" />
              </div>
            `;
          } else {
            contentHtml += `
              <div style="margin-top: 6px; padding: 5px 9px; background: rgba(0,0,0,0.08); border-radius: 8px; font-size: 0.74rem; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <span>📄</span> <span>${escHtml(m.attachment.name)}</span>
              </div>
            `;
          }
        }

        // Sesli Mesaj (Gerçek Ses Oynatıcı)
        if (m.voice && m.voice.dataUrl) {
          const duration = m.voice.duration || 5;
          const durMin = Math.floor(duration / 60);
          const durSec = String(duration % 60).padStart(2, '0');
          contentHtml = `
            <div class="frp-chat-audio-player">
              <button type="button" class="frp-audio-play-btn" title="Oynat / Durdur">▶️</button>
              <div class="frp-audio-track">
                <div class="frp-audio-progress-wrap">
                  <div class="frp-audio-progress-bar"></div>
                </div>
                <div class="frp-audio-meta">
                  <span class="frp-audio-time">0:00 / ${durMin}:${durSec}</span>
                  <span>🎙️ Ses Kaydı</span>
                </div>
              </div>
              <audio src="${m.voice.dataUrl}" preload="none" style="display:none;"></audio>
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

        // Mini Hover Reaksiyon ve Mesaj Geri Alma / Silme Çubuğu
        const canDelete = isSelf || (currentAuthUser && currentAuthUser.role === 'admin');
        const hoverReactionHtml = `
          <div class="frp-chat-hover-bar">
            <button type="button" class="btn-react" data-emoji="👍">👍</button>
            <button type="button" class="btn-react" data-emoji="❤️">❤️</button>
            <button type="button" class="btn-react" data-emoji="😂">😂</button>
            <button type="button" class="btn-react" data-emoji="😮">😮</button>
            <button type="button" class="btn-react" data-emoji="🔥">🔥</button>
            ${canDelete ? `<button type="button" class="btn-delete-msg" title="Mesajı Sil / Geri Al" style="background:none;border:none;cursor:pointer;font-size:0.75rem;padding:1px 3px;color:#ef4444;">🗑️</button>` : ''}
          </div>
        `;

        msgDiv.innerHTML = `
          ${hoverReactionHtml}
          ${isRoom && !isSelf ? `<div style="font-size:0.68rem; font-weight:700; color:var(--text-muted); margin-bottom:2px;">${escHtml(m.senderName)}</div>` : ''}
          <div class="frp-chat-bubble">${contentHtml}</div>
          ${reactionsHtml}
          <div class="frp-chat-msg-time">
            <span>${timeStr}</span>
            ${isSelf ? `<span class="frp-chat-tick ${m.isRead ? 'read' : ''}" title="${m.isRead ? 'Görüldü' : 'İtildi'}">✓✓</span>` : ''}
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

        // Mesaj Silme Butonu
        const btnDel = msgDiv.querySelector('.btn-delete-msg');
        if (btnDel) {
          btnDel.addEventListener('click', (ev) => {
            ev.stopPropagation();
            fetch(`/api/chat/messages/${encodeURIComponent(m.id)}`, {
              method: 'DELETE',
              headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : {}
            }).then(() => loadMessages()).catch(() => {});
          });
        }

        // Ses Oynatıcı Bağlantısı
        const audioPlayer = msgDiv.querySelector('.frp-chat-audio-player');
        if (audioPlayer) {
          const btnPlay = audioPlayer.querySelector('.frp-audio-play-btn');
          const audioEl = audioPlayer.querySelector('audio');
          const progBar = audioPlayer.querySelector('.frp-audio-progress-bar');
          const timeSpan = audioPlayer.querySelector('.frp-audio-time');

          btnPlay.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (audioEl.paused) {
              document.querySelectorAll('audio').forEach(a => { if (a !== audioEl) a.pause(); });
              audioEl.play().catch(() => {});
              btnPlay.textContent = '⏸️';
            } else {
              audioEl.pause();
              btnPlay.textContent = '▶️';
            }
          });

          audioEl.addEventListener('timeupdate', () => {
            if (audioEl.duration) {
              const pct = (audioEl.currentTime / audioEl.duration) * 100;
              progBar.style.width = pct + '%';
              const cMin = Math.floor(audioEl.currentTime / 60);
              const cSec = String(Math.floor(audioEl.currentTime % 60)).padStart(2, '0');
              const dMin = Math.floor(audioEl.duration / 60);
              const dSec = String(Math.floor(audioEl.duration % 60)).padStart(2, '0');
              timeSpan.textContent = `${cMin}:${cSec} / ${dMin}:${dSec}`;
            }
          });

          audioEl.addEventListener('ended', () => {
            btnPlay.textContent = '▶️';
            progBar.style.width = '0%';
          });
        }

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
