const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canReadReport,
  canManageReport,
  reportIsPublic,
  reportRowToClient,
  buildOwnedReportRow
} = require('../lib/report_access');

const userA = { id: 'usr_user_a', username: 'usera', role: 'user' };
const userB = { id: 'usr_user_b', username: 'userb', role: 'user' };
const admin = { id: 'usr_admin', username: 'admin', role: 'admin' };

test('reportIsPublic tüm varyantları (is_public, isPublic, inPool, in_pool, data.*) doğru tanır', () => {
  assert.equal(reportIsPublic({ is_public: true }), true);
  assert.equal(reportIsPublic({ isPublic: true }), true);
  assert.equal(reportIsPublic({ inPool: true }), true);
  assert.equal(reportIsPublic({ in_pool: true }), true);
  assert.equal(reportIsPublic({ data: { is_public: true } }), true);
  assert.equal(reportIsPublic({ data: { isPublic: true } }), true);
  assert.equal(reportIsPublic({ data: { inPool: true } }), true);
  assert.equal(reportIsPublic({ data: { in_pool: true } }), true);
  assert.equal(reportIsPublic({ is_public: false, isPublic: false, data: {} }), false);
});

test('reportRowToClient havuz bayraklarını istemciye daima normalize ederek aktarır', () => {
  const rowWithDataFlag = {
    id: 'rep_pool_1',
    user_id: userA.id,
    name: 'Havuz Raporu 1',
    data: {
      id: 'rep_pool_1',
      is_public: true
    }
  };
  const clientObj = reportRowToClient(rowWithDataFlag);
  assert.equal(clientObj.isPublic, true);
  assert.equal(clientObj.is_public, true);
  assert.equal(clientObj.inPool, true);
  assert.equal(clientObj.in_pool, true);

  const rowWithCamelCase = {
    id: 'rep_pool_2',
    user_id: userA.id,
    name: 'Havuz Raporu 2',
    data: {
      id: 'rep_pool_2',
      isPublic: true
    }
  };
  const clientObj2 = reportRowToClient(rowWithCamelCase);
  assert.equal(clientObj2.isPublic, true);
  assert.equal(clientObj2.is_public, true);
  assert.equal(clientObj2.inPool, true);
  assert.equal(clientObj2.in_pool, true);
});

test('canReadReport başka bir kullanıcının havuza attığı raporu diğer kullanıcılara açar', () => {
  const pooledReport = {
    id: '5d9483b1-16ec-4956-b496-a8689ae19391',
    user_id: userA.id,
    name: '20.3_OZELLIKLI_BIRIMLERDE_5_GUNLUK_TUKETIM-43.frp',
    data: {
      id: '5d9483b1-16ec-4956-b496-a8689ae19391',
      user_id: userA.id,
      is_public: true,
      isPublic: true
    }
  };

  // Sahip User A okuyabilir
  assert.equal(canReadReport(userA, pooledReport), true);
  // Başka kullanıcı User B de havuza atıldığı için okuyabilir
  assert.equal(canReadReport(userB, pooledReport), true);
  // Admin okuyabilir
  assert.equal(canReadReport(admin, pooledReport), true);

  // Silinmişse başka kullanıcı okuyamaz
  const deletedPooledReport = { ...pooledReport, is_deleted: true };
  assert.equal(canReadReport(userB, deletedPooledReport), false);
});

test('canManageReport başka kullanıcının havuzdaki raporunun izinsiz silinmesini engeller', () => {
  const pooledReport = {
    id: 'rep_100',
    user_id: userA.id,
    data: { user_id: userA.id, is_public: true }
  };

  // Sahibi User A yönetebilir
  assert.equal(canManageReport(userA, pooledReport), true);
  // Başka kullanıcı User B yönetemez (salt okunur)
  assert.equal(canManageReport(userB, pooledReport), false);
  // Admin yönetebilir
  assert.equal(canManageReport(admin, pooledReport), true);
});

test('buildOwnedReportRow havuz bayraklarını safeData içine eksiksiz yerleştirir', () => {
  const row = buildOwnedReportRow({
    id: 'rep_test',
    name: 'Test Rapor',
    isPublic: true
  }, userA);

  assert.equal(row.is_public, true);
  assert.equal(row.data.isPublic, true);
  assert.equal(row.data.is_public, true);
  assert.equal(row.data.inPool, true);
  assert.equal(row.data.in_pool, true);
  assert.ok(row.data.sharedAt);
});
