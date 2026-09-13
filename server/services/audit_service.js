function createAuditService({ safeLogStr, store, supabase }) {
  function getAuditLogs() {
    const logs = store.read();
    return Array.isArray(logs) ? logs : [];
  }

  function saveAuditLogs(logs) {
    return store.write(Array.isArray(logs) ? logs : []);
  }

  async function recordAuditLog({ userId, username, fullName, role, action, target, details, ip }) {
    try {
      const entry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        userId: userId || 'system', username: username || 'misafir', fullName: fullName || '', role: role || 'user',
        action: action || 'INFO', target: target || '', details: details || '',
        ip: (ip || '127.0.0.1').replace(/^::ffff:/, '')
      };
      if (supabase) {
        const { error } = await supabase.from('audit_logs').insert({
          id: entry.id, occurred_at: entry.timestamp, user_id: entry.userId, username: entry.username,
          full_name: entry.fullName, role: entry.role, action: entry.action, target: entry.target,
          details: entry.details, ip: entry.ip
        });
        if (error) throw error;
      } else {
        const logs = getAuditLogs();
        logs.unshift(entry);
        saveAuditLogs(logs);
      }
      return entry;
    } catch (error) {
      console.warn('Audit log yazılamadı:', safeLogStr(error.message));
      return null;
    }
  }

  return { getAuditLogs, recordAuditLog, saveAuditLogs };
}

module.exports = { createAuditService };
