import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ALERT_FROM_EMAIL,
        pass: process.env.ALERT_FROM_PASSWORD,
      },
    })
  }
  return transporter
}

export interface AlertEmailPayload {
  subject: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  body: string
  details?: Record<string, string | number>
  timestamp?: Date
  /** If provided, overrides the generated HTML template entirely. */
  customHtml?: string
}

export async function sendAlertEmail(payload: AlertEmailPayload): Promise<void> {
  const from = process.env.ALERT_FROM_EMAIL
  const to = process.env.ALERT_TO_EMAIL

  if (!from || !process.env.ALERT_FROM_PASSWORD || !to) {
    throw new Error('Email alert env vars not set (ALERT_FROM_EMAIL, ALERT_FROM_PASSWORD, ALERT_TO_EMAIL)')
  }

  const ts = (payload.timestamp ?? new Date()).toISOString()
  const severityColor = payload.severity === 'CRITICAL' ? '#dc2626' : payload.severity === 'WARNING' ? '#d97706' : '#2563eb'
  const severityBg = payload.severity === 'CRITICAL' ? '#fef2f2' : payload.severity === 'WARNING' ? '#fffbeb' : '#eff6ff'

  const detailsRows = payload.details
    ? Object.entries(payload.details)
        .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;">${k}</td><td style="padding:6px 12px;font-weight:600;color:#111827;font-size:13px;">${v}</td></tr>`)
        .join('')
    : ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:${severityColor};padding:20px 28px;">
      <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">BWTS Alert System</div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:6px;">${payload.subject}</div>
    </div>
    <div style="padding:20px 28px 0;">
      <span style="display:inline-block;background:${severityBg};color:${severityColor};border:1px solid ${severityColor}33;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${payload.severity}</span>
    </div>
    <div style="padding:16px 28px 20px;color:#374151;font-size:14px;line-height:1.6;">${payload.body}</div>
    ${detailsRows ? `<div style="margin:0 28px 24px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;"><table style="width:100%;border-collapse:collapse;">${detailsRows}</table></div>` : ''}
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
      <div style="color:#9ca3af;font-size:11px;">Triggered at ${ts}</div>
      <div style="color:#9ca3af;font-size:11px;margin-top:2px;">BWTS Monitoring Dashboard — automated alert</div>
    </div>
  </div>
</body></html>`

  // ALERT_TO_EMAIL supports comma-separated addresses: "a@x.com, b@y.com"
  const recipients = to.split(',').map(e => e.trim()).filter(Boolean)

  await getTransporter().sendMail({
    from: `BWTS Alert System <${from}>`,
    to: recipients,
    subject: `[BWTS ${payload.severity}] ${payload.subject}`,
    html: payload.customHtml ?? html,
  })
}
