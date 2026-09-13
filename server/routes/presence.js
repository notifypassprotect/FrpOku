function registerPresenceRoutes(app, deps) {
  const { ensureChatMessagesHydrated, getAllUsersWithPresence, getUnreadCountsForUser, recordUserPresence, removeUserPresence, requireAuth, supabase } = deps;

  app.post('/api/presence/heartbeat', requireAuth, async (req, res) => {
    try {
      const customStatus = req.body?.customStatus || 'online';
      recordUserPresence(req.authUser, customStatus);
      if (supabase) {
        supabase.from('app_users').update({ last_seen: new Date().toISOString(), is_online: customStatus !== 'invisible' })
          .eq('id', req.authUser.id).then(() => {}).catch(() => {});
      }
      await ensureChatMessagesHydrated();
      const users = await getAllUsersWithPresence();
      res.json({ success: true, users, unreadCounts: getUnreadCountsForUser(req.authUser.id) });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Presence güncellenemedi.' });
    }
  });

  app.get('/api/presence/users', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const users = await getAllUsersWithPresence();
      res.json({ success: true, users, unreadCounts: getUnreadCountsForUser(req.authUser.id) });
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
}

module.exports = { registerPresenceRoutes };
