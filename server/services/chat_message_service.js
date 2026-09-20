function createChatMessageService({ safeLogStr, store, supabase }) {
  let cache = null;
  let hydrationPromise = null;

  function getChatMessages() {
    if (cache !== null) return cache;
    const messages = store.read();
    cache = Array.isArray(messages) ? messages : [];
    return cache;
  }

  function replaceChatMessages(messages) {
    cache = Array.isArray(messages) ? messages.slice(-3000) : [];
    store.write(cache);
    return cache;
  }

  function saveChatMessages() {
    return replaceChatMessages(getChatMessages());
  }

  function chatRowToMessage(row) {
    const legacyGroupId = typeof row.room_id === 'string' && row.room_id.startsWith('group:') ? row.room_id.slice(6) : null;
    return {
      id: String(row.id), senderId: row.sender_id == null ? null : String(row.sender_id),
      senderName: row.sender_name || row.sender_username || 'Kullanıcı', senderUsername: row.sender_username || '',
      senderAvatar: row.sender_avatar || '', receiverId: row.receiver_id == null ? null : String(row.receiver_id),
      roomId: legacyGroupId ? null : row.room_id == null ? null : String(row.room_id),
      groupId: row.group_id == null ? legacyGroupId : String(row.group_id), text: row.text || '',
      attachment: row.attachment?.dataUrl ? row.attachment : null, voice: row.voice || null,
      replyTo: row.reply_to || row.attachment?.replyTo || null, isNudge: Boolean(row.is_nudge),
      reactions: row.reactions || {}, isRead: Boolean(row.is_read), readAt: row.read_at || null,
      createdAt: row.created_at || new Date().toISOString()
    };
  }

  async function ensureChatMessagesHydrated() {
    if (!supabase) return getChatMessages();
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      const { data, error } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(3000);
      if (error) throw error;
      const merged = new Map(getChatMessages().map(message => [String(message.id), message]));
      (Array.isArray(data) ? data : []).forEach(row => merged.set(String(row.id), chatRowToMessage(row)));
      return replaceChatMessages(Array.from(merged.values()).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
    })().catch(error => {
      console.warn('Sohbet geçmişi Supabase üzerinden yüklenemedi:', safeLogStr(error.message));
      return getChatMessages();
    });
    return hydrationPromise;
  }

  async function persistChatMessage(message) {
    if (!supabase) return;
    const row = {
      id: message.id, sender_id: message.senderId, receiver_id: message.receiverId, room_id: message.roomId,
      group_id: message.groupId, sender_name: message.senderName, sender_username: message.senderUsername,
      sender_avatar: message.senderAvatar, text: message.text, attachment: message.attachment, voice: message.voice,
      reply_to: message.replyTo || null,
      is_nudge: Boolean(message.isNudge), reactions: message.reactions || {}, is_read: Boolean(message.isRead),
      read_at: message.readAt, created_at: message.createdAt
    };
    let result = await supabase.from('chat_messages').upsert(row, { onConflict: 'id' });
    if (result.error && /group_id|sender_name|sender_username|sender_avatar|is_nudge|reply_to/i.test(String(result.error.message || ''))) {
      const legacyRow = { ...row };
      if (message.groupId) legacyRow.room_id = `group:${message.groupId}`;
      if (message.replyTo) legacyRow.attachment = { ...(message.attachment || {}), replyTo: message.replyTo };
      delete legacyRow.group_id;
      delete legacyRow.sender_name;
      delete legacyRow.sender_username;
      delete legacyRow.sender_avatar;
      delete legacyRow.is_nudge;
      delete legacyRow.reply_to;
      result = await supabase.from('chat_messages').upsert(legacyRow, { onConflict: 'id' });
    }
    if (result.error) throw result.error;
  }

  function chatPayloadSize(value) {
    if (!value) return 0;
    try { return Buffer.byteLength(JSON.stringify(value), 'utf8'); } catch { return Number.MAX_SAFE_INTEGER; }
  }

  function getUnreadCountsForUser(userId) {
    const counts = {}, lastInteraction = {};
    let total = 0;
    const currentUserId = String(userId);
    for (const message of getChatMessages()) {
      const incoming = String(message.receiverId) === currentUserId;
      const outgoing = String(message.senderId) === currentUserId;
      const time = new Date(message.createdAt || 0).getTime();
      if (incoming && !message.isRead) {
        const senderId = String(message.senderId);
        counts[senderId] = (counts[senderId] || 0) + 1;
        total++;
      }
      if (incoming || outgoing) {
        const peerId = incoming ? String(message.senderId) : String(message.receiverId);
        if (peerId && (!lastInteraction[peerId] || time > lastInteraction[peerId])) lastInteraction[peerId] = time;
      }
      for (const id of [message.roomId, message.groupId].filter(Boolean).map(String)) {
        if (!lastInteraction[id] || time > lastInteraction[id]) lastInteraction[id] = time;
      }
    }
    return { bySender: counts, total, lastInteraction };
  }

  return { chatPayloadSize, ensureChatMessagesHydrated, getChatMessages, getUnreadCountsForUser, persistChatMessage, replaceChatMessages, saveChatMessages };
}

module.exports = { createChatMessageService };
