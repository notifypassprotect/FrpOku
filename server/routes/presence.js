function registerPresenceRoutes(app, deps) {
  const {
    acquireReportLock,
    ensureChatMessagesHydrated,
    getActiveReportLocks,
    getAllUsersWithPresence,
    getReportLock,
    getUnreadCountsForUser,
    recordUserPresence,
    releaseReportLock,
    removeUserPresence,
    renewReportLock,
    requireAuth,
    supabase
  } = deps;

  app.post('/api/presence/heartbeat', requireAuth, async (req, res) => {
    try {
      const customStatus = req.body?.customStatus || 'online';
      recordUserPresence(req.authUser, customStatus);

      // Rapor düzenleme kilidi yenileme / edinme
      const editingReportId = req.body?.editingReportId;
      if (editingReportId && typeof acquireReportLock === 'function') {
        acquireReportLock(editingReportId, req.authUser);
      }

      if (supabase) {
        supabase.from('app_users').update({ last_seen: new Date().toISOString(), is_online: customStatus !== 'invisible' })
          .eq('id', req.authUser.id).then(() => {}).catch(() => {});
      }
      await ensureChatMessagesHydrated();
      const users = await getAllUsersWithPresence();
      const activeReportLocks = typeof getActiveReportLocks === 'function' ? getActiveReportLocks() : {};
      res.json({
        success: true,
        users,
        activeReportLocks,
        unreadCounts: getUnreadCountsForUser(req.authUser.id)
      });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Presence güncellenemedi.' });
    }
  });

  app.get('/api/presence/users', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const users = await getAllUsersWithPresence();
      const activeReportLocks = typeof getActiveReportLocks === 'function' ? getActiveReportLocks() : {};
      res.json({
        success: true,
        users,
        activeReportLocks,
        unreadCounts: getUnreadCountsForUser(req.authUser.id)
      });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Kullanıcılar alınamadı.' });
    }
  });

  app.post('/api/presence/offline', requireAuth, async (req, res) => {
    try {
      const userId = String(req.authUser.id);
      removeUserPresence(userId);
      if (supabase) {
        supabase.from('app_users').update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', userId).then(() => {}).catch(() => {});
      }
      res.json({ success: true });
    } catch (error) {
      res.json({ success: true });
    }
  });

  // ── RAPOR KİLİT YÖNETİMİ ROTALARI (SOFT-LOCK) ────────────
  app.post('/api/reports/:id/lock', requireAuth, async (req, res) => {
    try {
      const reportId = String(req.params.id || '');
      if (!reportId) return res.status(400).json({ success: false, reason: 'Rapor ID eksik.' });
      if (typeof acquireReportLock !== 'function') {
        return res.json({ success: true, acquired: true });
      }
      const result = acquireReportLock(reportId, req.authUser);
      res.json({ success: true, acquired: result.acquired, lock: result.lock });
    } catch (err) {
      res.status(500).json({ success: false, reason: 'Kilit alınamadı.' });
    }
  });

  app.post('/api/reports/:id/unlock', requireAuth, async (req, res) => {
    try {
      const reportId = String(req.params.id || '');
      if (!reportId) return res.status(400).json({ success: false, reason: 'Rapor ID eksik.' });
      const released = typeof releaseReportLock === 'function'
        ? releaseReportLock(reportId, req.authUser.id, req.authUser.role === 'admin')
        : true;
      res.json({ success: true, released });
    } catch (err) {
      res.status(500).json({ success: false, reason: 'Kilit bırakılamadı.' });
    }
  });

  app.get('/api/reports/:id/lock', requireAuth, async (req, res) => {
    try {
      const reportId = String(req.params.id || '');
      const lock = typeof getReportLock === 'function' ? getReportLock(reportId) : null;
      res.json({ success: true, lock });
    } catch (err) {
      res.status(500).json({ success: false, reason: 'Kilit durumu sorgulanamadı.' });
    }
  });
}

module.exports = { registerPresenceRoutes };
