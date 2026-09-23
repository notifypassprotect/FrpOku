function registerChatMutationRoutes(app, deps) {
  const { canAccessChatMessage, ensureChatMessagesHydrated, getChatMessages, replaceChatMessages, requireAuth, saveChatMessages, supabase } = deps;

  app.post('/api/chat/react', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const { messageId, emoji } = req.body || {};
      if (!messageId || !emoji) return res.status(400).json({ success: false, reason: 'Eksik parametre' });
      const messages = getChatMessages();
      let message = messages.find(item => String(item.id) === String(messageId));
      if (!message && supabase) {
        const { data } = await supabase.from('chat_messages').select('*').eq('id', String(messageId)).limit(1);
        if (data?.[0]) {
          const row = data[0];
          message = { id: row.id, senderId: row.sender_id, receiverId: row.receiver_id, roomId: row.room_id,
            groupId: row.group_id, text: row.text, attachment: row.attachment, voice: row.voice,
            reactions: row.reactions || {}, createdAt: row.created_at };
          messages.push(message);
        }
      }
      if (!message) return res.status(404).json({ success: false, reason: 'Mesaj bulunamadı.' });
      if (!canAccessChatMessage(req.authUser, message)) return res.status(403).json({ success: false, reason: 'Bu mesaja erişim yetkiniz yok.' });
      if (!message.reactions || typeof message.reactions !== 'object') message.reactions = {};
      const userId = String(req.authUser.id);
      const users = Array.isArray(message.reactions[emoji]) ? message.reactions[emoji] : [];
      if (users.includes(userId)) {
        message.reactions[emoji] = users.filter(id => id !== userId);
        if (!message.reactions[emoji].length) delete message.reactions[emoji];
      } else message.reactions[emoji] = [...users, userId];
      saveChatMessages();
      if (supabase) supabase.from('chat_messages').update({ reactions: message.reactions }).eq('id', message.id).then(() => {}).catch(() => {});
      res.json({ success: true, reactions: message.reactions });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Reaksiyon verilemedi.' });
    }
  });

  app.delete('/api/chat/messages/:id', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const messages = getChatMessages();
      const index = messages.findIndex(message => message.id === req.params.id);
      if (index === -1) return res.status(404).json({ success: false, reason: 'Mesaj bulunamadı.' });
      const message = messages[index];
      if (!canAccessChatMessage(req.authUser, message)) return res.status(403).json({ success: false, reason: 'Bu mesaja erişim yetkiniz yok.' });
      if (String(message.senderId) !== String(req.authUser.id) && req.authUser.role !== 'admin') {
        return res.status(403).json({ success: false, reason: 'Yalnızca kendi mesajınızı silebilirsiniz.' });
      }
      messages.splice(index, 1);
      saveChatMessages();
      if (supabase) supabase.from('chat_messages').delete().eq('id', req.params.id).then(() => {}).catch(() => {});
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Mesaj silinemedi.' });
    }
  });

  app.patch('/api/chat/messages/:id', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ success: false, reason: 'Mesaj metni boş olamaz.' });
      if (text.length > 1000) return res.status(400).json({ success: false, reason: 'Mesaj 1000 karakterden uzun olamaz.' });
      const message = getChatMessages().find(item => String(item.id) === String(req.params.id));
      if (!message) return res.status(404).json({ success: false, reason: 'Mesaj bulunamadı.' });
      if (!canAccessChatMessage(req.authUser, message)) return res.status(403).json({ success: false, reason: 'Bu mesaja erişim yetkiniz yok.' });
      if (String(message.senderId) !== String(req.authUser.id)) {
        return res.status(403).json({ success: false, reason: 'Yalnızca kendi mesajınızı düzenleyebilirsiniz.' });
      }
      if (message.isNudge) return res.status(400).json({ success: false, reason: 'Titreşim mesajları düzenlenemez.' });
      message.text = text;
      message.editedAt = new Date().toISOString();
      saveChatMessages();
      if (supabase) {
        const attachment = { ...(message.attachment || {}), editedAt: message.editedAt };
        supabase.from('chat_messages').update({ text, attachment }).eq('id', message.id).then(() => {}).catch(() => {});
      }
      res.json({ success: true, message });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Mesaj düzenlenemedi.' });
    }
  });

  app.delete('/api/chat/conversations/:id', requireAuth, async (req, res) => {
    try {
      await ensureChatMessagesHydrated();
      const targetId = String(req.params.id || '');
      const type = req.query.type || 'peer';
      const userId = String(req.authUser.id);
      const messages = getChatMessages();
      let ids;
      if (type === 'room' || type === 'group') {
        if (req.authUser.role !== 'admin') return res.status(403).json({ success: false, reason: `Yalnızca yöneticiler ${type === 'room' ? 'oda' : 'grup'} geçmişini silebilir.` });
        ids = messages.filter(message => String(type === 'room' ? message.roomId : message.groupId) === targetId).map(message => message.id);
      } else {
        ids = messages.filter(message => (String(message.senderId) === userId && String(message.receiverId) === targetId) ||
          (String(message.senderId) === targetId && String(message.receiverId) === userId)).map(message => message.id);
      }
      if (ids.length) {
        const deleted = new Set(ids);
        replaceChatMessages(messages.filter(message => !deleted.has(message.id)));
        if (supabase) supabase.from('chat_messages').delete().in('id', ids).then(() => {}).catch(() => {});
      }
      res.json({ success: true, count: ids.length });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Sohbet geçmişi silinemedi.' });
    }
  });
}

module.exports = { registerChatMutationRoutes };
