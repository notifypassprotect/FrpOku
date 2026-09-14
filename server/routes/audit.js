function clientIp(req) {
  const rawIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  return rawIp === '::1' || rawIp === '::ffff:127.0.0.1' ? '127.0.0.1' : rawIp;
}

function registerAuditRoutes(app, deps) {
  const { adminRateLimiter, apiWriteRateLimiter, getAuditLogs, recordAuditLog, requireAdmin, requireAuth, safeLogStr, supabase } = deps;

  app.get('/api/client-ip', (req, res) => res.json({ success: true, ip: clientIp(req) }));

  app.post('/api/audit-log', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const cleanAction = String(req.body?.action || '').trim().toUpperCase().slice(0, 80);
    if (!/^[A-Z0-9_:-]{2,80}$/.test(cleanAction)) return res.status(400).json({ success: false, reason: 'Geçersiz audit işlem kodu.' });
    const entry = await recordAuditLog({
      userId: req.authUser.id,
      username: req.authUser.username,
      fullName: req.authUser.full_name,
      role: req.authUser.role,
      action: cleanAction,
      target: String(req.body?.target || '').slice(0, 300),
      details: String(req.body?.details || '').slice(0, 2000),
      ip: clientIp(req)
    });
    if (!entry) return res.status(503).json({ success: false, reason: 'Denetim kaydı geçici olarak yazılamadı.' });
    res.json({ success: true, log: entry });
  });

  app.get('/api/admin/audit-logs', adminRateLimiter, requireAdmin, async (req, res) => {
    const query = String(req.query.q || '').trim().toLowerCase().slice(0, 200);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 500));
    let logs;
    if (supabase) {
      const result = await supabase.from('audit_logs').select('id, occurred_at, user_id, username, full_name, role, action, target, details, ip').order('occurred_at', { ascending: false }).limit(query ? 1000 : limit);
      if (result.error) {
        console.warn('Audit log listesi alınamadı:', safeLogStr(result.error.message));
        return res.status(503).json({ success: false, reason: 'Denetim kayıtları geçici olarak alınamıyor.' });
      }
      logs = (result.data || []).map(row => ({ id: row.id, timestamp: row.occurred_at, userId: row.user_id, username: row.username, fullName: row.full_name, role: row.role, action: row.action, target: row.target, details: row.details, ip: row.ip }));
    } else {
      logs = getAuditLogs();
    }
    if (query) logs = logs.filter(log => (log.username || '').toLowerCase().includes(query) || (log.action || '').toLowerCase().includes(query) || (log.target || '').toLowerCase().includes(query) || (log.details || '').toLowerCase().includes(query) || (log.ip || '').includes(query));
    res.json({ success: true, logs: logs.slice(0, limit) });
  });
}

module.exports = { registerAuditRoutes };
