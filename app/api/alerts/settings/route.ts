import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

// Returns current email alert state by looking at the most recent status event
async function getAlertState(): Promise<'active' | 'paused'> {
  const row = await queryOne<{ eventType: string }>(
    `SELECT "eventType" FROM bwts_iot_events
     WHERE "eventType" IN ('ALERT_EMAIL_PAUSED', 'ALERT_EMAIL_RESUMED')
     ORDER BY timestamp DESC LIMIT 1`
  )
  if (!row) return 'active' // default — active if no record
  return row.eventType === 'ALERT_EMAIL_PAUSED' ? 'paused' : 'active'
}

export async function GET() {
  const state = await getAlertState()
  return NextResponse.json({ state })
}

export async function POST() {
  const current = await getAlertState()
  const next = current === 'active' ? 'paused' : 'active'
  const eventType = next === 'paused' ? 'ALERT_EMAIL_PAUSED' : 'ALERT_EMAIL_RESUMED'

  await query(
    `INSERT INTO bwts_iot_events (timestamp, "eventType", description, month)
     VALUES (NOW(), $1, $2, EXTRACT(MONTH FROM NOW())::int)`,
    [eventType, `Email alerts ${next} by user`]
  )

  return NextResponse.json({ state: next })
}

export const dynamic = 'force-dynamic'
