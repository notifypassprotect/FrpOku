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

async function testFlow() {
  const ident = '1ilkerdiner@gmail.com';
  let query = supabase.from('app_users').select('id, username, email, full_name');
  if (ident.includes('@')) {
    query = query.ilike('email', ident);
  } else {
    query = query.or(`username.ilike.${ident},email.ilike.${ident}`);
  }

  const { data: users, error } = await query.limit(1);
  console.log('Query result:', users, 'Error:', error);

  if (users && users.length > 0) {
    const user = users[0];
    const otpCode = '749215';
    console.log('Sending to email:', user.email);
    const info = await mailTransporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: `FrpOku Sifre Sifirlama Kodu: ${otpCode}`,
      text: `FrpOku Sifre Sifirlama Guvenlik Kodunuz: ${otpCode}. Bu kod 10 dakika gecerlidir.`,
      html: `
        <div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#fff;border-radius:12px;text-align:center;">
          <h2 style="color:#60a5fa;">FrpOku Sifre Sifirlama</h2>
          <p>Guvenlik Kodunuz:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#38bdf8;padding:12px;background:#1e293b;border-radius:8px;display:inline-block;">${otpCode}</div>
          <p style="font-size:12px;color:#94a3b8;margin-top:16px;">Bu kod 10 dakika boyunca gecerlidir.</p>
        </div>
      `
    });
    console.log('Mail sent successfully, messageId:', info.messageId, 'Accepted:', info.accepted);
  }
}
testFlow().catch(console.error);
