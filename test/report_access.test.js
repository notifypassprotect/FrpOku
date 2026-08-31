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
