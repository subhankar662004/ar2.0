const BREVO_API_KEY = process.env.BREVO_API_KEY;
const fromEmail = process.env.EMAIL_FROM;

if (!BREVO_API_KEY) {
  console.error("[MAILER] Missing BREVO_API_KEY");
}

if (!fromEmail) {
  console.error("[MAILER] Missing EMAIL_FROM");
}

console.log(`[MAILER] Brevo API loaded | API key set: ${!!BREVO_API_KEY}`);

export const sendOTPEmail = async (email, otp, name = "User") => {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Academic Resources Hub",
          email: fromEmail,
        },
        to: [
          {
            email: email,
            name: name,
          },
        ],
        subject: "Your OTP Verification Code",
        textContent: `Hi ${name}, your OTP is ${otp}. It expires in 10 minutes.`,
        htmlContent: `
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
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[OTP EMAIL FAILED]", data);
      throw new Error(data.message || "Failed to send OTP email");
    }

    console.log("[OTP EMAIL SENT]", data);
    return data;

  } catch (error) {
    console.error("Send OTP error:", error.message);
    throw error;
  }
};

export default sendOTPEmail;