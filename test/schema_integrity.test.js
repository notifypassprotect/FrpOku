const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/011_schema_integrity_hardening.sql'), 'utf8');

test('011 migration eski reports şemasını kayıpsız tamamlar', () => {
  assert.match(sql, /alter table public\.reports add column if not exists is_public boolean/i);
  assert.match(sql, /alter table public\.reports add column if not exists version bigint/i);
  assert.match(sql, /data->>'inPool'/);
  assert.match(sql, /data->>'version'/);
  assert.doesNotMatch(sql, /drop table|truncate table|delete from/i);
});

test('011 migration sohbet tablolarını servis-köprüsü erişim modeline alır', () => {
  for (const table of ['chat_messages', 'chat_rooms']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`, 'i'));
    assert.match(sql, new RegExp(`grant all on public\\.${table} to service_role`, 'i'));
  }
});

test('011 migration mesaj hedefi ve sorgu indekslerini güvenceye alır', () => {
  assert.match(sql, /num_nonnulls\(receiver_id, room_id, group_id\)=1/i);
  assert.match(sql, /chat_messages_sender_required/i);
  assert.match(sql, /reports_user_active_updated_idx/i);
  assert.match(sql, /chat_messages_receiver_sender_created_idx/i);
  assert.match(sql, /user_settings_user_fk/i);
});
