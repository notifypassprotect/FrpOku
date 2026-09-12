/**
 * online_presence.js — FRP Kurumsal Ekip İletişimi, Varlık Takibi & Canlı Sohbet
 */
(function() {
  'use strict';

  let cachedUsers = [];
  let pollInterval = null;
  let isPanelOpen = false;
  let dockEl = null;
  let activeChatWindows = new Map(); // peerId/roomId/groupId -> { el, timer, lastMsgCount }
  let currentTab = 'users'; // 'users' | 'groups' | 'rooms'
  let unreadData = { bySender: {}, total: 0, lastInteraction: {} };
  let lastTotalUnread = 0;
  let cachedGroups = [];
  const localLastInteractions = {};

  // MSN Nudge Buzzer Sesi (Web Audio API ile otantik çift ton titreşim sesi)
  function playMsnNudgeSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      function playTone(startTime, freq, duration) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      }

      playTone(now, 150, 0.08);
      playTone(now + 0.1, 185, 0.11);
    } catch {}
  }

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

  async function fetchChatGroups() {
    if (!window.FrpAuth || !window.FrpAuth.isLoggedIn || !window.FrpAuth.isLoggedIn()) return;
    try {
      const res = await fetch('/api/chat/groups', {
        headers: (window.FrpAuth && window.FrpAuth.getAuthHeaders) ? window.FrpAuth.getAuthHeaders() : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.groups)) {
          cachedGroups = data.groups;
          if (currentTab === 'groups') renderGroups();
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

  // ── AVATAR VE İNİSİYAL YARDIMCILARI (SORU İŞARETİ GLYPH HATASINI GİDERİR) ──
  function getAvatarGradient(name) {
    const palettes = [
      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      'linear-gradient(135deg, #ec4899, #be185d)',
      'linear-gradient(135deg, #10b981, #047857)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #06b6d4, #0e7490)',
      'linear-gradient(135deg, #6366f1, #4338ca)'
    ];
    let hash = 0;
    const str = String(name || '');
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const idx = Math.abs(hash) % palettes.length;
    return palettes[idx];
  }

  function getCleanInitials(fullName, username) {
    const text = String(fullName || username || 'U').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toLocaleUpperCase('tr-TR');
    }
    return text.slice(0, 2).toLocaleUpperCase('tr-TR');
  }

  function renderAvatarContent(avatar, initials, isSmall = false) {
    if (avatar && (avatar.startsWith('data:image/') || avatar.startsWith('http'))) {
      return `<img src="${avatar}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
    }
    if (avatar && avatar.length <= 14 && !/^[a-zA-Z0-9_]{1,3}$/.test(avatar.trim())) {
      return `<span style="font-size:${isSmall ? '0.92rem' : '1.18rem'};display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${avatar}</span>`;
    }
    return `<span style="font-size:${isSmall ? '0.72rem' : '0.85rem'};font-weight:800;color:#ffffff;">${escHtml(initials)}</span>`;
  }

  // ── GÖRSEL LIGHTBOX / BÜYÜTME & İNDİRME MODALI ──
  function openImageLightbox({ src, name, size }) {
    const existing = document.querySelector('.frp-lightbox-modal');
    if (existing) existing.remove();

    const fileName = name || 'gorsel.png';
    let currentZoom = 1;

    const modal = document.createElement('div');
    modal.className = 'frp-lightbox-modal';
    modal.innerHTML = `
      <div class="frp-lightbox-bar">
        <div class="frp-lightbox-title">
          <span>🖼️</span>
          <span style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(fileName)}</span>
          ${size ? `<span style="font-size:0.75rem;opacity:0.75;">(${size})</span>` : ''}
        </div>
        <div class="frp-lightbox-tools">
          <button type="button" class="frp-lightbox-btn btn-zoom-in" title="Yakınlaştır">🔍 +</button>
          <button type="button" class="frp-lightbox-btn btn-zoom-out" title="Uzaklaştır">🔍 -</button>
          <button type="button" class="frp-lightbox-btn btn-zoom-reset" title="Varsayılan Boyut">1:1</button>
          ${typeof window.openImageAnnotator === 'function' ? `<button type="button" class="frp-lightbox-btn btn-annotate" title="Çiz & Düzenle">✏️ Düzenle</button>` : ''}
          <button type="button" class="frp-lightbox-btn btn-download" title="Görseli İndir">⬇️ İndir</button>
          <button type="button" class="frp-lightbox-btn btn-close-lightbox" title="Kapat (ESC)">✕ Kapat</button>
        </div>
      </div>
      <div class="frp-lightbox-body">
        <img src="${src}" alt="${escHtml(fileName)}" class="frp-lightbox-img" draggable="false" />
      </div>
    `;

    document.body.appendChild(modal);

    const img = modal.querySelector('.frp-lightbox-img');
    const updateZoom = (z) => {
      currentZoom = Math.max(0.4, Math.min(4.0, z));
      if (img) img.style.transform = `scale(${currentZoom})`;
    };

    modal.querySelector('.btn-zoom-in')?.addEventListener('click', (e) => { e.stopPropagation(); updateZoom(currentZoom + 0.25); });
    modal.querySelector('.btn-zoom-out')?.addEventListener('click', (e) => { e.stopPropagation(); updateZoom(currentZoom - 0.25); });
    modal.querySelector('.btn-zoom-reset')?.addEventListener('click', (e) => { e.stopPropagation(); updateZoom(1.0); });

    modal.querySelector('.btn-download')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = document.createElement('a');
      a.href = src;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    modal.querySelector('.btn-annotate')?.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.remove();
      if (typeof window.openImageAnnotator === 'function') {
        window.openImageAnnotator({ imageUrl: src, imageName: fileName });
      }
    });

    const closeModal = () => modal.remove();
    modal.querySelector('.btn-close-lightbox')?.addEventListener('click', closeModal);
    modal.querySelector('.frp-lightbox-body')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        closeModal();
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);
  }

  // ── IN-APP CANLI BİLDİRİM BANNERI (İŞLETİM SİSTEMİ BİLDİRİMİ YERİNE DAHA ŞIK) ──
  function showInAppChatNotification({ senderName, senderInitials, senderGradient, messageText, onOpen }) {
    let container = document.getElementById('frpInAppToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'frpInAppToastContainer';
      container.className = 'frp-inapp-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'frp-inapp-toast';
    toast.innerHTML = `
      <div class="frp-inapp-toast-avatar" style="background: ${senderGradient || 'linear-gradient(135deg, #2563eb, #6366f1)'};">
        ${escHtml(senderInitials || 'U')}
      </div>
      <div class="frp-inapp-toast-content">
        <div class="frp-inapp-toast-top">
          <span class="frp-inapp-toast-sender">${escHtml(senderName || 'Ekip Arkadaşı')}</span>
          <span class="frp-inapp-toast-time">Şimdi</span>
        </div>
        <div class="frp-inapp-toast-text">${escHtml(messageText || 'Yeni bir mesaj gönderdi')}</div>
      </div>
      <button type="button" class="frp-inapp-toast-action">Yanıtla</button>
      <button type="button" class="frp-inapp-toast-close" title="Kapat">✕</button>
    `;

    const closeToast = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.95)';
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 200);
    };

    toast.querySelector('.frp-inapp-toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeToast();
    });

    toast.addEventListener('click', () => {
      closeToast();
      if (typeof onOpen === 'function') onOpen();
    });

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.isConnected) closeToast();
    }, 6500);
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
          if (currentTab === 'users') renderUsers();
          else if (currentTab === 'groups') renderGroups();
          else if (currentTab === 'rooms') renderRooms();
        }
      }
    } catch {}

    fetchDepartmentRooms();
    fetchChatGroups();
  }

  function handleUnreadUpdate(newCounts) {
    let total = 0;
    const bySender = {};
    const newSenders = [];

    if (newCounts && typeof newCounts === 'object') {
      if (newCounts.bySender && typeof newCounts.bySender === 'object') {
        bySender = { ...newCounts.bySender };
        total = Number(newCounts.total) || 0;
        if (newCounts.lastInteraction && typeof newCounts.lastInteraction === 'object') {
          unreadData.lastInteraction = { ...unreadData.lastInteraction, ...newCounts.lastInteraction };
        }
      } else {
        Object.entries(newCounts).forEach(([senderId, count]) => {
          const c = Number(count) || 0;
          if (c > 0) {
            bySender[senderId] = c;
            total += c;
            const oldC = (unreadData.bySender && unreadData.bySender[senderId]) || 0;
            if (c > oldC) {
              newSenders.push({ senderId, count: c, diff: c - oldC });
            }
          }
        });
      }
    }

    unreadData = { bySender, total, lastInteraction: unreadData.lastInteraction || {} };

    if (newSenders.length > 0 && total > lastTotalUnread) {
      playNotificationChime();
      newSenders.forEach(({ senderId, count }) => {
        const senderUser = cachedUsers.find(u => String(u.id) === String(senderId));
        const senderName = senderUser ? (senderUser.fullName || senderUser.username) : 'Ekip Arkadaşı';
        const senderInitials = getCleanInitials(senderUser?.fullName, senderUser?.username);
        const senderGradient = getAvatarGradient(senderName);

        showInAppChatNotification({
          senderName,
          senderInitials,
          senderGradient,
          messageText: count > 1 ? `${count} yeni okunmamış mesajınız var.` : 'Size yeni bir mesaj gönderdi.',
          onOpen: () => {
            if (senderUser) {
              openChatWindow({ targetUser: senderUser });
            }
          }
        });
      });
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

    const currentAuthUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
    const isAdmin = Boolean(currentAuthUser && currentAuthUser.role === 'admin');

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
            <button type="button" id="btnPresenceSearchToggle" class="frp-presence-btn-icon" title="Kullanıcı, Grup veya Oda Ara">🔍</button>
            <button type="button" id="btnPresenceClose" class="frp-presence-btn-icon" title="Kapat">✕</button>
          </div>
        </div>

        <!-- KULLANICI KENDİ DURUM KARTI -->
        <div class="frp-presence-self-card">
          <div class="frp-presence-self-info">
            <span id="frpSelfStatusDot" class="frp-presence-self-dot"></span>
            <div>
              <div id="frpSelfName" class="frp-presence-self-name">${escHtml(currentAuthUser?.fullName || currentAuthUser?.username || 'Ben')}</div>
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
          <input type="text" id="frpPresenceSearchInput" class="frp-presence-search-input" placeholder="İsim, departman veya grup ara..." />
        </div>

        <!-- TABLAR (KİŞİLER / GRUPLARIM / ODALAR) -->
        <div class="frp-presence-tabs">
          <button type="button" class="frp-presence-tab active" data-tab="users">👥 Kişiler</button>
          <button type="button" class="frp-presence-tab" data-tab="groups">💬 Gruplarım</button>
          ${isAdmin ? '<button type="button" class="frp-presence-tab" data-tab="rooms">📢 Odalar</button>' : ''}
        </div>

        <!-- LİSTE -->
        <div class="frp-presence-list-wrap">
          <ul id="frpPresenceList" class="frp-presence-list">
            <li class="frp-presence-empty">Kullanıcılar yükleniyor...</li>
          </ul>
        </div>

        <!-- FOOTER -->
        <div class="frp-presence-footer">
          <span>FRP Kurumsal İletişim</span>
          <button type="button" class="frp-presence-notif-btn" id="btnDesktopNotifOpt" title="Masaüstü Bildirim Ayarları">
            <span class="frp-notif-status-dot" id="frpNotifStatusDot"></span>
            <span id="frpNotifStatusText">Bildirimleri Aç</span>
          </button>
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

    function updateNotifBtnUI() {
      if (!btnNotif) return;
      const dot = btnNotif.querySelector('#frpNotifStatusDot');
      const text = btnNotif.querySelector('#frpNotifStatusText');
      if (!('Notification' in window)) {
        if (dot) dot.className = 'frp-notif-status-dot';
        if (text) text.textContent = 'Desteklenmiyor';
        return;
      }
      if (Notification.permission === 'granted') {
        if (dot) dot.className = 'frp-notif-status-dot granted';
        if (text) text.textContent = '🔔 Bildirim: Açık';
      } else if (Notification.permission === 'denied') {
        if (dot) dot.className = 'frp-notif-status-dot denied';
        if (text) text.textContent = '🔕 Bildirim: Engellendi';
      } else {
        if (dot) dot.className = 'frp-notif-status-dot';
        if (text) text.textContent = '🔔 Bildirimleri Aç';
      }
    }
    updateNotifBtnUI();

    pill.addEventListener('click', () => {
      isPanelOpen = true;
      panel.classList.add('open');
      pill.style.display = 'none';
      if (currentTab === 'users') renderUsers();
      else if (currentTab === 'groups') renderGroups();
      else if (currentTab === 'rooms') renderRooms();
      updateSelfStatusUI();
      updateNotifBtnUI();
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
      } else if (currentTab === 'groups') {
        renderGroups(q);
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
        } else if (currentTab === 'groups') {
          fetchChatGroups().then(() => renderGroups(q));
        } else {
          renderRooms(q);
        }
      });
    });

    btnNotif.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        if (typeof window.toast === 'function') window.toast('Bu tarayıcı masaüstü bildirimlerini desteklemiyor.', 'warning');
        return;
      }
      if (Notification.permission === 'granted') {
        if (typeof window.toast === 'function') {
          window.toast('✓ Masaüstü bildirimleri aktif! Yeni mesaj veya titreşim geldiğinde anlık bildirim alırsınız.', 'success');
        }
      } else if (Notification.permission === 'denied') {
        if (typeof window.showConfirmDialog === 'function') {
          window.showConfirmDialog({
            title: 'Masaüstü Bildirim İzni Engellenmiş',
            message: 'Tarayıcınız bu web sitesi için bildirimleri engellemiş görünüyor.<br><br><b>Nasıl Açılır?</b><br>1. Tarayıcı adres çubuğunun solundaki kilit veya ayar simgesine tıklayın.<br>2. <b>Bildirimler</b> iznini <b>İzin Ver</b> olarak ayarlayıp sayfayı yenileyin.',
            confirmText: 'Anladım',
            cancelText: 'Kapat',
            isDanger: false
          });
        } else if (typeof window.toast === 'function') {
          window.toast('Bildirim izni engellenmiş. Adres çubuğundaki kilit simgesinden izin veriniz.', 'warning');
        }
      } else {
        try {
          const perm = await Notification.requestPermission();
          updateNotifBtnUI();
          if (perm === 'granted') {
            if (typeof window.toast === 'function') window.toast('Masaüstü bildirimleri başarıyla etkinleştirildi! 🎉', 'success');
          } else {
            if (typeof window.toast === 'function') window.toast('Bildirim izni onaylanmadı.', 'info');
          }
        } catch {
          updateNotifBtnUI();
        }
      }
    });

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

    // OKUNMAMIŞ MESAJI OLAN KULLANICILARI VE EN SON MESAJLAŞILAN KİŞİLERİ EN ÜSTE SIRALA
    filtered.sort((a, b) => {
      // 1. Okunmamış mesajı olanlar en başta
      const unreadA = (unreadData.bySender && unreadData.bySender[String(a.id)]) || 0;
      const unreadB = (unreadData.bySender && unreadData.bySender[String(b.id)]) || 0;
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadB > 0 && unreadA === 0) return 1;
      if (unreadA !== unreadB) return unreadB - unreadA;

      // 2. En son mesajlaşılan kişi (son etkileşim zamanı azalan sırada)
      const lastA = Math.max(
        (unreadData.lastInteraction && unreadData.lastInteraction[String(a.id)]) || 0,
        localLastInteractions[String(a.id)] || 0
      );
      const lastB = Math.max(
        (unreadData.lastInteraction && unreadData.lastInteraction[String(b.id)]) || 0,
        localLastInteractions[String(b.id)] || 0
      );
      if (lastA > 0 || lastB > 0) {
        if (lastA !== lastB) return lastB - lastA;
      }

      // 3. Çevrimiçi olanlar
      const isOnlineA = a.isOnline || a.status === 'online' || a.status === 'busy';
      const isOnlineB = b.isOnline || b.status === 'online' || b.status === 'busy';
      if (isOnlineA && !isOnlineB) return -1;
      if (!isOnlineA && isOnlineB) return 1;

      // 4. Alfabetik isim
      return (a.fullName || a.username || '').localeCompare(b.fullName || b.username || '', 'tr');
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

      const name = u.fullName || u.username || 'Kullanıcı';
      const initials = getCleanInitials(u.fullName, u.username);
      const gradient = getAvatarGradient(name);
      const userAvatarInner = renderAvatarContent(u.avatar, initials);

      li.innerHTML = `
        <div class="frp-presence-avatar-wrap">
          <div class="frp-presence-avatar" style="background: ${gradient}; overflow:hidden; display:flex; align-items:center; justify-content:center;">${userAvatarInner}</div>
          <span class="frp-presence-status-dot ${statusClass}"></span>
        </div>
        <div class="frp-presence-info">
          <div class="frp-presence-name-row">
            <span class="frp-presence-name">${escHtml(name)}</span>
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

  // ── GRUP SOHBETLERİ LİSTESİ VE YÖNETİMİ ──
  function renderGroups(query = '') {
    if (!dockEl || currentTab !== 'groups') return;
    const listEl = dockEl.querySelector('#frpPresenceList');
    const q = (query || '').toLowerCase().trim();

    const filtered = cachedGroups.filter(g => {
      if (!q) return true;
      return (g.name || '').toLowerCase().includes(q);
    });

    listEl.innerHTML = '';

    // ➕ Yeni Grup Oluştur Butonu (En üstte sabit)
    const createBanner = document.createElement('div');
    createBanner.className = 'frp-group-create-banner';
    createBanner.innerHTML = `
      <div class="frp-group-create-left">
        <div class="frp-group-create-icon">➕</div>
        <div>
          <div class="frp-group-create-title">Yeni Grup Sohbeti</div>
          <div class="frp-group-create-sub">Ekip üyelerini seçin & birlikte mesajlaşın</div>
        </div>
      </div>
      <span class="frp-group-badge">Oluştur</span>
    `;
    createBanner.addEventListener('click', () => {
      openCreateGroupModal();
    });
    listEl.appendChild(createBanner);

    if (filtered.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'frp-presence-empty';
      emptyLi.textContent = q ? 'Aramaya uygun grup bulunamadı.' : 'Henüz bir gruba dahil değilsiniz. Yukarıdaki butona tıklayarak yeni bir grup oluşturabilirsiniz!';
      listEl.appendChild(emptyLi);
      return;
    }

    filtered.forEach(group => {
      const li = document.createElement('li');
      li.className = 'frp-presence-item';

      const memberCount = Array.isArray(group.memberUserIds) ? group.memberUserIds.length : 2;
      const groupIcon = group.icon || '👥';

      li.innerHTML = `
        <div class="frp-presence-avatar-wrap">
          <div class="frp-presence-avatar" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); font-size: 1.05rem; color: #ffffff;">${groupIcon}</div>
        </div>
        <div class="frp-presence-info">
          <div class="frp-presence-name-row">
            <span class="frp-presence-name">${escHtml(group.name)}</span>
            <span class="frp-presence-dept-badge" style="background: rgba(99, 102, 241, 0.12); color: #4f46e5;">${memberCount} Üye</span>
          </div>
          <div class="frp-presence-sub">
            <span>Grup Sohbeti · ${escHtml(group.createdByName || 'Ekip')}</span>
          </div>
        </div>
      `;

      li.addEventListener('click', () => {
        openChatWindow({ group });
      });

      listEl.appendChild(li);
    });
  }

  // ── YENİ GRUP OLUŞTURMA MODALI ──
  function openCreateGroupModal() {
    const currentAuthUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
    const myId = currentAuthUser ? String(currentAuthUser.id) : '';

    const existingModal = document.getElementById('frpGroupModalOverlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'frpGroupModalOverlay';
    overlay.className = 'frp-group-modal-overlay';

    const otherUsers = cachedUsers.filter(u => String(u.id) !== myId);

    let membersHtml = '';
    if (otherUsers.length === 0) {
      membersHtml = '<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">Eklenebilecek başka kayıtlı kullanıcı bulunamadı.</div>';
    } else {
      otherUsers.forEach(u => {
        const uName = u.fullName || u.username || 'Kullanıcı';
        const uInitials = getCleanInitials(u.fullName, u.username);
        const gradient = getAvatarGradient(uName);
        membersHtml += `
          <label class="frp-group-member-item">
            <div class="frp-group-member-left">
              <input type="checkbox" class="frp-group-member-chk" value="${escHtml(String(u.id))}" />
              <div class="frp-presence-avatar" style="width: 26px; height: 26px; font-size: 0.72rem; background: ${gradient}; color: #ffffff; font-weight: 800; border-radius: 50%; display: flex; align-items: center; justify-content: center;">${escHtml(uInitials)}</div>
              <div>
                <div class="frp-group-member-name">${escHtml(uName)}</div>
                <div style="font-size: 0.65rem; color: var(--text-muted);">@${escHtml(u.username || '')} ${u.department ? '· ' + escHtml(u.department) : ''}</div>
              </div>
            </div>
          </label>
        `;
      });
    }

    overlay.innerHTML = `
      <div class="frp-group-modal-card">
        <div class="frp-group-modal-header">
          <span class="frp-group-modal-title">👥 Yeni Grup Sohbeti Başlat</span>
          <button type="button" class="frp-group-modal-close" id="btnGroupModalClose">✕</button>
        </div>
        <div class="frp-group-modal-body">
          <div>
            <label class="frp-group-field-label">Grup Adı</label>
            <input type="text" id="frpGroupNameInput" class="frp-group-input" placeholder="Örn: Pazarlama & Satış Ekibi" maxlength="60" />
          </div>
          <div>
            <label class="frp-group-field-label">Grup Üyelerini Seçin (En az 1 kişi daha seçin)</label>
            <div class="frp-group-members-list">
              ${membersHtml}
            </div>
          </div>
        </div>
        <div class="frp-group-modal-footer">
          <button type="button" class="frp-group-btn-cancel" id="btnGroupModalCancel">İptal</button>
          <button type="button" class="frp-group-btn-submit" id="btnGroupModalSubmit">Grup Oluştur 🚀</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeFn = () => overlay.remove();
    overlay.querySelector('#btnGroupModalClose').addEventListener('click', closeFn);
    overlay.querySelector('#btnGroupModalCancel').addEventListener('click', closeFn);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeFn();
    });

    const nameInput = overlay.querySelector('#frpGroupNameInput');
    setTimeout(() => nameInput.focus(), 60);

    overlay.querySelector('#btnGroupModalSubmit').addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) {
        if (typeof window.toast === 'function') window.toast('Lütfen grup adını belirtin.', 'warning');
        nameInput.focus();
        return;
      }

      const checkedBoxes = overlay.querySelectorAll('.frp-group-member-chk:checked');
      const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);

      if (selectedIds.length === 0) {
        if (typeof window.toast === 'function') window.toast('Lütfen gruba eklemek için en az bir kişi seçin.', 'warning');
        return;
      }

      const btnSubmit = overlay.querySelector('#btnGroupModalSubmit');
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Oluşturuluyor...';

      try {
        const res = await fetch('/api/chat/groups', {
          method: 'POST',
          headers: (window.FrpAuth && window.FrpAuth.getAuthHeaders) ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, memberUserIds: selectedIds })
        });
        const data = await res.json();
        if (res.ok && data.success && data.group) {
          closeFn();
          if (typeof window.toast === 'function') window.toast(`"${name}" grubu başarıyla oluşturuldu!`, 'success');
          await fetchChatGroups();
          openChatWindow({ group: data.group });
        } else {
          if (typeof window.toast === 'function') window.toast(data.reason || 'Grup oluşturulamadı.', 'error');
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Grup Oluştur 🚀';
        }
      } catch (err) {
        if (typeof window.toast === 'function') window.toast('Bağlantı hatası: ' + err.message, 'error');
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Grup Oluştur 🚀';
      }
    });
  }

  // ── DİNAMİK PENCERE HİZALAMA (BOŞLUKSUZ & TAŞMAYI ÖNLEYEN YERLEŞİM) ──
  function realignChatWindows() {
    const isDockOpen = panel && panel.classList.contains('open');
    const baseOffset = isDockOpen ? 355 : 24;
    const vpWidth = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1920;

    // Ekrana sığabilecek maksimum açık (genişletilmiş) pencere sayısı
    const maxExpanded = Math.max(1, Math.min(3, Math.floor((vpWidth - baseOffset - 60) / 365)));

    const windowsArr = Array.from(activeChatWindows.values());
    const expandedWins = windowsArr.filter(w => !w.el.classList.contains('minimized'));

    // Çok fazla pencere varsa en eskileri otomatik minimize et
    if (expandedWins.length > maxExpanded) {
      const toMinimizeCount = expandedWins.length - maxExpanded;
      for (let i = 0; i < toMinimizeCount; i++) {
        expandedWins[i].el.classList.add('minimized');
      }
    }

    let currentRight = baseOffset;
    windowsArr.forEach((winObj) => {
      const isMin = winObj.el.classList.contains('minimized');
      const winWidth = isMin ? 220 : 350;

      // Sol kenardan taşmayı önle
      if (currentRight + winWidth > vpWidth - 16) {
        if (!isMin) {
          winObj.el.classList.add('minimized');
        }
      }

      winObj.el.style.right = `${currentRight}px`;
      winObj.el.style.transition = 'right 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.2s ease, width 0.2s ease';

      const step = winObj.el.classList.contains('minimized') ? 228 : 358;
      currentRight += step;
    });
  }

  // ── GERÇEK ZAMANLI KURUMSAL SOHBET PENCERESİ ──────────
  function openChatWindow({ targetUser, room, group }) {
    const isRoom = Boolean(room);
    const isGroup = Boolean(group);
    const chatId = isGroup ? group.id : (isRoom ? room.id : String(targetUser.id));
    const chatTitle = isGroup ? group.name : (isRoom ? room.name : (targetUser.fullName || targetUser.username));

    const currentAuthUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
    const isAdmin = Boolean(currentAuthUser && currentAuthUser.role === 'admin');
    const myId = currentAuthUser ? String(currentAuthUser.id) : '';

    // Zaten açıksa öne al
    if (activeChatWindows.has(chatId)) {
      const activeObj = activeChatWindows.get(chatId);
      activeObj.el.classList.remove('minimized');
      realignChatWindows();
      const inp = activeObj.el.querySelector('.frp-chat-input');
      if (inp) inp.focus();
      return;
    }

    const isDockOpen = panel && panel.classList.contains('open');
    const baseOffset = isDockOpen ? 355 : 24;
    const rightOffset = baseOffset + (activeChatWindows.size * 358);

    const chatEl = document.createElement('div');
    chatEl.className = 'frp-chat-window';
    chatEl.style.right = `${rightOffset}px`;

    const userStatus = (!isRoom && !isGroup) ? (targetUser.status || (targetUser.isOnline ? 'online' : 'offline')) : 'online';
    let statusDotColor = '#10b981';
    let statusText = isGroup
      ? `${(group.memberUserIds || []).length} Katılımcı · Grup Sohbeti`
      : (isRoom
          ? 'Kurumsal Duyuru Kanalı'
          : (targetUser.isSelfNote
              ? 'Kişisel Not Kutusu'
              : (userStatus === 'online' ? 'Çevrimiçi' : (userStatus === 'busy' ? 'Meşgul' : (userStatus === 'dnd' ? 'Rahatsız Etmeyin' : formatRelativeTime(targetUser.lastSeen))))));

    if (!isRoom && !isGroup && !targetUser.isSelfNote) {
      if (userStatus === 'busy') statusDotColor = '#f59e0b';
      else if (userStatus === 'dnd') statusDotColor = '#ef4444';
      else if (userStatus === 'offline') statusDotColor = '#94a3b8';
    }

    const userInitials = isGroup ? (group.icon || '👥') : (isRoom ? (room.icon || '🏢') : (targetUser.isSelfNote ? '📌' : getCleanInitials(targetUser.fullName, targetUser.username)));
    const avatarBg = isGroup
      ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
      : (isRoom
          ? 'linear-gradient(135deg, #059669, #10b981)'
          : (targetUser.isSelfNote ? 'linear-gradient(135deg, #2563eb, #6366f1)' : getAvatarGradient(chatTitle)));

    let userAvatarInner = '';
    if (isRoom || isGroup || targetUser?.isSelfNote) {
      userAvatarInner = `<span style="font-size:1rem; font-weight:800; color:#ffffff;">${escHtml(userInitials)}</span>`;
    } else {
      userAvatarInner = renderAvatarContent(targetUser?.avatar, userInitials);
    }

    const isReadOnlyRoom = isRoom && !isAdmin;

    chatEl.innerHTML = `
      <!-- BAŞLIK BARI -->
      <div class="frp-chat-header">
        <div class="frp-chat-header-user">
          <div class="frp-chat-avatar-wrap">
            <div class="frp-chat-avatar" style="background: ${avatarBg}; overflow:hidden; display:flex; align-items:center; justify-content:center;">${userAvatarInner}</div>
            ${(!isRoom && !isGroup) ? `<span class="frp-chat-status-dot ${userStatus === 'online' ? 'frp-online-pulse' : ''}" style="background-color: ${statusDotColor};"></span>` : ''}
          </div>
          <div class="frp-chat-header-text">
            <div class="frp-chat-header-name" title="${escHtml(chatTitle)}">${escHtml(chatTitle)}</div>
            <div class="frp-chat-header-status">
              <span>${escHtml(statusText)}</span>
              ${(!isRoom && !isGroup && userStatus === 'online') ? `<span class="frp-chat-live-badge">CANLI</span>` : ''}
              ${(!isRoom && !isGroup && !targetUser.isSelfNote && targetUser.department) ? `<span class="frp-presence-dept-badge" style="margin-left: 3px; font-size: 0.62rem;">${escHtml(targetUser.department)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="frp-chat-header-controls">
          ${isGroup ? `<button type="button" class="frp-chat-btn-ctrl btn-group-info" title="Grup Bilgisi & Katılımcılar">👥</button>` : ''}
          ${!isRoom ? `<button type="button" class="frp-chat-btn-ctrl btn-nudge" title="Titreşim Gönder (📳 MSN Titret)">📳</button>` : ''}
          <button type="button" class="frp-chat-btn-ctrl btn-media-gallery" title="Paylaşılan Medya & Belgeler (İnovasyon)">📁</button>
          <button type="button" class="frp-chat-btn-ctrl btn-search" title="Sohbette Ara">🔍</button>
          ${(!isRoom && !isGroup) || isAdmin ? `<button type="button" class="frp-chat-btn-ctrl btn-clear-chat" title="Sohbeti Sil / Temizle" style="color:#ef4444;">🗑️</button>` : ''}
          <button type="button" class="frp-chat-btn-ctrl btn-maximize" title="Ekranı Büyüt / Eski Boyut">⛶</button>
          <button type="button" class="frp-chat-btn-ctrl btn-minimize" title="Simge Durumuna Küçült">─</button>
          <button type="button" class="frp-chat-btn-ctrl btn-close" title="Kapat">✕</button>
        </div>
      </div>

      <!-- GRUP BİLGİSİ VE ÜYE YÖNETİM ÇEKMECESİ -->
      ${isGroup ? `
        <div class="frp-group-info-drawer" id="frpGroupInfoDrawer">
          <div class="frp-group-info-header">
            <span class="frp-group-info-title">👥 Grup Detayı & Üyeler</span>
            <button type="button" class="frp-chat-btn-ctrl btn-group-info-close">✕</button>
          </div>
          <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:0.65rem;">
            <div style="background:var(--bg-card, #f8fafc); border:1px solid var(--border-light, #e2e8f0); border-radius:10px; padding:0.65rem; font-size:0.75rem;">
              <div style="font-weight:800; color:var(--text-primary); font-size:0.85rem;">${escHtml(chatTitle)}</div>
              <div style="color:var(--text-muted); font-size:0.7rem; margin-top:2px;">Kurucu: <b>${escHtml(group.createdByName || 'Ekip')}</b></div>
            </div>
            <div style="font-size:0.72rem; font-weight:800; color:var(--text-secondary); margin-top:0.2rem;">Grup Katılımcıları</div>
            <div id="frpGroupMembersListWrap">
              <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.75rem;">Üyeler yükleniyor...</div>
            </div>
            <button type="button" class="frp-btn-leave-group" id="btnLeaveGroupAction">
              🚪 Bu Gruptan Ayrıl
            </button>
          </div>
        </div>
      ` : ''}

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
        <!-- CANLI YAZIYOR GÖSTERGESİ -->
        <div class="frp-typing-indicator" style="display: none;">
          <div class="typing-bubble">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
          <span class="typing-text"></span>
        </div>
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

      <!-- HIZLI YANIT ÇİPLERİ (QUICK REPLIES) -->
      ${!isReadOnlyRoom ? `
        <div class="frp-chat-quick-replies">
          <button type="button" class="frp-chat-quick-chip" data-quick="👍 İnceliyorum">👍 İnceliyorum</button>
          <button type="button" class="frp-chat-quick-chip" data-quick="✅ Onaylandı">✅ Onaylandı</button>
          <button type="button" class="frp-chat-quick-chip" data-quick="📋 Rapor hazır">📋 Rapor hazır</button>
          <button type="button" class="frp-chat-quick-chip" data-quick="📞 Arıyorum">📞 Arıyorum</button>
          <button type="button" class="frp-chat-quick-chip" data-quick="⏳ Birazdan döneceğim">⏳ Birazdan döneceğim</button>
        </div>
      ` : ''}

      <!-- FOOTER / GİRİŞ ALANI (INSTAGRAM DM KAPSÜLÜ VEYA DUYURU BİLGİSİ) -->
      <div class="frp-chat-footer" ${isReadOnlyRoom ? 'style="padding:0;"' : ''}>
        ${isReadOnlyRoom ? `
          <div class="frp-chat-readonly-notice">📢 Bu resmi duyuru kanalıdır. Sadece sistem yöneticileri paylaşım yapabilir.</div>
        ` : `
          <div class="frp-chat-input-row">
            <input type="file" class="frp-chat-file-input" accept="image/*,application/pdf" style="display: none;" />
            <input type="file" class="frp-chat-audio-fallback" accept="audio/*" style="display: none;" />
            <button type="button" class="frp-chat-btn-action btn-attach" title="Dosya veya Görsel Ekle">📎</button>
            <button type="button" class="frp-chat-btn-action btn-audio-fallback" title="Ses Dosyası Yükle (.mp3, .wav, .m4a)">🎵</button>
            <button type="button" class="frp-chat-btn-action btn-emoji-toggle" title="Emoji Ekle">😀</button>
            <input type="text" class="frp-chat-input" placeholder="Bir mesaj yazın..." maxlength="1000" />
            <button type="button" class="frp-chat-btn-action btn-mic" title="Gerçek Ses Kaydı (Bas Konuş)">🎙️</button>
            ${!isRoom ? '<button type="button" class="frp-chat-btn-action btn-nudge-action" title="Titreşim Gönder (📳 MSN Titret)">📳</button>' : ''}
            <button type="button" class="frp-chat-send-btn" title="Gönder">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        `}
      </div>
    `;

    document.body.appendChild(chatEl);

    // Hızlı yanıt çipleri dinleyicileri
    chatEl.querySelectorAll('.frp-chat-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (input) {
          input.value = chip.dataset.quick || chip.textContent;
          input.focus();
        }
      });
    });

    // Kontroller
    const btnClose = chatEl.querySelector('.btn-close');
    const btnMinimize = chatEl.querySelector('.btn-minimize');
    const btnMaximize = chatEl.querySelector('.btn-maximize');
    const btnClearChat = chatEl.querySelector('.btn-clear-chat');
    const btnGroupInfo = chatEl.querySelector('.btn-group-info');
    const groupInfoDrawer = chatEl.querySelector('#frpGroupInfoDrawer');
    const btnGroupInfoClose = chatEl.querySelector('.btn-group-info-close');
    const btnLeaveGroup = chatEl.querySelector('#btnLeaveGroupAction');
    const groupMembersWrap = chatEl.querySelector('#frpGroupMembersListWrap');
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
    const btnAudioFallback = chatEl.querySelector('.btn-audio-fallback');
    const audioFallbackInput = chatEl.querySelector('.frp-chat-audio-fallback');
    const btnMic = chatEl.querySelector('.btn-mic');
    const msgStream = chatEl.querySelector('.frp-chat-messages-stream');
    const typingIndicator = chatEl.querySelector('.frp-typing-indicator');
    const chatHeader = chatEl.querySelector('.frp-chat-header');
    const btnNudgeHeader = chatEl.querySelector('.btn-nudge');
    const btnNudgeAction = chatEl.querySelector('.btn-nudge-action');

    let isRecordingVoice = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let recordingStartTime = 0;
    let recordingTimer = null;
    let seenMsgIds = new Set();
    let isInitialStream = true;

    // ── MSN TITRET / NUDGE GÖNDERME ──
    let nudgeCooldownTimer = null;
    function triggerNudge() {
      if (btnNudgeAction && btnNudgeAction.disabled) return;

      fetch('/api/chat/nudge', {
        method: 'POST',
        headers: (window.FrpAuth && window.FrpAuth.getAuthHeaders) ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: (!isRoom && !isGroup) ? chatId : null,
          groupId: isGroup ? chatId : null
        })
      }).then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          // Yerel sallanma ve ses (1.2 saniye zengin titreşim)
          chatEl.classList.remove('msn-shaking');
          void chatEl.offsetWidth;
          chatEl.classList.add('msn-shaking');
          setTimeout(() => chatEl.classList.remove('msn-shaking'), 1200);
          playMsnNudgeSound();
          if (navigator.vibrate) navigator.vibrate([250, 100, 350, 100, 450]);

          let remainSec = 15;
          const updateBtn = () => {
            if (btnNudgeAction) {
              btnNudgeAction.disabled = true;
              btnNudgeAction.classList.add('cooling-down');
              btnNudgeAction.title = `Lütfen bekleyin (${remainSec}s)`;
            }
            if (btnNudgeHeader) {
              btnNudgeHeader.disabled = true;
              btnNudgeHeader.title = `Lütfen bekleyin (${remainSec}s)`;
            }
          };
          updateBtn();
          nudgeCooldownTimer = setInterval(() => {
            remainSec--;
            if (remainSec <= 0) {
              clearInterval(nudgeCooldownTimer);
              if (btnNudgeAction) {
                btnNudgeAction.disabled = false;
                btnNudgeAction.classList.remove('cooling-down');
                btnNudgeAction.title = 'Titreşim Gönder (📳 MSN Titret)';
              }
              if (btnNudgeHeader) {
                btnNudgeHeader.disabled = false;
                btnNudgeHeader.title = 'Titreşim Gönder (📳 MSN Titret)';
              }
            } else {
              updateBtn();
            }
          }, 1000);

          loadMessages();
        } else {
          if (typeof window.toast === 'function') window.toast(data.reason || 'Titreşim gönderilemedi.', 'warning');
        }
      }).catch(err => {
        if (typeof window.toast === 'function') window.toast('Titreşim hatası: ' + err.message, 'error');
      });
    }

    if (btnNudgeHeader) btnNudgeHeader.addEventListener('click', triggerNudge);
    if (btnNudgeAction) btnNudgeAction.addEventListener('click', triggerNudge);

    // Grup Detayı ve Üyeleri
    async function loadGroupDetails() {
      if (!isGroup || !groupMembersWrap) return;
      groupMembersWrap.innerHTML = '<div style="text-align:center; padding:1.2rem; color:var(--text-muted); font-size:0.75rem;">Üyeler taranıyor...</div>';
      try {
        const res = await fetch(`/api/chat/groups/${encodeURIComponent(chatId)}/details`, {
          headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : {}
        });
        const data = await res.json();
        if (res.ok && data && data.success && data.group) {
          const g = data.group;
          const members = g.members || [];
          const isMeAdmin = String(g.createdBy) === myId || isAdmin;

          if (members.length === 0) {
            groupMembersWrap.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.75rem;">Katılımcı bulunamadı.</div>';
            return;
          }

          groupMembersWrap.innerHTML = '';
          members.forEach(mem => {
            const memDiv = document.createElement('div');
            memDiv.className = 'frp-group-member-card';

            const isThisCreator = String(mem.id) === String(g.createdBy);
            const isSelf = String(mem.id) === myId;
            const initials = getCleanInitials(mem.fullName, mem.username);
            const gradient = getAvatarGradient(mem.fullName || mem.username);

            const memAvatar = renderAvatarContent(mem.avatar, initials, true);

            memDiv.innerHTML = `
              <div style="display:flex; align-items:center; gap:0.55rem; min-width:0;">
                <div class="frp-presence-avatar" style="width:28px; height:28px; border-radius:50%; background:${gradient}; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:800; color:#fff; flex-shrink:0; overflow:hidden;">
                  ${memAvatar}
                </div>
                <div style="min-width:0;">
                  <div style="font-size:0.76rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${escHtml(mem.fullName || mem.username)} ${isSelf ? '<b>(Siz)</b>' : ''}
                  </div>
                  <div style="font-size:0.65rem; color:var(--text-muted);">
                    @${escHtml(mem.username)} ${mem.department ? '· ' + escHtml(mem.department) : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:0.4rem; flex-shrink:0;">
                <span class="frp-group-role-badge ${isThisCreator ? 'admin' : 'member'}">
                  ${isThisCreator ? '👑 Yönetici' : 'Üye'}
                </span>
                ${(isMeAdmin && !isSelf && !isThisCreator) ? `
                  <button type="button" class="frp-btn-kick-member" data-user-id="${escHtml(String(mem.id))}" data-user-name="${escHtml(mem.fullName || mem.username)}" title="Gruptan Çıkar">
                    ✕ Çıkar
                  </button>
                ` : ''}
              </div>
            `;

            const btnKick = memDiv.querySelector('.frp-btn-kick-member');
            if (btnKick) {
              btnKick.addEventListener('click', (e) => {
                e.stopPropagation();
                const uId = btnKick.dataset.userId;
                const uName = btnKick.dataset.userName;
                const doKick = async () => {
                  try {
                    const kickRes = await fetch(`/api/chat/groups/${encodeURIComponent(chatId)}/members/${encodeURIComponent(uId)}`, {
                      method: 'DELETE',
                      headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : {}
                    });
                    const kData = await kickRes.json().catch(() => ({}));
                    if (kickRes.ok && kData.success) {
                      if (typeof window.toast === 'function') window.toast(`"${uName}" gruptan çıkarıldı.`, 'success');
                      loadGroupDetails();
                      fetchChatGroups();
                    } else {
                      if (typeof window.toast === 'function') window.toast(kData.reason || 'Üye çıkarılamadı.', 'error');
                    }
                  } catch (err) {
                    if (typeof window.toast === 'function') window.toast('Hata: ' + err.message, 'error');
                  }
                };

                if (typeof window.showConfirmDialog === 'function') {
                  window.showConfirmDialog({
                    title: 'Üyeyi Gruptan Çıkar',
                    message: `<b>"${escHtml(uName)}"</b> kullanıcısını bu gruptan çıkarmak istediğinizden emin misiniz?`,
                    confirmText: 'Evet, Çıkar',
                    cancelText: 'Vazgeç',
                    isDanger: true,
                    onConfirm: doKick
                  });
                } else {
                  doKick();
                }
              });
            }

            groupMembersWrap.appendChild(memDiv);
          });
        }
      } catch (err) {
        groupMembersWrap.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.75rem;">Detaylar yüklenemedi.</div>';
      }
    }

    if (btnGroupInfo) {
      btnGroupInfo.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!groupInfoDrawer) return;
        const isOpen = groupInfoDrawer.classList.contains('open');
        if (isOpen) {
          groupInfoDrawer.classList.remove('open');
        } else {
          groupInfoDrawer.classList.add('open');
          loadGroupDetails();
        }
      });
    }

    if (btnGroupInfoClose) {
      btnGroupInfoClose.addEventListener('click', (e) => {
        e.stopPropagation();
        groupInfoDrawer?.classList.remove('open');
      });
    }

    if (btnLeaveGroup) {
      btnLeaveGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        const doLeave = async () => {
          try {
            const res = await fetch(`/api/chat/groups/${encodeURIComponent(chatId)}/leave`, {
              method: 'POST',
              headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : {}
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
              if (typeof window.toast === 'function') window.toast(`"${chatTitle}" grubundan ayrıldınız.`, 'success');
              clearInterval(pollTimer);
              chatEl.remove();
              activeChatWindows.delete(chatId);
              realignChatWindows();
              fetchChatGroups();
            } else {
              if (typeof window.toast === 'function') window.toast(data.reason || 'Gruptan ayrılamadı.', 'error');
            }
          } catch (err) {
            if (typeof window.toast === 'function') window.toast('Hata: ' + err.message, 'error');
          }
        };

        if (typeof window.showConfirmDialog === 'function') {
          window.showConfirmDialog({
            title: 'Gruptan Ayrıl',
            message: `<b>"${escHtml(chatTitle)}"</b> grubundan ayrılmak istediğinizden emin misiniz?<br><span style="font-size:0.75rem;color:var(--text-muted);">Grup mesajlarını artık alamayacaksınız.</span>`,
            confirmText: 'Evet, Gruptan Ayrıl',
            cancelText: 'Vazgeç',
            isDanger: true,
            onConfirm: doLeave
          });
        } else {
          doLeave();
        }
      });
    }

    // Pencere Takibi ve Otomatik Polling (Her 2.5 saniyede bir yeni mesajları sorgula)
    let currentMessages = [];
    async function loadMessages() {
      if (!window.FrpAuth || !window.FrpAuth.isLoggedIn()) return;
      try {
        const query = isGroup
          ? `groupId=${encodeURIComponent(chatId)}`
          : (isRoom ? `roomId=${encodeURIComponent(chatId)}` : `peerId=${encodeURIComponent(chatId)}`);
        const res = await fetch(`/api/chat/messages?${query}`, {
          headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.messages)) {
            currentMessages = data.messages;
            if (currentMessages.length > 0) {
              const lastMsg = currentMessages[currentMessages.length - 1];
              const t = new Date(lastMsg.createdAt).getTime();
              if (t > (localLastInteractions[chatId] || 0)) {
                localLastInteractions[chatId] = t;
                if (currentTab === 'users') renderUsers();
              }
            }
            renderMessageStream(currentMessages);
          }

          if (typingIndicator) {
            if (data && Array.isArray(data.typingUsers) && data.typingUsers.length > 0) {
              const typerNames = data.typingUsers.join(', ');
              typingIndicator.style.display = 'flex';
              const tText = typingIndicator.querySelector('.typing-text');
              if (tText) tText.textContent = `${typerNames} yazıyor...`;
            } else {
              typingIndicator.style.display = 'none';
            }
          }
        }
      } catch {}
    }

    // Okundu işaretleme
    if (!isRoom && !isGroup) {
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
      if (nudgeCooldownTimer) clearInterval(nudgeCooldownTimer);
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

    if (btnClearChat) {
      btnClearChat.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetName = chatTitle || 'bu sohbetin';
        const doClear = async () => {
          try {
            const chatType = isRoom ? 'room' : (isGroup ? 'group' : 'peer');
            const res = await fetch(`/api/chat/conversations/${encodeURIComponent(chatId)}?type=${chatType}`, {
              method: 'DELETE',
              headers: (window.FrpAuth && window.FrpAuth.getAuthHeaders) ? window.FrpAuth.getAuthHeaders() : {}
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
              if (typeof window.toast === 'function') window.toast('Sohbet geçmişi temizlendi.', 'success');
              msgStream.innerHTML = '';
              loadMessages();
            } else {
              if (typeof window.toast === 'function') window.toast(data.reason || 'Sohbet temizlenemedi.', 'error');
            }
          } catch (err) {
            if (typeof window.toast === 'function') window.toast('Hata: ' + err.message, 'error');
          }
        };

        if (typeof window.showConfirmDialog === 'function') {
          window.showConfirmDialog({
            title: 'Sohbet Geçmişini Temizle',
            message: `<b>"${escHtml(targetName)}"</b> sohbetinin tüm mesaj geçmişini silmek istediğinizden emin misiniz?<br><span style="font-size:0.75rem;color:var(--text-muted);">Bu işlem geri alınamaz. Devam etmek istiyor musunuz?</span>`,
            confirmText: 'Evet, Tümünü Sil',
            cancelText: 'Vazgeç',
            isDanger: true,
            onConfirm: doClear
          });
        } else {
          doClear();
        }
      });
    }

    chatHeader.addEventListener('click', () => {
      if (chatEl.classList.contains('minimized')) {
        chatEl.classList.remove('minimized');
        if (input) input.focus();
      }
    });

    // Paylaşılan Medya & Belgeler Çekmecesi (İnovasyon 4)
    async function loadSharedMediaGallery() {
      mediaGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: var(--text-muted); font-size: 0.78rem;">Medya ve belgeler taranıyor...</div>`;
      try {
        const query = isGroup
          ? `groupId=${encodeURIComponent(chatId)}&mediaOnly=true`
          : (isRoom ? `roomId=${encodeURIComponent(chatId)}&mediaOnly=true` : `peerId=${encodeURIComponent(chatId)}&mediaOnly=true`);
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
                  openImageLightbox({ src: m.attachment.dataUrl, name: m.attachment.name });
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
          if (input) {
            input.value += emoji;
            input.focus();
          }
        });
        emojiGrid.appendChild(btn);
      });
    }

    if (btnEmojiToggle) {
      btnEmojiToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = emojiPicker.style.display === 'block';
        emojiPicker.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
          renderEmojiGrid('faces');
        }
      });
    }

    emojiPicker.querySelectorAll('.emoji-tab-btn').forEach(tbtn => {
      tbtn.addEventListener('click', () => {
        emojiPicker.querySelectorAll('.emoji-tab-btn').forEach(b => b.classList.remove('active'));
        tbtn.classList.add('active');
        renderEmojiGrid(tbtn.dataset.cat);
      });
    });

    // Dosya Ekleme
    if (btnAttach && fileInput) {
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
    }

    // Doğrudan Ses Dosyası Yükleme (.mp3, .wav, .m4a vb.)
    if (btnAudioFallback && audioFallbackInput) {
      btnAudioFallback.addEventListener('click', () => audioFallbackInput.click());
      audioFallbackInput.addEventListener('change', () => {
        const file = audioFallbackInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          sendMessage({
            text: `🎙️ Ses Kaydı (${file.name})`,
            voice: {
              dataUrl: reader.result,
              duration: 10
            }
          });
        };
        reader.readAsDataURL(file);
        audioFallbackInput.value = '';
      });
    }

    // Gerçek Ses Kaydı (MediaRecorder API) & Akıllı Hata Yönetimi
    if (btnMic) {
      btnMic.addEventListener('click', async () => {
        if (!isRecordingVoice) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
              ? 'audio/webm;codecs=opus'
              : (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm'))
              ? 'audio/webm'
              : (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/mp4'))
              ? 'audio/mp4'
              : '';
            mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            audioChunks = [];
            recordingStartTime = Date.now();

            mediaRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
              clearInterval(recordingTimer);
              const durationSec = Math.max(1, Math.round((Date.now() - recordingStartTime) / 1000));
              const recordedType = mediaRecorder.mimeType || mimeType || 'audio/webm';
              const audioBlob = new Blob(audioChunks, { type: recordedType });
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
            if (input) input.placeholder = 'Ses kaydediliyor (0sn)... Göndermek için mikrofona tekrar basın.';
            recordingTimer = setInterval(() => {
              const sec = Math.round((Date.now() - recordingStartTime) / 1000);
              if (input) input.placeholder = `Ses kaydediliyor (${sec}sn)... Göndermek için mikrofona tekrar basın.`;
            }, 1000);
          } catch (err) {
            let userHelp = 'Mikrofon erişimi sağlanamadı: ' + err.message;
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              userHelp = 'Mikrofon izni tarayıcı tarafından engellendi. Adres çubuğundaki kilit simgesinden izin verebilir veya ses dosyası yükleyebilirsiniz.';
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
              userHelp = 'Cihazınızda bağlı bir mikrofon bulunamadı. Ses dosyası yükleyebilirsiniz.';
            }
            if (typeof window.toast === 'function') window.toast(userHelp, 'warning');
            if (audioFallbackInput) {
              setTimeout(() => audioFallbackInput.click(), 450);
            }
          }
        } else {
          isRecordingVoice = false;
          btnMic.style.color = 'inherit';
          btnMic.classList.remove('recording-pulse');
          clearInterval(recordingTimer);
          if (input) input.placeholder = 'Bir mesaj yazın...';
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        }
      });
    }

    // Mesaj Gönderme Mantığı (İyimser UI & Anlık Sıralama Bumps)
    async function sendMessage(payload) {
      const currentAuth = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
      if (!currentAuth) return;

      const bodyData = {
        receiverId: (!isRoom && !isGroup) ? chatId : null,
        roomId: isRoom ? chatId : null,
        groupId: isGroup ? chatId : null,
        text: payload.text || '',
        attachment: payload.attachment || null,
        voice: payload.voice || null
      };

      localLastInteractions[chatId] = Date.now();
      if (currentTab === 'users') renderUsers();

      // İyimser UI
      const tempId = 'temp_' + Date.now();
      const optimisticMsg = {
        id: tempId,
        senderId: currentAuth.id,
        senderName: currentAuth.full_name || currentAuth.username || 'Siz',
        senderUsername: currentAuth.username,
        text: payload.text || '',
        attachment: payload.attachment || null,
        voice: payload.voice || null,
        reactions: {},
        isRead: false,
        createdAt: new Date().toISOString(),
        isOptimistic: true
      };

      const optimisticDiv = createMessageDiv(optimisticMsg, true, String(currentAuth.id));
      optimisticDiv.classList.add('optimistic-pending');
      optimisticDiv.dataset.text = payload.text || '';
      optimisticDiv.style.opacity = '0.75';
      msgStream.appendChild(optimisticDiv);
      msgStream.scrollTop = msgStream.scrollHeight;

      try {
        const res = await fetch('/api/chat/send', {
          method: 'POST',
          headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.message) {
            localLastInteractions[chatId] = Date.now();
            currentMessages = currentMessages.filter(m => m.id !== tempId);
            currentMessages.push(data.message);
            renderMessageStream(currentMessages);
            if (currentTab === 'users') renderUsers();
          }
        }
      } catch (err) {
        console.warn('Mesaj gönderilemedi:', err);
      }
    }

    function playMessageSentSound() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } catch {}
    }

    function handleSend() {
      if (!input) return;
      const text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      if (emojiPicker) emojiPicker.style.display = 'none';
      if (btnSend) {
        btnSend.classList.add('sent-ripple');
        setTimeout(() => btnSend.classList.remove('sent-ripple'), 300);
      }
      playMessageSentSound();
      sendMessage({ text });
    }

    if (btnSend) btnSend.addEventListener('click', handleSend);
    let lastTypingSent = 0;
    if (input) {
      input.addEventListener('input', () => {
        const now = Date.now();
        if (now - lastTypingSent > 2000 && (input.value || '').trim()) {
          lastTypingSent = now;
          fetch('/api/chat/typing', {
            method: 'POST',
            headers: (window.FrpAuth && window.FrpAuth.getAuthHeaders) ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              peerId: (!isRoom && !isGroup) ? chatId : null,
              roomId: isRoom ? chatId : null,
              groupId: isGroup ? chatId : null
            })
          }).catch(() => {});
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    // Ses Oynatıcı Bağlayıcı (WebM Duration Fallback & Seeking & Equalizer & Fallback Audio)
    function bindAudioPlayer(audioPlayer, m) {
      const btnPlay = audioPlayer.querySelector('.frp-audio-play-btn');
      const audioEl = audioPlayer.querySelector('audio');
      const progBar = audioPlayer.querySelector('.frp-audio-progress-bar');
      const timeSpan = audioPlayer.querySelector('.frp-audio-time');
      const track = audioPlayer.querySelector('.frp-audio-track');
      const fallbackDuration = (m.voice && m.voice.duration > 0) ? m.voice.duration : 10;

      function getEffectiveDuration() {
        return (isFinite(audioEl.duration) && audioEl.duration > 0) ? audioEl.duration : fallbackDuration;
      }

      let standaloneAudio = null;

      const togglePlay = () => {
        if (standaloneAudio && !standaloneAudio.paused) {
          standaloneAudio.pause();
          btnPlay.textContent = '▶️';
          audioPlayer.classList.remove('playing');
          return;
        }

        if (audioEl.paused) {
          document.querySelectorAll('audio').forEach(a => { if (a !== audioEl) a.pause(); });
          try {
            const p = audioEl.play();
            if (p && typeof p.then === 'function') {
              p.then(() => {
                btnPlay.textContent = '⏸️';
                audioPlayer.classList.add('playing');
              }).catch(err => {
                console.warn('Audio play() hatası, doğrudan Audio nesnesi ile deneniyor:', err);
                try {
                  if (!standaloneAudio) {
                    standaloneAudio = new Audio(audioEl.src);
                    standaloneAudio.ontimeupdate = () => {
                      const dur = getEffectiveDuration();
                      if (dur > 0) {
                        const cur = standaloneAudio.currentTime || 0;
                        const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
                        progBar.style.width = pct + '%';
                        const cMin = Math.floor(cur / 60);
                        const cSec = String(Math.floor(cur % 60)).padStart(2, '0');
                        const dMin = Math.floor(dur / 60);
                        const dSec = String(Math.floor(dur % 60)).padStart(2, '0');
                        timeSpan.textContent = `${cMin}:${cSec} / ${dMin}:${dSec}`;
                      }
                    };
                    standaloneAudio.onended = () => {
                      btnPlay.textContent = '▶️';
                      audioPlayer.classList.remove('playing');
                      progBar.style.width = '0%';
                    };
                  }
                  standaloneAudio.play().then(() => {
                    btnPlay.textContent = '⏸️';
                    audioPlayer.classList.add('playing');
                  }).catch(() => {
                    btnPlay.textContent = '▶️';
                    audioPlayer.classList.remove('playing');
                  });
                } catch {
                  btnPlay.textContent = '▶️';
                  audioPlayer.classList.remove('playing');
                }
              });
            } else {
              btnPlay.textContent = '⏸️';
              audioPlayer.classList.add('playing');
            }
          } catch {
            btnPlay.textContent = '▶️';
            audioPlayer.classList.remove('playing');
          }
        } else {
          audioEl.pause();
          btnPlay.textContent = '▶️';
          audioPlayer.classList.remove('playing');
        }
      };

      btnPlay.addEventListener('click', (ev) => {
        ev.stopPropagation();
        togglePlay();
      });

      if (track) {
        track.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const rect = track.getBoundingClientRect();
          const clickX = Math.max(0, Math.min(ev.clientX - rect.left, rect.width));
          const pct = clickX / (rect.width || 1);
          const targetDuration = getEffectiveDuration();
          if (standaloneAudio) standaloneAudio.currentTime = pct * targetDuration;
          else audioEl.currentTime = pct * targetDuration;
          progBar.style.width = (pct * 100) + '%';
        });
      }

      audioEl.addEventListener('timeupdate', () => {
        const dur = getEffectiveDuration();
        if (dur > 0) {
          const cur = audioEl.currentTime || 0;
          const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
          progBar.style.width = pct + '%';
          const cMin = Math.floor(cur / 60);
          const cSec = String(Math.floor(cur % 60)).padStart(2, '0');
          const dMin = Math.floor(dur / 60);
          const dSec = String(Math.floor(dur % 60)).padStart(2, '0');
          timeSpan.textContent = `${cMin}:${cSec} / ${dMin}:${dSec}`;
        }
      });

      audioEl.addEventListener('ended', () => {
        btnPlay.textContent = '▶️';
        audioPlayer.classList.remove('playing');
        progBar.style.width = '0%';
        const dur = getEffectiveDuration();
        const dMin = Math.floor(dur / 60);
        const dSec = String(Math.floor(dur % 60)).padStart(2, '0');
        timeSpan.textContent = `0:00 / ${dMin}:${dSec}`;
      });

      audioEl.addEventListener('pause', () => {
        btnPlay.textContent = '▶️';
        audioPlayer.classList.remove('playing');
      });
    }

    // Tekil Mesaj DOM Elemanı Üretici
    function createMessageDiv(m, isSelf, myId) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `frp-chat-msg ${isSelf ? 'outgoing' : 'incoming'}`;
      msgDiv.dataset.msgId = m.id;

      const isNudgeMsg = Boolean(m.isNudge || (m.text && m.text.includes('📳')));
      if (isNudgeMsg) msgDiv.classList.add('nudge-msg');

      const isNew = !seenMsgIds.has(m.id);
      seenMsgIds.add(m.id);
      if (!isInitialStream && isNew && isNudgeMsg && !isSelf) {
        chatEl.classList.remove('msn-shaking');
        void chatEl.offsetWidth;
        chatEl.classList.add('msn-shaking');
        setTimeout(() => chatEl.classList.remove('msn-shaking'), 1200);
        playMsnNudgeSound();
        if (navigator.vibrate) navigator.vibrate([250, 100, 350, 100, 450]);
      }

      const time = new Date(m.createdAt || Date.now());
      const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

      let contentHtml = escHtml(m.text || '');

      const isAudioAttachment = m.attachment && m.attachment.dataUrl && (
        (m.attachment.type || '').startsWith('audio/') ||
        /\.(mp3|wav|m4a|ogg|aac|flac|opus|webm)$/i.test(m.attachment.name || '')
      );

      if (m.attachment && m.attachment.dataUrl && !isAudioAttachment) {
        if ((m.attachment.type || '').startsWith('image/')) {
          contentHtml += `
            <div class="frp-chat-img-thumb-wrap" title="Büyütmek için tıklayın">
              <img src="${m.attachment.dataUrl}" alt="${escHtml(m.attachment.name || 'Görsel')}" />
              <div class="frp-chat-img-overlay">
                <button type="button" class="frp-chat-img-action-btn btn-open-img-lightbox" title="Büyüt ve Önizle">🔍 Önizle</button>
                <button type="button" class="frp-chat-img-action-btn btn-download-img" title="Görseli İndir">⬇️ İndir</button>
              </div>
            </div>
          `;
        } else {
          contentHtml += `
            <a href="${m.attachment.dataUrl}" download="${escHtml(m.attachment.name || 'dosya')}" target="_blank" style="text-decoration:none;color:inherit;display:block;">
              <div style="margin-top: 6px; padding: 6px 10px; background: rgba(0,0,0,0.08); border-radius: 8px; font-size: 0.74rem; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background 0.15s;">
                <span>📄</span> <span style="text-decoration:underline;">${escHtml(m.attachment.name || 'Belge')}</span> <span>⬇️</span>
              </div>
            </a>
          `;
        }
      }

      const hasVoiceOrAudio = (m.voice && m.voice.dataUrl) || (isAudioAttachment && m.attachment.dataUrl);
      if (hasVoiceOrAudio) {
        const audioSrc = (m.voice && m.voice.dataUrl) ? m.voice.dataUrl : m.attachment.dataUrl;
        const duration = (m.voice && m.voice.duration && m.voice.duration > 0) ? m.voice.duration : 10;
        const durMin = Math.floor(duration / 60);
        const durSec = String(duration % 60).padStart(2, '0');
        const audioTitle = (m.voice ? '🎙️ Ses Kaydı' : `🎵 ${escHtml(m.attachment.name || 'Ses Dosyası')}`);
        contentHtml = `
          <div class="frp-chat-audio-player">
            <button type="button" class="frp-audio-play-btn" title="Oynat / Durdur">▶️</button>
            <div class="frp-audio-track" title="İleri / Geri Sar">
              <div class="frp-audio-progress-wrap">
                <div class="frp-audio-progress-bar"></div>
              </div>
              <div class="frp-audio-meta">
                <span class="frp-audio-time">0:00 / ${durMin}:${durSec}</span>
                <span style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${audioTitle}</span>
              </div>
            </div>
            <div class="frp-audio-wave-bars">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <audio src="${audioSrc}" preload="metadata" style="display:none;"></audio>
          </div>
        `;
      }

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

      const currentAuthUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
      const canDelete = isSelf || (currentAuthUser && currentAuthUser.role === 'admin');
      const hoverReactionHtml = `
        <div class="frp-chat-hover-bar">
          <button type="button" class="btn-react" data-emoji="👍">👍</button>
          <button type="button" class="btn-react" data-emoji="❤️">❤️</button>
          <button type="button" class="btn-react" data-emoji="😂">😂</button>
          <button type="button" class="btn-react" data-emoji="😮">😮</button>
          <button type="button" class="btn-react" data-emoji="🔥">🔥</button>
          ${canDelete ? `<button type="button" class="btn-delete-msg" title="Mesajı Sil / Geri Al">🗑️</button>` : ''}
        </div>
      `;

      const senderLabel = isSelf ? '' : (m.senderName || (!isRoom ? (targetUser.fullName || targetUser.username) : 'Ekip Arkadaşı'));
      msgDiv.innerHTML = `
        ${hoverReactionHtml}
        ${!isSelf ? `
          <div class="frp-chat-sender-name">
            <span>${escHtml(senderLabel)}</span>
            ${!isRoom && !targetUser.isSelfNote && targetUser.department ? `<span class="frp-presence-dept-badge" style="font-size:0.58rem;padding:0 4px;font-weight:600;">${escHtml(targetUser.department)}</span>` : ''}
          </div>
        ` : ''}
        <div class="frp-chat-bubble">${contentHtml}</div>
        ${reactionsHtml}
        <div class="frp-chat-msg-time">
          <span>${timeStr}</span>
          ${isSelf ? `<span class="frp-chat-tick ${m.isRead ? 'read' : ''}" title="${m.isRead ? 'Görüldü' : 'İletildi'}">✓✓</span>` : ''}
        </div>
      `;

      // Görsel önizleme ve indirme tıklama olayları
      const imgThumb = msgDiv.querySelector('.frp-chat-img-thumb-wrap');
      if (imgThumb && m.attachment) {
        imgThumb.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openImageLightbox({ src: m.attachment.dataUrl, name: m.attachment.name });
        });
        const btnDownload = imgThumb.querySelector('.btn-download-img');
        if (btnDownload) {
          btnDownload.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const a = document.createElement('a');
            a.href = m.attachment.dataUrl;
            a.download = m.attachment.name || 'gorsel.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
          });
        }
      }

      // Event binding
      msgDiv.querySelectorAll('.btn-react').forEach(rbtn => {
        rbtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const emoji = rbtn.dataset.emoji;
          const targetMsgId = msgDiv.dataset.msgId || m.id;

          // Anında iyimser reaksiyon güncellemesi
          let reactionsWrap = msgDiv.querySelector('.frp-chat-reactions-row');
          if (!reactionsWrap) {
            reactionsWrap = document.createElement('div');
            reactionsWrap.className = 'frp-chat-reactions-row';
            const timeEl = msgDiv.querySelector('.frp-chat-msg-time');
            if (timeEl) msgDiv.insertBefore(reactionsWrap, timeEl);
            else msgDiv.appendChild(reactionsWrap);
          }
          const pill = Array.from(reactionsWrap.querySelectorAll('.frp-chat-reaction-pill')).find(p => p.textContent.includes(emoji));
          if (pill) {
            const isActive = pill.classList.contains('active');
            const curCount = parseInt(pill.textContent.replace(emoji, '').trim(), 10) || 1;
            if (isActive) {
              pill.classList.remove('active');
              if (curCount <= 1) pill.remove();
              else pill.textContent = `${emoji} ${curCount - 1}`;
            } else {
              pill.classList.add('active');
              pill.textContent = `${emoji} ${curCount + 1}`;
            }
          } else {
            const newPill = document.createElement('span');
            newPill.className = 'frp-chat-reaction-pill active';
            newPill.textContent = `${emoji} 1`;
            reactionsWrap.appendChild(newPill);
          }

          try {
            const res = await fetch('/api/chat/react', {
              method: 'POST',
              headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messageId: targetMsgId, emoji })
            });
            const data = await res.json().catch(() => ({}));
            if (data && data.success && data.reactions) {
              m.reactions = data.reactions;
              const cur = currentMessages.find(x => x.id === targetMsgId);
              if (cur) cur.reactions = data.reactions;
            }
          } catch (e) {}
        });
      });

      const btnDel = msgDiv.querySelector('.btn-delete-msg');
      if (btnDel) {
        btnDel.addEventListener('click', (ev) => {
          ev.stopPropagation();
          // Anında iyimser silme (gecikmesiz DOM kaldırımı)
          msgDiv.style.transition = 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)';
          msgDiv.style.opacity = '0';
          msgDiv.style.transform = 'scale(0.85)';
          setTimeout(() => {
            if (msgDiv.parentNode) msgDiv.remove();
          }, 220);

          fetch(`/api/chat/messages/${encodeURIComponent(m.id)}`, {
            method: 'DELETE',
            headers: window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : {}
          }).then(() => loadMessages()).catch(() => loadMessages());
        });
      }

      const audioPlayer = msgDiv.querySelector('.frp-chat-audio-player');
      if (audioPlayer) {
        bindAudioPlayer(audioPlayer, m);
      }

      return msgDiv;
    }

    // Mesajları Akışa Basma (Artımlı / Incremental DOM Güncellemesi & Kesintisiz Ses)
    function renderMessageStream(messages) {
      const currentAuthUser = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
      const myId = currentAuthUser ? String(currentAuthUser.id) : '';

      const incomingIds = new Set(messages.map(m => m.id));

      // 1. Silinmiş mesajları DOM'dan temizle
      msgStream.querySelectorAll('.frp-chat-msg').forEach(node => {
        const mid = node.dataset.msgId;
        if (mid && !mid.startsWith('temp_') && !incomingIds.has(mid)) {
          node.remove();
        }
      });

      // 2. Mesajları ekle veya güncelle
      const isNearBottom = (msgStream.scrollHeight - msgStream.scrollTop - msgStream.clientHeight) < 100;
      let hasNewMessage = false;

      messages.forEach(m => {
        const isSelf = String(m.senderId) === myId;
        let existingDiv = msgStream.querySelector(`[data-msg-id="${m.id}"]`);

        // İyimser mesaj eşleştirmesi
        if (!existingDiv && isSelf) {
          const pendingDiv = msgStream.querySelector('.frp-chat-msg.optimistic-pending');
          if (pendingDiv && pendingDiv.dataset.text === (m.text || '')) {
            existingDiv = pendingDiv;
            existingDiv.dataset.msgId = m.id;
            existingDiv.classList.remove('optimistic-pending');
            existingDiv.style.opacity = '1';
          }
        }

        if (existingDiv) {
          // Mevcut öğeyi yerinde güncelle (isRead ve reaksiyonlar)
          const tickEl = existingDiv.querySelector('.frp-chat-tick');
          if (tickEl && isSelf) {
            tickEl.classList.toggle('read', Boolean(m.isRead));
            tickEl.title = m.isRead ? 'Görüldü' : 'İletildi';
          }
          const reactionsWrap = existingDiv.querySelector('.frp-chat-reactions-row');
          if (m.reactions && Object.keys(m.reactions).length > 0) {
            let reactionsHtml = '';
            Object.entries(m.reactions).forEach(([emoji, userIds]) => {
              if (userIds && userIds.length > 0) {
                const hasMy = userIds.includes(myId);
                reactionsHtml += `<span class="frp-chat-reaction-pill ${hasMy ? 'active' : ''}">${emoji} ${userIds.length}</span>`;
              }
            });
            if (reactionsWrap) {
              reactionsWrap.innerHTML = reactionsHtml;
            } else {
              const rDiv = document.createElement('div');
              rDiv.className = 'frp-chat-reactions-row';
              rDiv.innerHTML = reactionsHtml;
              const timeEl = existingDiv.querySelector('.frp-chat-msg-time');
              if (timeEl) existingDiv.insertBefore(rDiv, timeEl);
              else existingDiv.appendChild(rDiv);
            }
          } else if (reactionsWrap) {
            reactionsWrap.remove();
          }
          return;
        }

        hasNewMessage = true;
        const msgDiv = createMessageDiv(m, isSelf, myId);
        msgStream.appendChild(msgDiv);
      });

      if (isInitialStream || (hasNewMessage && isNearBottom)) {
        msgStream.scrollTop = msgStream.scrollHeight;
      }
      isInitialStream = false;
    }

    if (input) setTimeout(() => input.focus(), 80);
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

    window.addEventListener('resize', realignChatWindows);

    window.addEventListener('frpoku:avatarChanged', (e) => {
      const newAvatar = e.detail?.avatar;
      const curAuth = window.FrpAuth && window.FrpAuth.getUser ? window.FrpAuth.getUser() : null;
      if (curAuth) {
        curAuth.avatar = newAvatar;
        const selfUser = cachedUsers.find(u => String(u.id) === String(curAuth.id));
        if (selfUser) selfUser.avatar = newAvatar;
        if (currentTab === 'users') renderUsers();
      }
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
