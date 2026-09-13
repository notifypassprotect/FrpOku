function createChatEmailService({ ensureChatMessagesHydrated, getChatMessages, loadUserById, mailer, delayMs = 180000 }) {
  const timers = new Map();
  const cooldowns = new Map();

  function clearChatEmailTimer(senderId, receiverId) {
    const key = `${senderId}_${receiverId}`;
    const entry = timers.get(key);
    if (entry?.timer) clearTimeout(entry.timer);
    timers.delete(key);
  }

  async function scheduleChatEmailDigest(sender, receiverId, messageSnippet) {
    if (!sender || !receiverId || String(receiverId) === String(sender.id)) return;
    try {
      const receiver = await loadUserById(String(receiverId));
      if (!receiver?.email || receiver.email_chat_digest === false || receiver.emailChatDigest === false) return;
      if (Date.now() - (cooldowns.get(String(receiverId)) || 0) < 900000) return;
      const key = `${sender.id}_${receiverId}`;
      if (timers.has(key)) return;
      const timer = setTimeout(async () => {
        timers.delete(key);
        try {
          await ensureChatMessagesHydrated();
          const unread = getChatMessages().filter(message => String(message.senderId) === String(sender.id) && String(message.receiverId) === String(receiverId) && !message.isRead);
          if (!unread.length || Date.now() - (cooldowns.get(String(receiverId)) || 0) < 900000) return;
          cooldowns.set(String(receiverId), Date.now());
          const last = unread[unread.length - 1];
          const snippet = last.text || (last.attachment ? '📎 Görsel / Belge eki' : last.voice ? '🎤 Sesli mesaj' : messageSnippet || 'Yeni ileti');
          await mailer.sendUnreadMessageDigest({
            to: receiver.email, recipientName: receiver.full_name || receiver.username || 'Kullanıcı',
            senderName: sender.full_name || sender.username || 'Ekip Arkadaşınız', unreadCount: unread.length,
            lastMessageSnippet: snippet
          });
        } catch (error) {
          console.warn('Okunmamış mesaj bildirim e-postası gönderilemedi:', error.message);
        }
      }, delayMs);
      if (timer.unref) timer.unref();
      timers.set(key, { timer });
    } catch (error) {
      console.warn('E-posta bildirim planlaması yapılamadı:', error.message);
    }
  }

  return { clearChatEmailTimer, scheduleChatEmailDigest };
}

module.exports = { createChatEmailService };
