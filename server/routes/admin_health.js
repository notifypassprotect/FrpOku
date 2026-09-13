const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function registerAdminHealthRoute(app, deps) {
  const { adminRateLimiter, getLocalUsers, mailer, requireAdmin, rootDirectory, supabase } = deps;
  app.get('/api/admin/system-health', adminRateLimiter, requireAdmin, async (req, res) => {
    try {
      const envPath = path.join(rootDirectory, '.env');
      if (fs.existsSync(envPath)) Object.assign(process.env, dotenv.parse(fs.readFileSync(envPath)));
    } catch (error) {}

    const startedAt = Date.now();
    let databaseConnected = false, databaseLatency = 0, users = [];
    if (supabase) {
      try {
        const result = await supabase.from('app_users').select('id, is_active');
        databaseLatency = Date.now() - startedAt;
        if (!result.error && Array.isArray(result.data)) {
          databaseConnected = true;
          users = result.data;
        }
      } catch (error) {
        databaseLatency = Date.now() - startedAt;
      }
    } else users = getLocalUsers();

    const memory = process.memoryUsage();
    const uptime = Math.floor(process.uptime());
    const rss = (memory.rss / 1048576).toFixed(1);
    res.json({
      success: true,
      health: {
        uptimeSeconds: uptime,
        supabase: { connected: databaseConnected, latencyMs: databaseLatency, mode: supabase ? 'cloud' : 'local' },
        system: { uptimeSec: uptime, memoryRssMb: rss, nodeVersion: process.version },
        users: {
          total: users.length,
          pending: users.filter(user => user.is_active === false && (!supabase ? !user.is_frozen : true)).length,
          frozen: supabase ? 0 : users.filter(user => user.is_frozen === true).length
        },
        db: {
          provider: supabase ? 'Supabase Cloud (PostgreSQL)' : 'Local JSON Storage',
          status: databaseConnected ? 'connected' : supabase ? 'error' : 'local', latencyMs: databaseLatency
        },
        mail: mailer.getStatus(),
        memory: { rssMb: rss, heapUsedMb: (memory.heapUsed / 1048576).toFixed(1) }
      }
    });
  });
}

module.exports = { registerAdminHealthRoute };
