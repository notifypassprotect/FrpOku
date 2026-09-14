const test = require('node:test');
const assert = require('node:assert/strict');
const { registerReportWriteRoute } = require('../server/routes/report_write');

function setup(overrides = {}) {
  const routes = new Map();
  const app = {
    put(route, ...handlers) { routes.set(`PUT ${route}`, handlers.at(-1)); },
    post(route, ...handlers) { routes.set(`POST ${route}`, handlers.at(-1)); }
  };
  const middleware = (_req, _res, next) => next?.();
  registerReportWriteRoute(app, {
    apiWriteRateLimiter: middleware,
    buildOwnedReportRow: body => ({ ...body, data: {} }),
    canManageReport: () => true,
    getReportRecord: async () => null,
    nextReportVersion: () => 1,
    readLocalReports: () => [],
    reportId: report => report.id,
    reportRowToClient: report => report,
    requireAuth: middleware,
    safeLogStr: String,
    supabase: null,
    toSupabaseReportRow: report => report,
    writeLocalReports() {},
    ...overrides
  });
  return routes;
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('report write rejects URL and body id mismatch', async () => {
  const routes = setup();
  const res = response();
  await routes.get('PUT /api/reports/:id')({
    params: { id: 'report-1' },
    body: { id: 'report-2' },
    authUser: { id: 'owner' }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.reason, /kimliği istek adresiyle eşleşmelidir/);
});

test('report write rejects modification without management permission', async () => {
  const routes = setup({
    getReportRecord: async () => ({ id: 'report-1', user_id: 'owner' }),
    canManageReport: () => false
  });
  const res = response();
  await routes.get('PUT /api/reports/:id')({
    params: { id: 'report-1' },
    body: { id: 'report-1', version: 1 },
    authUser: { id: 'other' }
  }, res);
  assert.equal(res.statusCode, 403);
});

test('report write returns current version on optimistic locking conflict', async () => {
  const conflict = new Error('conflict');
  conflict.code = 'REPORT_CONFLICT';
  conflict.currentVersion = 7;
  const routes = setup({
    getReportRecord: async () => ({ id: 'report-1', version: 7 }),
    nextReportVersion() { throw conflict; }
  });
  const res = response();
  await routes.get('PUT /api/reports/:id')({
    params: { id: 'report-1' },
    body: { id: 'report-1', version: 6 },
    authUser: { id: 'owner' }
  }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'REPORT_CONFLICT');
  assert.equal(res.body.currentVersion, 7);
});

test('legacy snapshot write endpoint remains explicitly disabled', async () => {
  const routes = setup();
  const res = response();
  await routes.get('POST /api/store/save')({}, res);
  assert.equal(res.statusCode, 410);
  assert.equal(res.body.code, 'SNAPSHOT_SYNC_REMOVED');
});
