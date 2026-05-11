import { NextRequest, NextResponse } from 'next/server'
import { sendAlertEmail } from '@/lib/email'

// Per-alert-type cooldown so rapid demo triggers don't spam
const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes in demo mode
const lastSent = new Map<string, number>()

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    type: string
    severity: 'CRITICAL' | 'WARNING' | 'INFO'
    parameter: string
    currentValue: number
    threshold: number
    unit: string
    recommendedAction: string
  }

  if (!body.type || !body.severity) {
    return NextResponse.json({ ok: false, error: 'Missing type or severity' }, { status: 400 })
  }

  const last = lastSent.get(body.type) ?? 0
  if (Date.now() - last < COOLDOWN_MS) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'cooldown' })
  }

  const severityColor = body.severity === 'CRITICAL' ? '#dc2626' : '#d97706'
  const severityBg = body.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb'
  const deviation = body.threshold > 0
    ? ((body.currentValue - body.threshold) / body.threshold * 100).toFixed(1)
    : '—'

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:${severityColor};padding:20px 28px;">
      <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">BWTS Live Demo · Alert Triggered</div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:6px;">${body.parameter}</div>
    </div>
    <div style="padding:20px 28px 0;">
      <span style="display:inline-block;background:${severityBg};color:${severityColor};border:1px solid ${severityColor}33;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${body.severity}</span>
      <span style="margin-left:10px;font-size:12px;color:#6b7280;">Simulated anomaly — demo mode</span>
    </div>
    <div style="margin:20px 28px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f9fafb;">
          <td style="padding:8px 14px;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb;">Parameter</td>
          <td style="padding:8px 14px;font-weight:600;color:#111827;font-size:13px;border-bottom:1px solid #e5e7eb;">${body.parameter}</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb;">Current Value</td>
          <td style="padding:8px 14px;font-weight:700;color:${severityColor};font-size:13px;border-bottom:1px solid #e5e7eb;">${typeof body.currentValue === 'number' ? body.currentValue.toFixed(1) : body.currentValue} ${body.unit}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:8px 14px;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb;">Threshold</td>
          <td style="padding:8px 14px;font-weight:600;color:#111827;font-size:13px;border-bottom:1px solid #e5e7eb;">${body.threshold} ${body.unit}</td>
        </tr>
        <tr>
          <td style="padding:8px 14px;color:#6b7280;font-size:12px;">Deviation</td>
          <td style="padding:8px 14px;font-weight:600;color:${severityColor};font-size:13px;">${deviation}%</td>
        </tr>
      </table>
    </div>
    <div style="padding:0 28px 20px;color:#374151;font-size:13px;line-height:1.6;background:#fffbeb;margin:0 28px 24px;border-radius:8px;border:1px solid #fde68a;padding:14px;">
      <strong style="color:#92400e;">Recommended Action:</strong><br>${body.recommendedAction}
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
      <div style="color:#9ca3af;font-size:11px;">Triggered at ${new Date().toISOString()}</div>
      <div style="color:#9ca3af;font-size:11px;margin-top:2px;">BWTS Monitoring Dashboard — live demo alert</div>
    </div>
  </div>
</body></html>`

  try {
    await sendAlertEmail({
      subject: `Demo Alert — ${body.parameter}`,
      severity: body.severity === 'INFO' ? 'INFO' : body.severity,
      body: '',
      customHtml: html,
    })
    lastSent.set(body.type, Date.now())
    return NextResponse.json({ ok: true, sent: true })
  } catch (e) {
    console.error('Demo alert email failed:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
