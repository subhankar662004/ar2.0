import nodemailer from 'nodemailer';

const user = process.env.BREVO_SMTP_USER;
const pass = process.env.BREVO_SMTP_KEY;
const fromEmail = process.env.EMAIL_FROM;

console.log(`[MAILER] Brevo SMTP: ${user} | Key set: ${!!pass}`);

if (!user || !pass) {
  console.error('[MAILER] Missing BREVO_SMTP_USER or BREVO_SMTP_KEY');
}

if (!fromEmail) {
  console.error('[MAILER] Missing EMAIL_FROM');
}

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user,
    pass,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

transporter.verify((err) => {
  if (err) {
    console.error('[MAILER] SMTP failed:', err.message);
  } else {
    console.log('[MAILER] SMTP ready ✅');
  }
});

export const sendOTPEmail = async (email, otp, name = 'User') => {
  const info = await transporter.sendMail({
    from: `"Academic Resources Hub" <${fromEmail}>`,
    to: email,
    subject: 'Your OTP Verification Code',
    text: `Hi ${name}, your OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="color:#2563eb;margin:8px 0 0;">Academic Resources Hub</h2>
        </div>

        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>

        <p style="color:#374151;">
          Use the OTP below to verify your email. It expires in <strong>10 minutes</strong>.
        </p>

        <div style="background:#eff6ff;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
          <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#2563eb;">
            ${otp}
          </div>
        </div>

        <p style="color:#9ca3af;font-size:13px;">
          If you didn't request this, ignore this email.
        </p>
      </div>
    `,
  });

  console.log('[OTP MAIL INFO]', {
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  });

  return info;
};

export default transporter;