const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function setNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function scriptSafePolicy() {
  return "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob: https:; media-src 'self' data: blob:; frame-src 'self' blob: data: https:; object-src 'self' blob: data:; worker-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';";
}

function noncePolicy(nonce) {
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob: https:; media-src 'self' data: blob:; frame-src 'self' blob: data: https:; object-src 'self' blob: data:; base-uri 'self'; form-action 'self'; frame-ancestors 'self';`;
}

function registerSystemRoutes(app, options) {
  const { appEnvironment, browserSupabaseEnabled, publicRoot, supabaseAnonKey, supabaseUrl } = options;
  const sendScriptSafePage = (res, page) => {
    setNoStoreHeaders(res);
    res.setHeader('Content-Security-Policy', scriptSafePolicy());
    res.sendFile(path.join(publicRoot, page));
  };
  const sendNoncePage = (res, page) => {
    const nonce = crypto.randomBytes(18).toString('base64');
    fs.readFile(path.join(publicRoot, page), 'utf8', (error, source) => {
      if (error) return res.status(500).send('Sayfa yüklenemedi.');
      setNoStoreHeaders(res);
      res.setHeader('Content-Security-Policy', noncePolicy(nonce));
      const html = source.replace(/<script(?![^>]*\bsrc=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);
      res.type('html').send(html);
    });
  };

  app.get('/', (req, res) => sendScriptSafePage(res, 'index.html'));
  app.get('/index.html', (req, res) => sendScriptSafePage(res, 'index.html'));
  app.get('/compare.html', (req, res) => sendScriptSafePage(res, 'compare.html'));
  app.get('/detail.html', (req, res) => sendScriptSafePage(res, 'detail.html'));
  app.get('/dashboard.html', (req, res) => sendNoncePage(res, 'dashboard.html'));
  app.get('/api/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', service: 'frpoku', environment: appEnvironment, timestamp: new Date().toISOString() });
  });
  app.get('/runtime-config.js', (req, res) => {
    res.type('application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`window.FRP_RUNTIME_CONFIG = ${JSON.stringify({
      supabaseUrl: supabaseUrl || '',
      supabaseAnonKey: browserSupabaseEnabled ? supabaseAnonKey : '',
      environment: appEnvironment
    })};`);
  });
  app.get('/api/config', (req, res) => {
    res.json({
      supabaseUrl: supabaseUrl || '',
      supabaseAnonKey: browserSupabaseEnabled ? supabaseAnonKey : ''
    });
  });
}

module.exports = { registerSystemRoutes };
