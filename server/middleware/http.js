const express = require('express');
const { createRateLimiter } = require('../../lib/rate_limiter');

function configureHttpMiddleware(app, { requestBodyLimit = '15mb', stagingAccess }) {
  const authRateLimiter = createRateLimiter({
    windowMs: 60000,
    max: 25,
    message: 'Giriş/Kayıt deneme sınırı aşıldı. Lütfen 1 dakika bekleyiniz.'
  });
  const adminRateLimiter = createRateLimiter({ windowMs: 60000, max: 60, message: 'Yönetim istek sınırı aşıldı.' });
  const apiWriteRateLimiter = createRateLimiter({
    windowMs: 60000,
    max: 120,
    message: 'Yazma işlemi sınırı aşıldı. Lütfen kısa bir süre bekleyiniz.'
  });

  app.use(express.json({ limit: requestBodyLimit, strict: true }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));
  app.use(stagingAccess);

  return { adminRateLimiter, apiWriteRateLimiter, authRateLimiter };
}

module.exports = { configureHttpMiddleware };
