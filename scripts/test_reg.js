require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS.replace(/\s+/g, '')
  }
});

async function simulateRegister(cleanName, cleanUser, cleanEmail, password) {
  console.log('Testing register for:', cleanEmail, cleanUser);
  const { data: existingUsers, error: searchErr } = await supabase
    .from('app_users')
    .select('id, username, email')
    .or(`email.ilike.${cleanEmail},username.ilike.${cleanUser}`)
    .limit(2);

  if (searchErr) console.error('Search error:', searchErr);
  console.log('Existing users found:', existingUsers);

  if (existingUsers && existingUsers.length > 0) {
    const matchEmail = existingUsers.some(u => (u.email || '').toLowerCase() === cleanEmail);
    if (matchEmail) return { success: false, reason: 'Email already exists' };
    return { success: false, reason: 'Username already exists: ' + cleanUser };
  }

  const otpCode = '918273';
  const info = await mailTransporter.sendMail({
    from: process.env.SMTP_FROM,
    to: cleanEmail,
    subject: `FrpOku Kayit Dogrulama Kodu: ${otpCode}`,
    text: `Merhaba ${cleanName},\n\nFrpOku hesabınızı oluşturmak için 6 haneli güvenlik kodunuz: ${otpCode}`,
    html: `<h2>Kod: ${otpCode}</h2>`
  });
  return { success: true, messageId: info.messageId, accepted: info.accepted };
}

simulateRegister('İlker Diner', 'ilkeryedek', 'ilkerdineryedek@gmail.com', '123456')
  .then(res => console.log('Simulation Result:', res))
  .catch(err => console.error('Simulation Error:', err));
