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
