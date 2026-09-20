const crypto = require('crypto');

function registerChatSendRoute(app, deps) {
  const { canAccessChatGroup, canAccessChatRoom, chatPayloadSize, ensureChatMessagesHydrated, getChatMessages, persistChatMessage, requireAuth, saveChatMessages, scheduleChatEmailDigest } = deps;

  const pendingSends = new Map();
  app.post('/api/chat/send', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const { receiverId, roomId, groupId, text, attachment, voice, isNudge, clientMessageId, replyTo } = req.body || {};
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

      let safeReply = null;
      if (replyTo?.id) {
        const replyMessage = getChatMessages().find(item => String(item.id) === String(replyTo.id));
        const sameConversation = replyMessage && (groupId
          ? String(replyMessage.groupId) === String(groupId)
          : roomId ? String(replyMessage.roomId) === String(roomId)
            : [String(replyMessage.senderId), String(replyMessage.receiverId)].includes(String(req.authUser.id)) &&
              [String(replyMessage.senderId), String(replyMessage.receiverId)].includes(String(receiverId)));
        if (!sameConversation) return res.status(400).json({ success: false, reason: 'Yanıtlanan mesaj bu sohbette bulunamadı.' });
        safeReply = { id: String(replyMessage.id), senderId: String(replyMessage.senderId || ''),
          senderName: String(replyMessage.senderName || replyMessage.senderUsername || 'Kullanıcı').slice(0, 80),
          text: String(replyMessage.text || '').slice(0, 180), hasAttachment: Boolean(replyMessage.attachment?.dataUrl),
          hasVoice: Boolean(replyMessage.voice?.dataUrl) };
      }

      let messageId = crypto.randomUUID();
      if (clientMessageId) {
        if (!/^[a-zA-Z0-9_-]{8,100}$/.test(String(clientMessageId))) return res.status(400).json({ success: false, reason: 'Geçersiz mesaj kimliği.' });
        const digest = crypto.createHash('sha256').update(JSON.stringify([String(req.authUser.id), String(clientMessageId)])).digest('hex');
        messageId = `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;
        if (pendingSends.has(messageId)) await pendingSends.get(messageId);
        const existing = getChatMessages().find(m => m.id === messageId);
        if (existing) return res.json({ success: true, message: existing });
      }
      const message = {
        id: messageId, senderId: String(req.authUser.id), senderName: req.authUser.full_name || req.authUser.username,
        senderUsername: req.authUser.username, senderAvatar: req.authUser.avatar || (req.authUser.username ? req.authUser.username[0].toUpperCase() : 'U'),
        receiverId: receiverId ? String(receiverId) : null, roomId: roomId ? String(roomId) : null,
        groupId: groupId ? String(groupId) : null, text: cleanText, attachment: attachment || null,
        voice: voice || null, replyTo: safeReply, isNudge: Boolean(isNudge), reactions: {}, isRead: false, readAt: null,
        createdAt: new Date().toISOString()
      };
      const pending = (async () => {
        await persistChatMessage(message);
        getChatMessages().push(message);
        saveChatMessages();
      })();
      pendingSends.set(messageId, pending);
      try { await pending; } finally { pendingSends.delete(messageId); }
      if (receiverId && !roomId && !groupId) scheduleChatEmailDigest(req.authUser, receiverId, message.text).catch(() => {});
      res.json({ success: true, message });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Mesaj gönderilemedi.' });
    }
  });
}

module.exports = { registerChatSendRoute };
