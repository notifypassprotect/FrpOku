function registerChatGroupRoutes(app, deps) {
  const { canAccessChatGroup, getAllUsersWithPresence, getChatGroups, requireAuth, saveChatGroups } = deps;

  app.get('/api/chat/groups', requireAuth, (req, res) => {
    try {
      const userId = String(req.authUser.id);
      const groups = getChatGroups().filter(group => Array.isArray(group.memberUserIds) && group.memberUserIds.map(String).includes(userId));
      res.json({ success: true, groups });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Gruplar alınamadı.' });
    }
  });

  app.post('/api/chat/groups', requireAuth, (req, res) => {
    try {
      const { name, icon, memberUserIds } = req.body || {};
      const cleanName = String(name || '').trim();
      if (!cleanName) return res.status(400).json({ success: false, reason: 'Grup adı belirtilmelidir.' });
      const userId = String(req.authUser.id);
      const members = new Set((Array.isArray(memberUserIds) ? memberUserIds : []).map(String));
      members.add(userId);
      if (members.size < 2) return res.status(400).json({ success: false, reason: 'Grup oluşturmak için en az bir kişi daha seçmelisiniz.' });
      const group = {
        id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: cleanName,
        icon: String(icon || '👥').trim() || '👥', memberUserIds: Array.from(members), createdBy: userId,
        createdByName: req.authUser.full_name || req.authUser.username, createdAt: new Date().toISOString()
      };
      getChatGroups().unshift(group);
      saveChatGroups();
      res.json({ success: true, group });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Grup oluşturulamadı.' });
    }
  });

  app.get('/api/chat/groups/:id/details', requireAuth, async (req, res) => {
    try {
      const group = getChatGroups().find(item => item.id === req.params.id);
      if (!group) return res.status(404).json({ success: false, reason: 'Grup bulunamadı.' });
      if (!canAccessChatGroup(req.authUser, req.params.id)) return res.status(403).json({ success: false, reason: 'Bu grubun ayrıntılarını görüntüleme yetkiniz yok.' });
      const memberIds = new Set((group.memberUserIds || []).map(String));
      const members = (await getAllUsersWithPresence()).filter(user => memberIds.has(String(user.id))).map(user => ({
        ...user, isCreator: String(user.id) === String(group.createdBy),
        isAdmin: String(user.id) === String(group.createdBy) || (Array.isArray(group.admins) && group.admins.map(String).includes(String(user.id)))
      }));
      res.json({ success: true, group: { ...group, members } });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Grup detayları alınamadı.' });
    }
  });

  app.post('/api/chat/groups/:id/leave', requireAuth, async (req, res) => {
    try {
      const groups = getChatGroups();
      const group = groups.find(item => item.id === req.params.id);
      if (!group) return res.status(404).json({ success: false, reason: 'Grup bulunamadı.' });
      const userId = String(req.authUser.id);
      group.memberUserIds = (group.memberUserIds || []).map(String).filter(id => id !== userId);
      if (!group.memberUserIds.length) groups.splice(groups.findIndex(item => item.id === req.params.id), 1);
      else if (String(group.createdBy) === userId) {
        group.createdBy = group.memberUserIds[0];
        const owner = (await getAllUsersWithPresence()).find(user => String(user.id) === group.createdBy);
        if (owner) group.createdByName = owner.fullName || owner.username;
      }
      saveChatGroups();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Gruptan ayrılamadı.' });
    }
  });

  app.delete('/api/chat/groups/:id/members/:userId', requireAuth, (req, res) => {
    try {
      const group = getChatGroups().find(item => item.id === req.params.id);
      if (!group) return res.status(404).json({ success: false, reason: 'Grup bulunamadı.' });
      const currentUserId = String(req.authUser.id);
      const targetUserId = String(req.params.userId);
      const groupAdmin = String(group.createdBy) === currentUserId || (Array.isArray(group.admins) && group.admins.map(String).includes(currentUserId));
      const systemAdmin = req.authUser.role === 'admin';
      if (!groupAdmin && !systemAdmin) return res.status(403).json({ success: false, reason: 'Yalnızca grup yöneticisi üyeleri gruptan çıkarabilir.' });
      if (String(group.createdBy) === targetUserId && !systemAdmin) return res.status(400).json({ success: false, reason: 'Grup kurucusu gruptan çıkarılamaz.' });
      group.memberUserIds = (group.memberUserIds || []).map(String).filter(id => id !== targetUserId);
      saveChatGroups();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Üye gruptan çıkarılamadı.' });
    }
  });
}

module.exports = { registerChatGroupRoutes };
