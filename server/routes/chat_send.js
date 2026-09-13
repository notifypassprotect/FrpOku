const crypto = require('crypto');

function registerChatSendRoute(app, deps) {
  const { canAccessChatGroup, canAccessChatRoom, chatPayloadSize, ensureChatMessagesHydrated, getChatMessages, persistChatMessage, requireAuth, saveChatMessages, scheduleChatEmailDigest } = deps;

  app.post('/api/chat/send', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const { receiverId, roomId, groupId, text, attachment, voice, isNudge } = req.body || {};
      if (!text && !attachment && !voice && !isNudge) return res.status(400).json({ success: false, reason: 'Mesaj içeriği boş olamaz.' });
      const targets = [receiverId, roomId, groupId].filter(Boolean);
      if (!targets.length) return res.status(400).json({ success: false, reason: 'Alıcı, oda veya grup belirtilmelidir.' });
      if (targets.length !== 1) return res.status(400).json({ success: false, reason: 'Her mesaj için yalnızca bir hedef belirtilmelidir.' });
      const cleanText = String(text || '').trim();
      if (cleanText.length > 1000) return res.status(400).json({ success: false, reason: 'Mesaj 1000 karakterden uzun olamaz.' });
      if (chatPayloadSize(attachment) > 6 * 1024 * 1024 || chatPayloadSize(voice) > 6 * 1024 * 1024) {
        return res.status(413).json({ success: false, reason: 'Sohbet eki 6 MB sınırını aşamaz.' });
      }
      if (groupId && !canAccessChatGroup(req.authUser, groupId)) return res.status(403).json({ success: false, reason: 'Bu gruba mesaj gönderme yetkiniz yok.' });
      if (roomId && !canAccessChatRoom(req.authUser, roomId)) return res.status(403).json({ success: false, reason: 'Bu kanala erişim yetkiniz yok.' });
      if (roomId && req.authUser.role !== 'admin') return res.status(403).json({ success: false, reason: 'Bu kurumsal kanala yalnızca sistem yöneticileri (Admin) duyuru ve mesaj gönderebilir.' });

      const message = {
        id: crypto.randomUUID(), senderId: String(req.authUser.id), senderName: req.authUser.full_name || req.authUser.username,
        senderUsername: req.authUser.username, senderAvatar: req.authUser.avatar || (req.authUser.username ? req.authUser.username[0].toUpperCase() : 'U'),
        receiverId: receiverId ? String(receiverId) : null, roomId: roomId ? String(roomId) : null,
        groupId: groupId ? String(groupId) : null, text: cleanText, attachment: attachment || null,
        voice: voice || null, isNudge: Boolean(isNudge), reactions: {}, isRead: false, readAt: null,
        createdAt: new Date().toISOString()
      };
      await persistChatMessage(message);
      getChatMessages().push(message);
      saveChatMessages();
      if (receiverId && !roomId && !groupId) scheduleChatEmailDigest(req.authUser, receiverId, message.text).catch(() => {});
      res.json({ success: true, message });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Mesaj gönderilemedi.' });
    }
  });
}

module.exports = { registerChatSendRoute };
