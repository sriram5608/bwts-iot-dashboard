import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export interface AlertInstance {
  id: number
  alert_type: string
  severity: string
  parameter: string
  current_value: number | null
  threshold_value: number | null
  unit: string | null
  deviation_pct: number | null
  detected_at: string
  status: string               // 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
  acknowledged_at: string | null
  resolved_at: string | null
  agent_triggered: boolean
  source: string               // 'DEMO' | 'AUTO'
}

// GET /api/alert-instances
// Query params:
//   ?status=ACTIVE            — filter by status (omit for all)
//   ?since=<ISO timestamp>    — only alerts detected after this time
//   ?agentPending=true        — agent SDK shortcut: ACTIVE + not yet agent_triggered
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const since = searchParams.get('since')
  const agentPending = searchParams.get('agentPending') === 'true'

  try {
    const rows = await query<AlertInstance>(`
      SELECT
        id, alert_type, severity, parameter,
        current_value, threshold_value, unit, deviation_pct,
        detected_at, status,
        acknowledged_at, resolved_at,
        agent_triggered, source
      FROM bwts_alert_instances
      WHERE ($1::text IS NULL OR status = $1)
        AND ($2::timestamptz IS NULL OR detected_at > $2)
        AND (NOT $3 OR (status = 'ACTIVE' AND agent_triggered = false))
      ORDER BY detected_at DESC
      LIMIT 100
    `, [status, since, agentPending])

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching alert instances:', error)
    return NextResponse.json({ error: 'Failed to fetch alert instances' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
