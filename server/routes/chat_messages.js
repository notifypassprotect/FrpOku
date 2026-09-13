function registerChatMessageListRoute(app, deps) {
  const { activeChatTyping, canAccessChatGroup, canAccessChatRoom, ensureChatMessagesHydrated, getChatMessages, requireAuth } = deps;

  app.get('/api/chat/messages', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const peerId = req.query.peerId ? String(req.query.peerId) : null;
      const roomId = req.query.roomId ? String(req.query.roomId) : null;
      const groupId = req.query.groupId ? String(req.query.groupId) : null;
      const targets = [peerId, roomId, groupId].filter(Boolean);
      if (targets.length !== 1) return res.status(400).json({ success: false, reason: 'Tek bir sohbet hedefi belirtilmelidir.' });
      if (groupId && !canAccessChatGroup(req.authUser, groupId)) return res.status(403).json({ success: false, reason: 'Bu grubun mesajlarını görüntüleme yetkiniz yok.' });
      if (roomId && !canAccessChatRoom(req.authUser, roomId)) return res.status(403).json({ success: false, reason: 'Bu kanalın mesajlarını görüntüleme yetkiniz yok.' });

      const currentUserId = String(req.authUser.id);
      let messages = getChatMessages().filter(message => {
        if (roomId) return message.roomId === roomId;
        if (groupId) return message.groupId === groupId;
        return (String(message.senderId) === currentUserId && String(message.receiverId) === peerId) ||
          (String(message.senderId) === peerId && String(message.receiverId) === currentUserId);
      });
      const since = req.query.since ? new Date(req.query.since).getTime() : 0;
      if (since > 0) messages = messages.filter(message => new Date(message.createdAt).getTime() > since);
      if (req.query.mediaOnly === 'true') messages = messages.filter(message => Boolean(message.attachment));

      const typingUsers = [];
      const now = Date.now();
      for (const [key, item] of activeChatTyping.entries()) {
        if (now > item.expiresAt) activeChatTyping.delete(key);
        else if (item.senderId !== currentUserId && ((peerId && item.senderId === peerId && item.targetId === currentUserId) ||
          (roomId && item.targetId === roomId) || (groupId && item.targetId === groupId))) typingUsers.push(item.senderName);
      }
      res.json({ success: true, messages: messages.slice(-100), typingUsers });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Mesajlar alınamadı.' });
    }
  });
}

module.exports = { registerChatMessageListRoute };
