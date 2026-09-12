const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('auth.js dosyasında updateSession fonksiyonu kapsam içinde tanımlıdır ve dışa aktarılır', () => {
  const authSource = fs.readFileSync(path.join(root, 'js', 'core', 'auth.js'), 'utf8');
  assert.match(authSource, /function updateSession\(updatedUser\)/, 'updateSession kapsam içinde tanımlanmış olmalı');
  assert.match(authSource, /updateSession\s*[,}]/, 'updateSession window.FrpAuth içinde dışa aktarılmış olmalı');
  assert.doesNotMatch(authSource, /updateSession\(updatedUser\)\s*\{[\s\S]*currentUser = \{\.\.\.currentUser/, 'updateSession nesne içinde anonim değil, bağımsız fonksiyon olmalı');
});

test('lib/report_access.js canEditReportNote fonksiyonunu dışa aktarır ve noteHtml ile ekleri korur', () => {
  const reportAccess = require('../lib/report_access');
  assert.equal(typeof reportAccess.canEditReportNote, 'function', 'canEditReportNote dışa aktarılmalı');

  const ownerUser = { id: 'u1', role: 'user' };
  const otherUser = { id: 'u2', role: 'user' };
  const adminUser = { id: 'admin1', role: 'admin' };

  const privateReport = { id: 'rep1', user_id: 'u1', is_public: false };
  const poolReport = { id: 'rep2', user_id: 'u1', is_public: true };

  assert.equal(reportAccess.canEditReportNote(ownerUser, privateReport), true);
  assert.equal(reportAccess.canEditReportNote(otherUser, privateReport), false);
  assert.equal(reportAccess.canEditReportNote(adminUser, privateReport), true);
  assert.equal(reportAccess.canEditReportNote(otherUser, poolReport), true, 'Havuzdaki rapora okuma yetkisi olan kullanıcı not ekleyebilmeli');

  const row = reportAccess.buildOwnedReportRow({
    id: 'rep3',
    name: 'Ekli Rapor',
    userNote: 'Kullanıcı notu',
    noteHtml: '<p>HTML notu</p>',
    attachments: [{ id: 'att1', name: 'belge.pdf', size: 1024, type: 'application/pdf' }]
  }, ownerUser);

  assert.equal(row.data.noteHtml, '<p>HTML notu</p>');
  assert.equal(Array.isArray(row.data.attachments), true);
  assert.equal(row.data.attachments.length, 1);
  assert.equal(row.data.attachments[0].name, 'belge.pdf');
});

test('server.js dosyasında varlık (presence) ve zengin not/ek rotaları mevcuttur', () => {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(serverSource, /\/api\/presence\/heartbeat/);
  assert.match(serverSource, /\/api\/presence\/users/);
  assert.match(serverSource, /\/api\/presence\/offline/);
  assert.match(serverSource, /\/api\/reports\/:id\/note/);
  assert.match(serverSource, /\/api\/reports\/:id\/attachments/);
});

test('supabase migration 005_rich_notes_and_presence.sql doğru kolon ve indeksleri tanımlar', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '005_rich_notes_and_presence.sql'), 'utf8');
  assert.match(sql, /last_seen timestamptz/i);
  assert.match(sql, /is_online boolean/i);
  assert.match(sql, /note_html text/i);
  assert.match(sql, /note_attachments jsonb/i);
});

test('image_annotator.js ve rich_note_editor.js dosyalarında inline event bulunmaz', () => {
  const annotator = fs.readFileSync(path.join(root, 'js', 'list', 'image_annotator.js'), 'utf8');
  const editor = fs.readFileSync(path.join(root, 'js', 'list', 'rich_note_editor.js'), 'utf8');
  const presence = fs.readFileSync(path.join(root, 'js', 'core', 'online_presence.js'), 'utf8');

  const inlineEvent = /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i;
  assert.doesNotMatch(annotator, inlineEvent);
  assert.doesNotMatch(editor, inlineEvent);
  assert.doesNotMatch(presence, inlineEvent);
});

test('session_auth query parametresindeki tokeni okuyabilir', () => {
  const { readBearerToken } = require('../lib/session_auth');
  const reqWithQuery = { headers: {}, query: { token: 'sample-jwt-token' } };
  const reqWithHeader = { headers: { authorization: 'Bearer header-jwt-token' }, query: { token: 'sample-jwt-token' } };
  const reqEmpty = { headers: {}, query: {} };

  assert.equal(readBearerToken(reqWithQuery), 'sample-jwt-token');
  assert.equal(readBearerToken(reqWithHeader), 'header-jwt-token');
  assert.equal(readBearerToken(reqEmpty), '');
});

test('mailer getMailStats doğru istatistik ve geçmiş kaydı tutar', async () => {
  const { createMailer } = require('../lib/mailer');
  const mailer = createMailer({
    env: {
      MAIL_ENABLED: 'true',
      MAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'test-key',
      BREVO_FROM_EMAIL: 'test@example.com'
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ messageId: 'msg-123' })
    })
  });

  const statsBefore = mailer.getMailStats();
  assert.equal(typeof statsBefore.total, 'number');
  assert.equal(Array.isArray(statsBefore.history), true);

  await mailer.sendAccountApproved({ to: 'user@example.com', fullName: 'Ali Veli', username: 'aliveli' });

  const statsAfter = mailer.getMailStats();
  assert.equal(statsAfter.total >= 1, true);
  assert.equal(statsAfter.successful >= 1, true);
  assert.equal(statsAfter.byType.accountApproved >= 1, true);
  assert.equal(statsAfter.history.length >= 1, true);
  assert.equal(statsAfter.history[0].recipient, 'user@example.com');
});

test('auth_admin_modal.js dosyasında native prompt ve confirm çağrısı bulunmaz', () => {
  const adminModal = fs.readFileSync(path.join(root, 'js', 'core', 'auth', 'auth_admin_modal.js'), 'utf8');
  assert.doesNotMatch(adminModal, /(?<!showAdminCustom)prompt\s*\(/);
  assert.doesNotMatch(adminModal, /(?<!showAdminCustom)confirm\s*\(/);
});
