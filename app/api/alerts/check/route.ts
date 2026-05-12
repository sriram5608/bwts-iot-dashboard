import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { sendAlertEmail } from '@/lib/email'
import { THRESHOLDS } from '@/lib/constants'

const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

async function isAlertsPaused(): Promise<boolean> {
  const row = await queryOne<{ eventType: string }>(
    `SELECT "eventType" FROM bwts_iot_events
     WHERE "eventType" IN ('ALERT_EMAIL_PAUSED', 'ALERT_EMAIL_RESUMED')
     ORDER BY timestamp DESC LIMIT 1`
  )
  return row?.eventType === 'ALERT_EMAIL_PAUSED'
}

// PostgreSQL-backed cooldown — survives serverless cold starts
async function isCoolingDown(): Promise<boolean> {
  const row = await queryOne<{ last_sent: Date }>(
    `SELECT MAX(timestamp) AS last_sent FROM bwts_iot_events
     WHERE "eventType" = 'ALERT_DIGEST_SENT'`
  )
  if (!row?.last_sent) return false
  return Date.now() - new Date(row.last_sent).getTime() < COOLDOWN_MS
}

async function markDigestSent(): Promise<void> {
  await query(
    `INSERT INTO bwts_iot_events (timestamp, "eventType", description, month)
     VALUES (NOW(), 'ALERT_DIGEST_SENT', 'Automated alert digest email sent', EXTRACT(MONTH FROM NOW())::int)`
  )
}

interface TelemetryRow {
  failed_lamp_count: number
  avg_lamp_efficiency: number
  uvr_intensity: number
  timestamp: Date
}

interface HealthRow {
  overall_score: number
  risk_level: string
  timestamp: Date
}

interface PredictionRow {
  component_id: string
  rul_hours: number
  timestamp: Date
}

interface AlertItem {
  severity: 'CRITICAL' | 'WARNING'
  category: string
  description: string
  value: string
  threshold: string
}

