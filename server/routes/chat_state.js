function registerChatStateRoutes(app, deps) {
  const { activeChatTyping, canAccessChatGroup, canAccessChatRoom, clearChatEmailTimer, ensureChatMessagesHydrated, getChatMessages, requireAuth, safeLogStr, saveChatMessages, supabase } = deps;

  app.post('/api/chat/typing', requireAuth, (req, res) => {
    try {
      const targetId = req.body?.peerId || req.body?.roomId || req.body?.groupId;
      if (req.body?.groupId && !canAccessChatGroup(req.authUser, req.body.groupId)) return res.status(403).json({ success: false, reason: 'Bu gruba erişim yetkiniz yok.' });
      if (req.body?.roomId && !canAccessChatRoom(req.authUser, req.body.roomId)) return res.status(403).json({ success: false, reason: 'Bu kanala erişim yetkiniz yok.' });
      if (targetId) {
        const senderId = String(req.authUser.id);
        const targetType = req.body.groupId ? 'group' : req.body.roomId ? 'room' : 'peer';
        const key = `${senderId}_${targetType}_${targetId}`;
        if (req.body.isTyping === false) { activeChatTyping.delete(key); return res.json({ success: true }); }
        activeChatTyping.set(key, {
          targetType,
          senderId, senderName: req.authUser.full_name || req.authUser.username,
          targetId: String(targetId), expiresAt: Date.now() + 3500
        });
      }
      res.json({ success: true });
    } catch (error) {
      res.json({ success: false });
    }
  });

  app.post('/api/chat/mark-read', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const peerId = req.body?.peerId ? String(req.body.peerId) : null;
      const userId = String(req.authUser.id);
      if (!peerId || peerId === userId) return res.json({ success: true, updated: 0 });
      clearChatEmailTimer(peerId, userId);
      const requestedIds = Array.isArray(req.body.messageIds) ? req.body.messageIds.slice(0, 100).map(String) : null;
      const messages = getChatMessages().filter(message =>
        (!requestedIds || requestedIds.includes(String(message.id))) &&
        String(message.senderId) === peerId && String(message.receiverId) === userId && !message.isRead);
      const readAt = new Date().toISOString();
      if (messages.length && supabase) {
        const { error } = await supabase.from('chat_messages').update({ is_read: true, read_at: readAt })
          .eq('sender_id', peerId).eq('receiver_id', userId).eq('is_read', false).in('id', messages.map(message => message.id));
        if (error) throw error;
      }
      messages.forEach(message => { message.isRead = true; message.readAt = readAt; });
      if (messages.length) saveChatMessages();
      res.json({ success: true, updated: messages.length });
    } catch (error) {
      console.warn('Mesaj okundu bilgisi kaydedilemedi:', safeLogStr(error.message));
      res.status(500).json({ success: false, reason: 'Okundu bilgisi kaydedilemedi.' });
    }
  });
}

module.exports = { registerChatStateRoutes };
