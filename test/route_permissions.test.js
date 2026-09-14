const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const { registerReportPoolRoutes } = require('../server/routes/report_pool');
const { registerReportLifecycleRoutes } = require('../server/routes/report_lifecycle');
const { registerReportNoteRoutes } = require('../server/routes/report_notes');
const { registerAdminUserStatusRoutes } = require('../server/routes/admin_user_status');

function createApp() {
  const routes = new Map();
  const app = {};
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    app[method] = (route, ...handlers) => routes.set(`${method.toUpperCase()} ${route}`, handlers.at(-1));
  }
  return { app, handler: (method, route) => routes.get(`${method} ${route}`) };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    setHeader() {},
    sendFile() {}
  };
}

const middleware = (_req, _res, next) => next?.();

test('report pool rejects users without management permission', async () => {
  const { app, handler } = createApp();
  registerReportPoolRoutes(app, {
    apiWriteRateLimiter: middleware,
    canManageReport: () => false,
    getReportRecord: async () => ({ id: 'report-1', user_id: 'owner' }),
    readLocalReports: () => [],
    reportId: report => report.id,
    reportRowToClient: report => report,
    requireAuth: middleware,
    supabase: null,
    writeLocalReports() {}
  });
  const res = createResponse();
  await handler('POST', '/api/reports/toggle-pool')({ body: { reportId: 'report-1', makePublic: true }, authUser: { id: 'other' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('report pool updates an authorized local report', async () => {
  const reports = [{ id: 'report-1', isPublic: false }];
  const { app, handler } = createApp();
  registerReportPoolRoutes(app, {
    apiWriteRateLimiter: middleware,
    canManageReport: () => true,
    getReportRecord: async () => reports[0],
    readLocalReports: () => reports,
    reportId: report => report.id,
    reportRowToClient: report => report,
    requireAuth: middleware,
    supabase: null,
    writeLocalReports(next) { reports.splice(0, reports.length, ...next); }
  });
  const res = createResponse();
  await handler('POST', '/api/reports/toggle-pool')({ body: { reportId: 'report-1', makePublic: true }, authUser: { id: 'owner' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.isPublic, true);
  assert.equal(reports[0].is_public, true);
});

test('report lifecycle rejects deletion without management permission', async () => {
  const { app, handler } = createApp();
  registerReportLifecycleRoutes(app, {
    apiWriteRateLimiter: middleware,
    canManageReport: () => false,
    getReportRecord: async () => ({ id: 'report-1' }),
    nextReportVersion: () => 2,
    readLocalReports: () => [],
    reportId: report => report.id,
    reportRowToClient: report => report,
    requireAuth: middleware,
    supabase: null,
    writeLocalReports() {}
  });
  const res = createResponse();
  await handler('DELETE', '/api/reports/:id')({ params: { id: 'report-1' }, authUser: { id: 'other' } }, res);
  assert.equal(res.statusCode, 403);
});

test('attachment upload rejects report ids that escape attachment storage', async () => {
  const { app, handler } = createApp();
  registerReportNoteRoutes(app, {
    apiWriteRateLimiter: middleware,
    attachmentsDir: path.join(os.tmpdir(), 'frpoku-attachments-test'),
    canEditReportNote: () => true,
    canReadReport: () => true,
    getReportRecord: async () => ({ id: '../escape' }),
    readLocalReports: () => [],
    recordAuditLog() {},
    reportId: report => report.id,
    reportRowToClient: report => report,
    requireAuth: middleware,
    safeLogStr: String,
    supabase: null,
    writeLocalReports() {}
  });
  const res = createResponse();
  await handler('POST', '/api/reports/:id/attachments')({
    params: { id: '../escape' },
    body: { filename: 'sample.txt', base64Data: Buffer.from('sample').toString('base64') },
    authUser: { id: 'owner' }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.reason, /Geçersiz rapor kimliği/);
});

test('administrator cannot delete their own account', async () => {
  const { app, handler } = createApp();
  registerAdminUserStatusRoutes(app, {
    adminRateLimiter: middleware,
    getLocalUsers: () => [],
    loadUserById: async () => null,
    mailer: {},
    readLocalReports: () => [],
    recordAuditLog() {},
    requireAdmin: middleware,
    safeLogStr: String,
    saveLocalUsers() {},
    supabase: null,
    updateUserById: async () => null,
    writeLocalReports() {}
  });
  const res = createResponse();
  await handler('POST', '/api/admin/delete-user')({ body: { userId: 'admin-1' }, adminUser: { id: 'admin-1' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.reason, /Kendi yönetici hesabınızı silemezsiniz/);
});