export async function GET() {
  if (await isAlertsPaused()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'paused' })
  }
  if (await isCoolingDown()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'cooldown' })
  }

  const alerts: AlertItem[] = []

  try {
    // ── 1. Latest telemetry → lamp failure + compliance ──
    const [telemetry] = await query<TelemetryRow>(
      `SELECT
        "FAILEDLAMPCOUNT"    AS failed_lamp_count,
        "AVGLAMPEFFICIENCY"  AS avg_lamp_efficiency,
        "UVRINTENSITY"       AS uvr_intensity,
        timestamp
      FROM bwts_iot_telemetry
      ORDER BY timestamp DESC LIMIT 1`
    )

    if (telemetry) {
      if (telemetry.failed_lamp_count > 0) {
        alerts.push({
          severity: 'CRITICAL',
          category: 'Lamp Failure',
          description: `${telemetry.failed_lamp_count} UV lamp(s) have failed`,
          value: `${telemetry.failed_lamp_count} failed`,
          threshold: '0 failed',
        })
      }

      if (telemetry.uvr_intensity < THRESHOLDS.UV_INTENSITY.IMO_MIN) {
        alerts.push({
          severity: 'CRITICAL',
          category: 'Compliance — IMO D-2',
          description: 'UV intensity is below IMO D-2 minimum',
          value: `${telemetry.uvr_intensity.toFixed(0)} W/m²`,
          threshold: `${THRESHOLDS.UV_INTENSITY.IMO_MIN} W/m²`,
        })
      } else if (telemetry.uvr_intensity < THRESHOLDS.UV_INTENSITY.USCG_MIN) {
        alerts.push({
          severity: 'WARNING',
          category: 'Compliance — USCG',
          description: 'UV intensity is below USCG operating target',
          value: `${telemetry.uvr_intensity.toFixed(0)} W/m²`,
          threshold: `${THRESHOLDS.UV_INTENSITY.USCG_MIN} W/m²`,
        })
      }
    }

    // ── 2. Latest health score ──
    const [health] = await query<HealthRow>(
      `SELECT "overallScore" AS overall_score, "riskLevel" AS risk_level, timestamp
       FROM bwts_iot_health_scores ORDER BY timestamp DESC LIMIT 1`
    )

    if (health) {
      if (health.overall_score < THRESHOLDS.HEALTH_SCORE.CRITICAL) {
        alerts.push({
          severity: 'CRITICAL',
          category: 'System Health',
          description: 'Overall system health is in the critical zone',
          value: `${health.overall_score.toFixed(0)} / 100`,
          threshold: `${THRESHOLDS.HEALTH_SCORE.CRITICAL} / 100`,
        })
      } else if (health.overall_score < THRESHOLDS.HEALTH_SCORE.WARNING) {
        alerts.push({
          severity: 'WARNING',
          category: 'System Health',
          description: 'Overall system health is in the warning zone',
          value: `${health.overall_score.toFixed(0)} / 100`,
          threshold: `${THRESHOLDS.HEALTH_SCORE.WARNING} / 100`,
        })
      }
    }

    // ── 3. Predictions — remaining useful life ──
    const rulThreshold = parseInt(process.env.ALERT_RUL_THRESHOLD_HOURS ?? '200', 10)
    const predictions = await query<PredictionRow>(
      `SELECT "componentId" AS component_id, "predictionsRemainingUsefulLifeHours" AS rul_hours, timestamp
       FROM bwts_iot_predictions ORDER BY timestamp DESC LIMIT 20`
    )

    for (const pred of predictions) {
      if (pred.rul_hours < rulThreshold) {
        alerts.push({
          severity: pred.rul_hours < rulThreshold / 2 ? 'CRITICAL' : 'WARNING',
          category: 'Predictive Maintenance',
          description: `${pred.component_id} is approaching end of useful life`,
          value: `${pred.rul_hours.toFixed(0)}h remaining`,
          threshold: `${rulThreshold}h`,
        })
      }
    }
  } catch (err) {
    console.error('Alert check failed:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }

  if (alerts.length === 0) {
    return NextResponse.json({ ok: true, fired: false, reason: 'no_alerts', checkedAt: new Date().toISOString() })
  }

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length
  const warningCount = alerts.filter(a => a.severity === 'WARNING').length
  const overallSeverity: 'CRITICAL' | 'WARNING' = criticalCount > 0 ? 'CRITICAL' : 'WARNING'

  const rows = alerts.map(a => {
    const color = a.severity === 'CRITICAL' ? '#dc2626' : '#d97706'
    const bg = a.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb'
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
          <span style="display:inline-block;background:${bg};color:${color};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">${a.severity}</span>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#374151;font-weight:600;font-size:13px;">${a.category}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">${a.description}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:${color};font-weight:700;font-size:13px;white-space:nowrap;">${a.value}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#9ca3af;font-size:12px;white-space:nowrap;">${a.threshold}</td>
      </tr>`
  }).join('')

  const headerColor = overallSeverity === 'CRITICAL' ? '#dc2626' : '#d97706'
  const subject = `${criticalCount} critical, ${warningCount} warning — BWTS system requires attention`

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:${headerColor};padding:22px 28px;">
      <div style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">BWTS Alert Digest</div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:6px;">${alerts.length} Active Alert${alerts.length !== 1 ? 's' : ''} Detected</div>
      <div style="color:#ffffff;opacity:0.75;font-size:13px;margin-top:4px;">${criticalCount} critical · ${warningCount} warning</div>
    </div>
    <div style="padding:24px 28px 8px;">
      <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
        The BWTS monitoring system has detected issues requiring attention. Review the table below and take corrective action.
      </p>
    </div>
    <div style="margin:0 28px 24px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Level</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Category</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Issue</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Current</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Limit</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
      <div style="color:#9ca3af;font-size:11px;">Generated at ${new Date().toISOString()}</div>
      <div style="color:#9ca3af;font-size:11px;margin-top:2px;">BWTS Monitoring Dashboard — automated digest · next digest in 1 hour</div>
    </div>
  </div>
</body></html>`

  try {
    await sendAlertEmail({ subject, severity: overallSeverity, body: '', customHtml: html })
    await markDigestSent()

    // Insert alert instances for agent SDK deduplication
    for (const alert of alerts) {
      await query(
        `INSERT INTO bwts_alert_instances
           (alert_type, severity, parameter, current_value, threshold_value, source, month)
         VALUES ($1, $2, $3, $4, $5, 'AUTO', EXTRACT(MONTH FROM NOW())::int)`,
        [alert.category.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
         alert.severity, alert.category,
         parseFloat(alert.value), parseFloat(alert.threshold)]
      )
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, fired: true, alertCount: alerts.length, checkedAt: new Date().toISOString() })
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
