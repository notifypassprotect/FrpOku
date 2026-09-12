const test = require('node:test');
const assert = require('node:assert/strict');
const { createMailer, createMailTemplates } = require('../lib/mailer');

test('mail disabled durumunda SMTP çağrısı yapmaz', async () => {
  let called = false;
  const mailer = createMailer({
    env: { MAIL_ENABLED: 'false' },
    transporter: { sendMail: async () => { called = true; } }
  });

  const result = await mailer.sendAccountApproved({ to: 'user@example.com', username: 'user' });
  assert.equal(result.status, 'disabled');
  assert.equal(called, false);
});

test('onay mailini yapılandırılmış transporter ile gönderir', async () => {
  let sentMessage = null;
  const mailer = createMailer({
    env: {
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'sender@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'FrpOku <sender@example.com>',
      APP_BASE_URL: 'https://staging.example.com'
    },
    transporter: {
      sendMail: async message => {
        sentMessage = message;
        return { messageId: 'mail-1' };
      }
    }
  });

  const result = await mailer.sendAccountApproved({
    to: 'user@example.com',
    fullName: 'Test User',
    username: 'testuser'
  });

  assert.equal(result.sent, true);
  assert.equal(result.status, 'sent');
  assert.equal(sentMessage.to, 'user@example.com');
  assert.match(sentMessage.subject, /onaylandı/i);
  assert.match(sentMessage.html, /testuser/);
});

test('Brevo HTTPS API ile SMTP kullanmadan e-posta gönderir', async () => {
  let request = null;
  const mailer = createMailer({
    env: {
      MAIL_ENABLED: 'true',
      MAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'brevo-secret',
      BREVO_FROM_EMAIL: 'sender@gmail.com',
      BREVO_FROM_NAME: 'FrpOku Cloud Portal'
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 201, json: async () => ({ messageId: 'brevo-1' }) };
    }
  });

  const result = await mailer.sendTestEmail({ to: 'user@example.com' });
  const body = JSON.parse(request.options.body);

  assert.equal(result.sent, true);
  assert.equal(result.provider, 'brevo');
  assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(request.options.headers['api-key'], 'brevo-secret');
  assert.deepEqual(body.sender, { email: 'sender@gmail.com', name: 'FrpOku Cloud Portal' });
  assert.deepEqual(body.to, [{ email: 'user@example.com' }]);
});

test('Brevo hesap doğrulaması gönderim yapmadan API anahtarını kontrol eder', async () => {
  let requestedUrl = '';
  const mailer = createMailer({
    env: {
      MAIL_ENABLED: 'true',
      BREVO_API_KEY: 'brevo-secret',
      BREVO_FROM_EMAIL: 'sender@gmail.com'
    },
    fetchImpl: async url => {
      requestedUrl = url;
      return { ok: true, status: 200, json: async () => ({ email: 'sender@gmail.com' }) };
    }
  });

  const status = mailer.getStatus();
  const verification = await mailer.verify();

  assert.equal(status.providerType, 'brevo');
  assert.equal(status.ready, true);
  assert.equal(verification.ok, true);
  assert.equal(requestedUrl, 'https://api.brevo.com/v3/account');
});

test('Brevo API hatasını kullanıcıya anlamlı biçimde döndürür', async () => {
  const mailer = createMailer({
    env: {
      MAIL_ENABLED: 'true',
      MAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'invalid',
      BREVO_FROM_EMAIL: 'sender@gmail.com'
    },
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: 'Key not found' }) }),
    logger: { warn() {} }
  });

  const result = await mailer.sendTestEmail({ to: 'user@example.com' });
  assert.equal(result.sent, false);
  assert.equal(result.status, 'failed');
  assert.equal(result.error, 'Key not found');
});

test('mail şablonu kullanıcı HTML girdisini escape eder', () => {
  const templates = createMailTemplates({ appName: 'FrpOku', baseUrl: 'https://example.com' });
  const message = templates.accountApproved({ fullName: '<img src=x onerror=alert(1)>', username: "a'b" });
  assert.doesNotMatch(message.html, /<img src=x/);
  assert.match(message.html, /&lt;img/);
  assert.match(message.html, /a&#39;b/);
});

test('sendEmailChangeCode 6 haneli doğrulama kodunu şablonda barındırır', async () => {
  let sentMessage = null;
  const mailer = createMailer({
    env: {
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'sender@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'FrpOku <sender@example.com>'
    },
    transporter: {
      sendMail: async message => {
        sentMessage = message;
        return { messageId: 'code-1' };
      }
    }
  });

  const res = await mailer.sendEmailChangeCode({
    to: 'new@example.com',
    code: '987654',
    username: 'ilker'
  });

  assert.equal(res.sent, true);
  assert.equal(sentMessage.to, 'new@example.com');
  assert.match(sentMessage.subject, /987654/);
  assert.match(sentMessage.html, /987654/);
});

test('sendAccountStatusChanged dondurma ve açma durumlarını doğru iletir', async () => {
  let sentMessages = [];
  const mailer = createMailer({
    env: {
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'sender@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'FrpOku <sender@example.com>'
    },
    transporter: {
      sendMail: async message => {
        sentMessages.push(message);
        return { messageId: 'status-' + sentMessages.length };
      }
    }
  });

  await mailer.sendAccountStatusChanged({
    to: 'user@example.com',
    username: 'user1',
    isFrozen: true
  });
  assert.match(sentMessages[0].subject, /donduruldu/i);

  await mailer.sendAccountStatusChanged({
    to: 'user@example.com',
    username: 'user1',
    isFrozen: false
  });
  assert.match(sentMessages[1].subject, /aktif/i);
});

test('sendSecurityAlert şüpheli giriş uyarısı oluşturur', async () => {
  let sentMessage = null;
  const mailer = createMailer({
    env: {
      MAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'sender@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'FrpOku <sender@example.com>'
    },
    transporter: {
      sendMail: async message => {
        sentMessage = message;
        return { messageId: 'sec-1' };
      }
    }
  });

  await mailer.sendSecurityAlert({
    to: 'admin@example.com',
    identifier: 'hacker',
    clientIp: '192.168.1.50',
    attempts: 5
  });

  assert.match(sentMessage.subject, /GÜVENLİK ALARMI/i);
  assert.match(sentMessage.html, /192\.168\.1\.50/);
  assert.match(sentMessage.html, /hacker/);
});

test('mailer kaynak kodu SMTP bağlantısını sınırlı sürede sonlandırır ve Gmail uygulama şifresi boşluklarını temizler', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../lib/mailer.js'), 'utf8');
  assert.match(source, /connectionTimeout:\s*15000/);
  assert.match(source, /greetingTimeout:\s*10000/);
  assert.match(source, /socketTimeout:\s*20000/);
  assert.match(source, /gmail\\\.com\$\/i\.test\(smtpHost\)/);
  assert.match(source, /rawPassword\.replace\(\/\\s\+\/g, ''\)/);
});
