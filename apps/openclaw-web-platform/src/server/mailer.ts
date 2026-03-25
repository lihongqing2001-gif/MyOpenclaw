import nodemailer from "nodemailer";
import { loadDatabase } from "./store";

type SmtpRuntimeConfig = {
  provider: "custom" | "qq";
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

function smtpConfig(): SmtpRuntimeConfig | null {
  const saved = loadDatabase().settings.smtp;
  const provider = saved.provider === "custom" ? "custom" : "qq";
  const host = process.env.SMTP_HOST || saved.host || (provider === "qq" ? "smtp.qq.com" : "");
  const port = Number(process.env.SMTP_PORT || saved.port || (provider === "qq" ? "465" : "587"));
  const user = process.env.SMTP_USER || saved.user || "";
  const pass = process.env.SMTP_PASS || saved.pass || "";
  const from = process.env.SMTP_FROM || saved.from || (user ? `SoloCore Hub <${user}>` : "");

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    provider,
    host,
    port,
    user,
    pass,
    from,
  };
}

export function smtpConfigured() {
  return Boolean(smtpConfig());
}

function createTransport(config: SmtpRuntimeConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export async function sendTestEmail(email: string) {
  const config = smtpConfig();
  if (!config) {
    throw new Error("SMTP is not configured");
  }

  const transport = createTransport(config);
  await transport.sendMail({
    from: config.from,
    to: email,
    subject: "SoloCore Hub SMTP test",
    text: "SoloCore Hub SMTP connectivity is working.",
    html: "<p>SoloCore Hub SMTP connectivity is working.</p>",
  });

  return {
    delivered: true,
    mode: "smtp",
  } as const;
}

export async function sendLoginCodeEmail(email: string, code: string) {
  const config = smtpConfig();
  if (!config) {
    return {
      delivered: false,
      mode: "console",
      debugCode: code,
    } as const;
  }

  const transport = createTransport(config);

  await transport.sendMail({
    from: config.from,
    to: email,
    subject: "SoloCore Hub login code",
    text: `Your SoloCore Hub login code is: ${code}`,
    html: `<p>Your SoloCore Hub login code is:</p><p><strong style="font-size: 22px;">${code}</strong></p>`,
  });

  return {
    delivered: true,
    mode: "smtp",
  } as const;
}
