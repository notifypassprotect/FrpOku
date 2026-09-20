const { createHash } = require('node:crypto');

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
      const hasAccess = () => (!groupId || canAccessChatGroup(req.authUser, groupId)) && (!roomId || canAccessChatRoom(req.authUser, roomId));
      if (!hasAccess()) return res.status(403).json({ success: false, reason: 'Bu sohbete erişim yetkiniz yok.' });
      const currentUserId = String(req.authUser.id);
      function snapshot() {
        let messages = getChatMessages().filter(message => {
          if (roomId) return message.roomId === roomId;
          if (groupId) return message.groupId === groupId;
          return (String(message.senderId) === currentUserId && String(message.receiverId) === peerId) ||
            (String(message.senderId) === peerId && String(message.receiverId) === currentUserId);
        });
        const since = req.query.since ? new Date(req.query.since).getTime() : 0;
        if (since > 0) messages = messages.filter(message => new Date(message.createdAt).getTime() > since);
        if (req.query.mediaOnly === 'true') messages = messages.filter(message => Boolean(message.attachment));
        messages = messages.slice(-100);
        const typingUsers = [];
        const now = Date.now();
        const targetType = groupId ? 'group' : roomId ? 'room' : 'peer';
        for (const [key, item] of activeChatTyping.entries()) {
          if (now > item.expiresAt) activeChatTyping.delete(key);
          else if ((!item.targetType || item.targetType === targetType) && item.senderId !== currentUserId &&
            ((peerId && item.senderId === peerId && item.targetId === currentUserId) ||
             (roomId && item.targetId === roomId) || (groupId && item.targetId === groupId))) typingUsers.push(item.senderName);
        }
        // Attachments are immutable; avoid repeatedly hashing their large base64 contents.
        const revision = createHash('sha256').update(JSON.stringify([
          messages.map(m => [m.id, m.text, m.isRead, m.readAt, m.reactions]), typingUsers
        ])).digest('hex');
        return { success: true, messages, typingUsers, revision };
      }
      const initial = snapshot();
      if (req.query.wait !== '1' || req.query.revision !== initial.revision) return res.json(initial);
      // Authenticated long poll: respond as soon as messages, receipts or typing change.
      // Bounded requests re-run authentication on every reconnect, with no token in URLs.
      let finished = false;
      const deadline = Date.now() + 20000;
      const cleanup = () => { finished = true; clearInterval(timer); res.off('close', cleanup); };
      const timer = setInterval(() => {
        if (finished) return;
        if (!hasAccess()) { cleanup(); res.status(403).json({ success: false, reason: 'Sohbet erişimi kaldırıldı.' }); return; }
        const next = snapshot();
        if (next.revision !== initial.revision || Date.now() >= deadline) { cleanup(); requireAuth(req, res, () => res.json(next)); }
      }, 500);
      res.on('close', cleanup);
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ success: false, reason: 'Mesajlar alınamadı.' });
    }
  });
}

module.exports = { registerChatMessageListRoute };
