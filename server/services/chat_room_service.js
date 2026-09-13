const DEFAULT_ROOMS = [
  { id: 'room_general', name: 'Genel Ekip Duyuruları', icon: '📢', description: 'Tüm birimler ortak iletişim ve duyuru kanalı', isAllUsers: true, memberUserIds: [] },
  { id: 'room_ops', name: 'Operasyon & Saha', icon: '⚙️', description: 'Raporlama ve saha operasyon koordinasyonu', isAllUsers: true, memberUserIds: [] },
  { id: 'room_finance', name: 'Muhasebe & Finans', icon: '📊', description: 'Mali tablolar ve mutabakat kanalı', isAllUsers: true, memberUserIds: [] }
];

function createChatRoomService({ store, supabase }) {
  let cache = null;

  function chatRoomFromRow(room) {
    const isAllUsers = room.is_all_users !== undefined ? Boolean(room.is_all_users) : Boolean(room.isAllUsers);
    const memberUserIds = Array.isArray(room.member_user_ids) ? room.member_user_ids.map(String)
      : Array.isArray(room.memberUserIds) ? room.memberUserIds.map(String) : [];
    return {
      id: String(room.id), name: room.name || 'İsimsiz Oda', icon: room.icon || '💬', description: room.description || '',
      isAllUsers, is_all_users: isAllUsers, memberUserIds, member_user_ids: memberUserIds,
      createdBy: room.created_by || room.createdBy || null, createdAt: room.created_at || room.createdAt || null,
      updatedAt: room.updated_at || room.updatedAt || null
    };
  }

  function replaceChatRooms(rooms, persist = false) {
    cache = Array.isArray(rooms) ? rooms.map(chatRoomFromRow) : [];
    if (persist) store.write(cache);
    return cache;
  }

  function getChatRooms() {
    if (cache !== null) return cache;
    const stored = store.read();
    const rooms = Array.isArray(stored) && stored.length ? stored : DEFAULT_ROOMS;
    return replaceChatRooms(rooms, !Array.isArray(stored) || stored.length === 0);
  }

  function saveChatRooms() {
    store.write(getChatRooms());
  }

  async function loadChatRooms() {
    if (!supabase) return getChatRooms();
    const { data, error } = await supabase.from('chat_rooms').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return replaceChatRooms(data || []);
  }

  return { chatRoomFromRow, getChatRooms, loadChatRooms, replaceChatRooms, saveChatRooms };
}

module.exports = { createChatRoomService };
