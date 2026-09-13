const crypto = require('crypto');

function registerChatNudgeRoute(app, deps) {
  const { canAccessChatGroup, ensureChatMessagesHydrated, getChatMessages, persistChatMessage, requireAuth, saveChatMessages } = deps;
  const cooldowns = new Map();

  app.post('/api/chat/nudge', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const { receiverId, groupId } = req.body || {};
      const senderId = String(req.authUser.id);
      if ((!receiverId && !groupId) || (receiverId && groupId)) {
        return res.status(400).json({ success: false, reason: 'Tek bir titreşim hedefi belirtilmelidir.' });
      }
      if (groupId && !canAccessChatGroup(req.authUser, groupId)) {
        return res.status(403).json({ success: false, reason: 'Bu gruba titreşim gönderme yetkiniz yok.' });
      }
      const targetKey = receiverId ? `${senderId}_${receiverId}` : `${senderId}_${groupId}`;
      const lastNudge = cooldowns.get(targetKey) || 0;
      if (Date.now() - lastNudge < 15000) {
        const waitSeconds = Math.ceil((15000 - (Date.now() - lastNudge)) / 1000);
        return res.status(429).json({ success: false, reason: `Lütfen tekrar titreşim göndermeden önce ${waitSeconds} saniye bekleyin.` });
      }
      cooldowns.set(targetKey, Date.now());
      const senderName = req.authUser.full_name || req.authUser.username;
      const message = {
        id: crypto.randomUUID(), senderId, senderName, senderUsername: req.authUser.username,
        senderAvatar: req.authUser.avatar || (req.authUser.username ? req.authUser.username[0].toUpperCase() : 'U'),
        receiverId: receiverId ? String(receiverId) : null, groupId: groupId ? String(groupId) : null, roomId: null,
        text: `📳 ${senderName} bir titreşim gönderdi!`, attachment: null, voice: null, isNudge: true,
        reactions: {}, isRead: false, readAt: null, createdAt: new Date().toISOString()
      };
      await persistChatMessage(message);
      getChatMessages().push(message);
      saveChatMessages();
      res.json({ success: true, message });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Titreşim gönderilemedi.' });
    }
  });
}

module.exports = { registerChatNudgeRoute };
