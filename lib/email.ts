import nodemailer from "nodemailer";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendMailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
  mode: "smtp" | "console";
}

function getAppUrl(): string {
  const url = process.env.APP_URL?.trim() || "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function getPublicAppUrl(): string {
  return getAppUrl();
}

function hasSmtpConfig(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.EMAIL_FROM?.trim(),
  );
}

/**
 * Abstraction for transactional email (guest invites, Phase 8.3 notifications).
 * Uses Nodemailer SMTP when configured; otherwise logs in development.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const from = process.env.EMAIL_FROM?.trim() || "FinVault <noreply@localhost>";

  if (!hasSmtpConfig()) {
    if (process.env.NODE_ENV === "development") {
      console.info("[email:console]", {
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    }
    return {
      sent: false,
      mode: "console",
      error: "SMTP is not configured",
    };
  }

  try {
    const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });

    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    return {
      sent: true,
      mode: "smtp",
      messageId: info.messageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    console.error("[email:smtp-error]", message);
    return {
      sent: false,
      mode: "smtp",
      error: message,
    };
  }
}
