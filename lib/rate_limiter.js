function normalizeIp(req) {
  return String(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

function createRateLimiter({
  windowMs = 60_000,
  max = 30,
  message = 'Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyiniz.',
  maxEntries = 10_000,
  now = () => Date.now()
} = {}) {
  const records = new Map();
  let operationCount = 0;

  function cleanup(currentTime) {
    for (const [key, record] of records) {
      if (record.resetTime <= currentTime) records.delete(key);
    }
    while (records.size >= maxEntries) {
      const oldestKey = records.keys().next().value;
      if (oldestKey === undefined) break;
      records.delete(oldestKey);
    }
  }

  return function rateLimiter(req, res, next) {
    const currentTime = now();
    operationCount++;
    if (operationCount % 100 === 0 || records.size >= maxEntries) cleanup(currentTime);

    const key = normalizeIp(req);
    let record = records.get(key);
    if (!record || record.resetTime <= currentTime) {
      record = { count: 0, resetTime: currentTime + windowMs };
      records.delete(key);
      records.set(key, record);
    }
    record.count++;

    const remaining = Math.max(0, max - record.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

    if (record.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - currentTime) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ success: false, reason: message, retryAfterSec });
    }
    next();
  };
}

module.exports = { createRateLimiter, normalizeIp };
