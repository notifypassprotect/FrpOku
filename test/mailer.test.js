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
