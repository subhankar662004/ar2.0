import nodemailer from 'nodemailer';

const user = process.env.SMTP_USER || process.env.EMAIL_USER;
const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s/g, '');

console.log(`[MAILER] Gmail SMTP: ${user} | Pass length: ${pass.length}`);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass },
});

transporter.verify((err) => {
  if (err) console.error('[MAILER] SMTP failed:', err.message);
  else console.log('[MAILER] SMTP ready ✅');
});

export const sendOTPEmail = async (email, otp, name) => {
  await transporter.sendMail({
    from: `"Academic Resources Hub" <${user}>`,
    to: email,
    subject: 'Your OTP Verification Code',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="color:#2563eb;margin:8px 0 0;">Academic Resources Hub</h2>
        </div>
        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151;">Use the OTP below to verify your email. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#eff6ff;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
          <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#2563eb;">${otp}</div>
        </div>
        <p style="color:#9ca3af;font-size:13px;">If you didn't request this, ignore this email.</p>
      </div>
    `
  });
};

export default transporter;
