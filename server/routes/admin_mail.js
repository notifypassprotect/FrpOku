function registerAdminMailRoutes(app, deps) {
  const { adminRateLimiter, getLocalUsers, isValidEmail, mailer, readLocalReports, recordAuditLog, requireAdmin, supabase } = deps;

  app.post('/api/admin/mail/send-digest', adminRateLimiter, requireAdmin, async (req, res) => {
    const requestedEmail = String(req.body?.email || '').trim().toLowerCase();
    const email = requestedEmail && isValidEmail(requestedEmail) ? requestedEmail
      : req.adminUser?.email || process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.SMTP_USER;
    if (!email) return res.status(400).json({ success: false, reason: 'Yönetici e-posta adresi bulunamadı.' });
    try {
      let users, reports;
      if (supabase) {
        const [userResult, reportResult] = await Promise.all([
          supabase.from('app_users').select('id, is_active, role'),
          supabase.from('reports').select('id, is_public')
        ]);
        if (userResult.error) throw userResult.error;
        if (reportResult.error) throw reportResult.error;
        users = userResult.data || [];
        reports = reportResult.data || [];
      } else {
        users = getLocalUsers();
        reports = readLocalReports();
      }
      const result = await mailer.sendSystemDigest({
        to: email,
        stats: {
          totalUsers: users.length,
          pendingUsers: users.filter(user => user.is_active === false && !user.is_frozen).length,
          frozenUsers: users.filter(user => user.is_frozen === true).length,
          totalReports: reports.length,
          poolReports: reports.filter(report => report.is_public || report.in_pool || report.data?.isPublic).length
        }
      });
      await recordAuditLog({
        userId: req.adminUser.id, username: req.adminUser.username, role: 'admin',
        action: result.sent ? 'MAIL_DIGEST_SENT' : 'MAIL_DIGEST_FAILED', target: email,
        details: `Sistem durum özeti: ${result.status}${result.error ? ` (${result.error})` : ''}`, ip: req.ip
      });
      const reason = result.error || result.reason || 'E-posta gönderilemedi (SMTP kapalı veya hatalı).';
      res.status(result.sent ? 200 : 503).json({
        success: result.sent, status: result.status,
        message: result.sent ? 'Sistem özeti e-posta adresinize gönderildi.' : reason,
        reason: result.sent ? undefined : reason
      });
    } catch (error) {
      res.status(503).json({ success: false, reason: error.message });
    }
  });
}

module.exports = { registerAdminMailRoutes };
