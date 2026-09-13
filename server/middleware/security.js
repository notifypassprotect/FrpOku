const BLOCKED_PATHS = [
  /^\/\.env/i,
  /^\/data(\/|$)/i,
  /^\/\.git(\/|$)/i,
  /^\/\.vscode(\/|$)/i,
  /^\/package(-lock)?\.json$/i,
  /^\/server\.js$/i,
  /\.bak$/i,
  /\.tmp$/i,
  /\.log$/i
];

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "frame-src 'self' blob: data: https:",
  "object-src 'self' blob: data:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join('; ') + ';';

function securityHeaders(req, res, next) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(self)');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  next();
}

function protectInternalFiles(req, res, next) {
  try {
    const normalizedPath = decodeURIComponent(req.path).replace(/\\/g, '/').toLowerCase();
    if (BLOCKED_PATHS.some(pattern => pattern.test(normalizedPath))) {
      return res.status(403).json({
        success: false,
        reason: '403 Forbidden: Bu dosya veya dizine doğrudan erişim güvenlik politikası gereği engellenmiştir.'
      });
    }
  } catch (error) {
    return res.status(400).json({ success: false, reason: 'Geçersiz istek URL yolu.' });
  }
  next();
}

module.exports = { protectInternalFiles, securityHeaders };
