const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const routesPath = path.join(root, 'server', 'routes');
const { createReportService } = require('../server/services/report_service');

test('server remains an orchestrator with startup after route registration', () => {
  const source = fs.readFileSync(serverPath, 'utf8');
  assert.doesNotMatch(source, /app\.(get|post|put|patch|delete)\s*\(/, 'server.js must not contain inline endpoints');
  const startupIndex = source.lastIndexOf('startServer(app');
  assert.ok(startupIndex > 0, 'startServer call is required');
  assert.ok(startupIndex > source.lastIndexOf('registerAdminMailRoutes(app'), 'server must start after the final route registration');
});

test('registered route modules do not declare duplicate method and path pairs', () => {
  const declarations = new Map();
  const files = fs.readdirSync(routesPath).filter(name => name.endsWith('.js'));
  for (const name of files) {
    const source = fs.readFileSync(path.join(routesPath, name), 'utf8');
    const pattern = /app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(pattern)) {
      const key = `${match[1].toUpperCase()} ${match[2]}`;
      assert.equal(declarations.has(key), false, `Duplicate route ${key}: ${declarations.get(key)} and ${name}`);
      declarations.set(key, name);
    }
  }
  assert.ok(declarations.size >= 80, 'expected application route set to be registered');
});

test('report service reads, writes and resolves encoded local report ids', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frpoku-report-service-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const storePath = path.join(directory, 'store.json');
  const service = createReportService({
    canReadReport: () => true,
    reportId: report => String(report.id),
    reportRowToClient: report => ({ ...report, client: true }),
    reportRowToSummaryClient: report => ({ id: report.id, summary: true }),
    storePath,
    supabase: null
  });

  service.writeLocalReports([{ id: 'report 1', isDeleted: false, updated_at: '2026-01-01T00:00:00.000Z' }]);
  assert.equal(fs.existsSync(storePath), true);
  assert.equal(service.readLocalReports().length, 1);
  assert.equal((await service.getReportRecord('report%201')).id, 'report 1');

  const visible = await service.loadVisibleReports({ id: 'user-1', role: 'user' }, false);
  assert.deepEqual(visible, [{ id: 'report 1', summary: true }]);
});
