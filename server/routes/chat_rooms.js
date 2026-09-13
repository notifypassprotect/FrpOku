function registerChatRoomRoutes(app, deps) {
  const { chatRoomFromRow, loadChatRooms, replaceChatRooms, requireAuth, saveChatRooms, supabase } = deps;

  app.get('/api/chat/rooms', requireAuth, async (req, res) => {
    try {
      const rooms = await loadChatRooms();
      const userId = String(req.authUser.id);
      const visible = rooms.filter(room => req.authUser.role === 'admin' || room.isAllUsers ||
        (Array.isArray(room.memberUserIds) && room.memberUserIds.map(String).includes(userId)));
      res.json({ success: true, rooms: visible.map(chatRoomFromRow) });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Odalar alınamadı.' });
    }
  });

  app.post('/api/chat/rooms', requireAuth, async (req, res) => {
    try {
      if (req.authUser.role !== 'admin') return res.status(403).json({ success: false, reason: 'Yalnızca yöneticiler oda oluşturabilir.' });
      const { name, icon, description } = req.body || {};
      const isAllUsers = req.body?.isAllUsers ?? req.body?.is_all_users ?? true;
      const memberUserIds = req.body?.memberUserIds ?? req.body?.member_user_ids ?? [];
      if (!name || !name.trim()) return res.status(400).json({ success: false, reason: 'Oda adı zorunludur.' });
      const rooms = await loadChatRooms();
      const room = {
        id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, name: name.trim(),
        icon: (icon || '📢').trim(), description: (description || '').trim(), isAllUsers: Boolean(isAllUsers),
        memberUserIds: Array.isArray(memberUserIds) ? memberUserIds.map(String) : [],
        createdBy: String(req.authUser.id), createdAt: new Date().toISOString()
      };
      if (supabase) {
        const { data, error } = await supabase.from('chat_rooms').insert({
          id: room.id, name: room.name, icon: room.icon, description: room.description,
          is_all_users: room.isAllUsers, member_user_ids: room.memberUserIds, created_by: req.authUser.id
        }).select('*').limit(1);
        if (error) throw error;
        const saved = data?.[0] ? chatRoomFromRow(data[0]) : room;
        replaceChatRooms([...rooms.filter(item => String(item.id) !== String(saved.id)), saved]);
        return res.json({ success: true, room: saved });
      }
      rooms.push(room);
      saveChatRooms();
      res.json({ success: true, room: chatRoomFromRow(room) });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Oda oluşturulamadı.' });
    }
  });

  app.put('/api/chat/rooms/:id', requireAuth, async (req, res) => {
    try {
      if (req.authUser.role !== 'admin') return res.status(403).json({ success: false, reason: 'Yalnızca yöneticiler odayı düzenleyebilir.' });
      const rooms = await loadChatRooms();
      const room = rooms.find(item => item.id === req.params.id);
      if (!room) return res.status(404).json({ success: false, reason: 'Oda bulunamadı.' });
      const { name, icon, description } = req.body || {};
      const isAllUsers = req.body?.isAllUsers ?? req.body?.is_all_users;
      const memberUserIds = req.body?.memberUserIds ?? req.body?.member_user_ids;
      if (name) room.name = name.trim();
      if (icon) room.icon = icon.trim();
      if (description !== undefined) room.description = String(description).trim();
      if (isAllUsers !== undefined) room.isAllUsers = Boolean(isAllUsers);
      if (Array.isArray(memberUserIds)) room.memberUserIds = memberUserIds.map(String);
      if (supabase) {
        const { data, error } = await supabase.from('chat_rooms').update({
          name: room.name, icon: room.icon, description: room.description, is_all_users: room.isAllUsers,
          member_user_ids: room.memberUserIds, updated_at: new Date().toISOString()
        }).eq('id', room.id).select('*').limit(1);
        if (error) throw error;
        const saved = data?.[0] ? chatRoomFromRow(data[0]) : room;
        replaceChatRooms(rooms.map(item => String(item.id) === String(saved.id) ? saved : item));
        return res.json({ success: true, room: saved });
      }
      saveChatRooms();
      res.json({ success: true, room: chatRoomFromRow(room) });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Oda güncellenemedi.' });
    }
  });

  app.delete('/api/chat/rooms/:id', requireAuth, async (req, res) => {
    try {
      if (req.authUser.role !== 'admin') return res.status(403).json({ success: false, reason: 'Yalnızca yöneticiler odayı silebilir.' });
      const rooms = await loadChatRooms();
      const index = rooms.findIndex(room => room.id === req.params.id);
      if (index === -1) return res.status(404).json({ success: false, reason: 'Oda bulunamadı.' });
      if (supabase) {
        const messageResult = await supabase.from('chat_messages').delete().eq('room_id', req.params.id);
        if (messageResult.error) throw messageResult.error;
        const roomResult = await supabase.from('chat_rooms').delete().eq('id', req.params.id);
        if (roomResult.error) throw roomResult.error;
        replaceChatRooms(rooms.filter(room => String(room.id) !== String(req.params.id)));
        return res.json({ success: true });
      }
      rooms.splice(index, 1);
      saveChatRooms();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, reason: 'Oda silinemedi.' });
    }
  });
}

module.exports = { registerChatRoomRoutes };
