const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOwnedReportRow, canManageReport, canReadReport, nextReportVersion, reportRowToClient } = require('../lib/report_access');

const owner = { id: 'usr_owner', username: 'owner', full_name: 'Owner User', department: 'IT', role: 'user' };
const other = { id: 'usr_other', username: 'other', role: 'user' };

test('özel raporu yalnızca sahibi veya admin okuyup yönetebilir', () => {
  const report = { id: 'rep_1', userId: owner.id, isPublic: false };
  assert.equal(canReadReport(owner, report), true);
  assert.equal(canReadReport(other, report), false);
  assert.equal(canManageReport(other, report), false);
  assert.equal(canManageReport({ ...other, role: 'admin' }, report), true);
});

test('başkasının açık ve silinmemiş raporu okunabilir ancak yönetilemez', () => {
  const report = { id: 'rep_1', user_id: owner.id, is_public: true, is_deleted: false };
  assert.equal(canReadReport(other, report), true);
  assert.equal(canManageReport(other, report), false);
  assert.equal(canReadReport(other, { ...report, is_deleted: true }), false);
});

test('istemcinin sahiplik alanlarını oturum kullanıcısıyla ezer', () => {
  const row = buildOwnedReportRow({
    id: 'rep_1',
    name: 'Rapor',
    userId: 'usr_victim',
    ownerUsername: 'victim',
    isPublic: true
  }, owner);

  assert.equal(row.user_id, owner.id);
  assert.equal(row.owner_username, owner.username);
  assert.equal(row.data.userId, owner.id);
  assert.equal(row.data.ownerUsername, owner.username);
});

test('istemci çıktısında data içindeki sahte yetki alanlarını authoritative kolonlarla ezer', () => {
  const result = reportRowToClient({
    id: 'rep_1',
    user_id: owner.id,
    name: 'Rapor',
    is_public: false,
    is_deleted: false,
    owner_username: owner.username,
    data: { userId: 'usr_victim', isPublic: true, ownerUsername: 'victim' }
  });

  assert.equal(result.userId, owner.id);
  assert.equal(result.isPublic, false);
  assert.equal(result.ownerUsername, owner.username);
});

test('yeni rapor sürüm 1 ile başlar ve doğru sürüm bir artırılır', () => {
  assert.equal(nextReportVersion(null, 0), 1);
  assert.equal(nextReportVersion({ version: 4 }, 4), 5);
});

test('eski sürümle rapor yazma girişimi conflict üretir', () => {
  assert.throws(() => nextReportVersion({ version: 4 }, 3), error => {
    assert.equal(error.code, 'REPORT_CONFLICT');
    assert.equal(error.currentVersion, 4);
    return true;
  });
});

test('rapor istemci çıktısına authoritative sürüm eklenir', () => {
  assert.equal(reportRowToClient({ id: 'rep_1', user_id: owner.id, version: 7 }).version, 7);
});

test('toSupabaseReportRow desteklenen version kolonunu ve data içeriğini korur', () => {
  const { toSupabaseReportRow } = require('../lib/report_access');
  const fullRow = {
    id: 'rep_123',
    name: 'Test Rapor',
    user_id: owner.id,
    is_public: true,
    owner_name: 'Owner Name',
    owner_username: 'owner',
    version: 3,
    file_size: 1024,
    data: { id: 'rep_123', is_public: true, version: 3 }
  };
  const sanitized = toSupabaseReportRow(fullRow);
  assert.equal(sanitized.id, 'rep_123');
  assert.equal(sanitized.user_id, owner.id);
  assert.equal(sanitized.is_public, undefined);
  assert.equal(sanitized.owner_name, undefined);
  assert.equal(sanitized.version, 3);
  assert.equal(sanitized.data.is_public, true);
  assert.equal(sanitized.data.version, 3);
});

test('reportRowToClient kolonu olmayan is_public ve version alanlarını data içinden okur', () => {
  const rowWithoutColumns = {
    id: 'rep_456',
    user_id: owner.id,
    name: 'DB Rapor',
    data: {
      is_public: true,
      owner_name: 'Ali Veli',
      version: 5
    }
  };
  const clientObj = reportRowToClient(rowWithoutColumns);
  assert.equal(clientObj.isPublic, true);
  assert.equal(clientObj.ownerName, 'Ali Veli');
  assert.equal(clientObj.version, 5);
});
