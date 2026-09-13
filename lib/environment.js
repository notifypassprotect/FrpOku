const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isEnabled(value) {
  return TRUE_VALUES.has(String(value || '').toLowerCase());
}

function validateEnvironment(env = process.env) {
  const appEnvironment = env.NODE_ENV || 'development';
  const deployed = appEnvironment === 'production' || appEnvironment === 'staging';
  const missing = [];
  const requireValue = key => {
    if (!String(env[key] || '').trim()) missing.push(key);
  };

  if (deployed) {
    ['SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(requireValue);
  }
  if (appEnvironment === 'staging') {
    ['APP_BASE_URL', 'BOOTSTRAP_ADMIN_USERNAME', 'BOOTSTRAP_ADMIN_PASSWORD', 'BOOTSTRAP_ADMIN_EMAIL'].forEach(requireValue);
    if (isEnabled(env.STAGING_ACCESS_ENABLED)) {
      ['STAGING_ACCESS_USER', 'STAGING_ACCESS_PASSWORD'].forEach(requireValue);
    }
  }
  if (isEnabled(env.ENABLE_BROWSER_SUPABASE)) requireValue('SUPABASE_ANON_KEY');
  if (isEnabled(env.MAIL_ENABLED)) {
    requireValue('APP_BASE_URL');
    const mailProvider = String(env.MAIL_PROVIDER || '').trim().toLowerCase();
    if (mailProvider === 'brevo' || (!mailProvider && env.BREVO_API_KEY)) {
      ['BREVO_API_KEY', 'BREVO_FROM_EMAIL'].forEach(requireValue);
    } else {
      ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].forEach(requireValue);
    }
  }
  if (missing.length) {
    throw new Error(`Eksik zorunlu ortam değişkenleri: ${[...new Set(missing)].join(', ')}`);
  }

  return {
    appEnvironment,
    browserSupabaseEnabled: isEnabled(env.ENABLE_BROWSER_SUPABASE),
    deployed
  };
}

module.exports = { isEnabled, validateEnvironment };
