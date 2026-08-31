const nodemailer = require('nodemailer');

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function createMailTemplates({ appName = 'FrpOku', baseUrl = '' } = {}) {
  const loginUrl = String(baseUrl || '').replace(/\/$/, '') || '#';

  return {
    accountApproved(data = {}) {
      const fullName = escapeHtml(data.fullName || data.username || 'Kullanıcı');
      const username = escapeHtml(data.username || '');
      return {
        subject: `${appName} hesabınız onaylandı`,
        text: `Merhaba ${data.fullName || data.username || 'Kullanıcı'},\n\n${appName} hesabınız onaylandı ve kullanıma açıldı.${data.username ? `\nKullanıcı adınız: ${data.username}` : ''}\n\nGiriş: ${loginUrl}\n\nBu işlemi beklemiyorsanız sistem yöneticinizle iletişime geçin.`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      <div style="background:#2563eb;color:#ffffff;padding:24px 28px;font-size:22px;font-weight:700;">${escapeHtml(appName)}</div>
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:21px;margin:0 0 16px;">Hesabınız onaylandı</h1>
        <p>Merhaba <strong>${fullName}</strong>,</p>
        <p>${escapeHtml(appName)} hesabınız sistem yöneticisi tarafından onaylandı ve kullanıma açıldı.</p>
        ${username ? `<p style="background:#f8fafc;border-radius:10px;padding:12px 14px;">Kullanıcı adınız: <strong>${username}</strong></p>` : ''}
        <p style="margin:24px 0;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:700;">Sisteme Giriş Yap</a></p>
        <p style="font-size:13px;color:#64748b;">Bu işlemi beklemiyorsanız sistem yöneticinizle iletişime geçin.</p>
      </div>
    </div>
  </div>
</body></html>`
      };
    },

    test(data = {}) {
      return {
        subject: `${appName} e-posta testi`,
        text: `${appName} SMTP yapılandırması çalışıyor. Zaman: ${data.timestamp || new Date().toISOString()}`,
        html: `<p><strong>${escapeHtml(appName)}</strong> SMTP yapılandırması çalışıyor.</p><p>${escapeHtml(data.timestamp || new Date().toISOString())}</p>`
      };
    }
  };
}

function createMailer({ env = process.env, transporter = null, logger = console } = {}) {
  const enabled = isTruthy(env.MAIL_ENABLED);
  const port = Number(env.SMTP_PORT || 465);
  const secure = env.SMTP_SECURE === undefined ? port === 465 : isTruthy(env.SMTP_SECURE);
  const from = env.SMTP_FROM || env.SMTP_USER || '';
  const templates = createMailTemplates({
    appName: env.MAIL_APP_NAME || 'FrpOku',
    baseUrl: env.APP_BASE_URL || ''
  });
  let activeTransporter = transporter;

  function getStatus() {
    const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && from);
    return {
      enabled,
      configured,
      provider: env.SMTP_HOST || null,
      from: from || null
    };
  }

  function getTransporter() {
    if (activeTransporter) return activeTransporter;
    activeTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
    return activeTransporter;
  }

  async function sendTemplate(templateName, { to, data = {} } = {}) {
    const status = getStatus();
    if (!enabled) return { sent: false, status: 'disabled' };
    if (!status.configured) return { sent: false, status: 'not_configured' };
    if (!to) return { sent: false, status: 'missing_recipient' };
    if (!templates[templateName]) return { sent: false, status: 'unknown_template' };

    try {
      const message = templates[templateName](data);
      const info = await getTransporter().sendMail({
        from,
        to: cleanHeader(to),
        subject: cleanHeader(message.subject),
        text: message.text,
        html: message.html
      });
      return { sent: true, status: 'sent', messageId: info.messageId || null };
    } catch (error) {
      logger.warn('E-posta gönderilemedi:', error.message);
      return { sent: false, status: 'failed' };
    }
  }

  async function verify() {
    const status = getStatus();
    if (!enabled) return { ok: false, status: 'disabled' };
    if (!status.configured) return { ok: false, status: 'not_configured' };
    try {
      await getTransporter().verify();
      return { ok: true, status: 'ready' };
    } catch (error) {
      logger.warn('SMTP doğrulaması başarısız:', error.message);
      return { ok: false, status: 'failed' };
    }
  }

  return {
    getStatus,
    verify,
    sendAccountApproved: ({ to, fullName, username } = {}) => sendTemplate('accountApproved', { to, data: { fullName, username } }),
    sendTestEmail: ({ to } = {}) => sendTemplate('test', { to, data: { timestamp: new Date().toISOString() } })
  };
}

module.exports = {
  createMailer,
  createMailTemplates,
  escapeHtml
};
