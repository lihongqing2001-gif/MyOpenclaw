import nodemailer from "nodemailer";

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM,
  );
}

export async function sendLoginCodeEmail(email: string, code: string) {
  if (!smtpConfigured()) {
    return {
      delivered: false,
      mode: "console",
      debugCode: code,
    } as const;
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "OpenClaw login code",
    text: `Your OpenClaw login code is: ${code}`,
    html: `<p>Your OpenClaw login code is:</p><p><strong style="font-size: 22px;">${code}</strong></p>`,
  });

  return {
    delivered: true,
    mode: "smtp",
  } as const;
}
