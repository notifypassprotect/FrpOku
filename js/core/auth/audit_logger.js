// ============================================================
//  audit_logger.js — Global Denetim Günlüğü API (FrpAudit)
// ============================================================

(function () {
  'use strict';

  let cachedClientIp = '127.0.0.1';

  async function resolveClientIp() {
    try {
      const res = await fetch('/api/client-ip');
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) cachedClientIp = data.ip;
      }
    } catch {}
  }
  resolveClientIp();

  window.FrpAudit = {
    getClientIp() {
      return cachedClientIp || '127.0.0.1';
    },

    async logAction({ action, target = '', details = '', extra = {} }) {
      const user = (window.FrpAuth && typeof window.FrpAuth.getUser === 'function') ? window.FrpAuth.getUser() : null;
      const ip = cachedClientIp || '127.0.0.1';
      const logEntry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        userId: user ? user.id : 'guest',
        username: user ? user.username : 'Misafir',
        fullName: user ? (user.full_name || user.fullName || user.username) : 'Misafir',
        role: user ? (user.role || 'user') : 'guest',
        action: action || 'GENERAL',
        target: target || '',
        details: details || '',
        ip: ip,
        timestamp: new Date().toISOString(),
        ...extra
      };

      // 1. Supabase Bulut Depolama
      try {
        if (window.FrpCloud && typeof window.FrpCloud.appendAuditLog === 'function') {
          window.FrpCloud.appendAuditLog(logEntry).catch(() => {});
        }
      } catch (e) {}

      // 2. Yerel Depolama (Hızlı Erişim & Offline Önbellek)
      try {
        let localLogs = [];
        const stored = localStorage.getItem('frp_audit_logs');
        if (stored) {
          try { localLogs = JSON.parse(stored) || []; } catch {}
        }
        localLogs.unshift(logEntry);
        if (localLogs.length > 500) localLogs = localLogs.slice(0, 500);
        localStorage.setItem('frp_audit_logs', JSON.stringify(localLogs));
      } catch (e) {}

      // 3. Sunucuya Gönder
      try {
        fetch('/api/audit-log', {
          method: 'POST',
          headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
          body: JSON.stringify(logEntry)
        }).catch(() => {});
      } catch (e) {}

      return logEntry;
    },

    async getLogs(filter = {}) {
      if (cachedClientIp === '127.0.0.1') await resolveClientIp();

      let cloudLogs = [];
      try {
        if (window.FrpCloud && typeof window.FrpCloud.loadAuditLogs === 'function') {
          const cLogs = await window.FrpCloud.loadAuditLogs();
          if (Array.isArray(cLogs)) cloudLogs = cLogs;
        }
      } catch (e) {}

      let serverLogs = [];
      try {
        const headers = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {};
        const res = await fetch('/api/admin/audit-logs' + (filter.q ? `?q=${encodeURIComponent(filter.q)}` : ''), {
          headers
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.logs)) serverLogs = data.logs;
        }
      } catch (e) {}

      let localLogs = [];
      try {
        const stored = localStorage.getItem('frp_audit_logs');
        if (stored) localLogs = JSON.parse(stored) || [];
      } catch (e) {}

      const all = [...cloudLogs, ...serverLogs, ...localLogs];
      const seen = new Set();
      const unique = [];
      for (const l of all) {
        if (!l.ip || l.ip === '-' || l.ip === '') l.ip = cachedClientIp || '127.0.0.1';
        const key = l.id || `${l.timestamp}_${l.action}_${l.target}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(l);
        }
      }
      unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Yerel önbelleği güncelle
      try {
        localStorage.setItem('frp_audit_logs', JSON.stringify(unique.slice(0, 500)));
      } catch (e) {}

      return unique;
    }
  };
})();
