import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'

// PATCH /api/alert-instances/[id]
// Body: { status: 'ACKNOWLEDGED' | 'RESOLVED' }
//   or  { agentTriggered: true }   — called by agent SDK when it picks up an alert
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json() as {
    status?: 'ACKNOWLEDGED' | 'RESOLVED'
    agentTriggered?: boolean
  }

  try {
    if (body.agentTriggered) {
      const row = await queryOne<{ id: number }>(
        `UPDATE bwts_alert_instances
         SET agent_triggered = true
         WHERE id = $1 AND status = 'ACTIVE'
         RETURNING id`,
        [id]
      )
      if (!row) return NextResponse.json({ error: 'Not found or not active' }, { status: 404 })
      return NextResponse.json({ ok: true, id })
    }

    if (body.status === 'ACKNOWLEDGED') {
      const row = await queryOne<{ id: number }>(
        `UPDATE bwts_alert_instances
         SET status = 'ACKNOWLEDGED', acknowledged_at = NOW()
         WHERE id = $1 AND status = 'ACTIVE'
         RETURNING id`,
        [id]
      )
      if (!row) return NextResponse.json({ error: 'Not found or not active' }, { status: 404 })
      return NextResponse.json({ ok: true, id, status: 'ACKNOWLEDGED' })
    }

    if (body.status === 'RESOLVED') {
      const row = await queryOne<{ id: number }>(
        `UPDATE bwts_alert_instances
         SET status = 'RESOLVED',
             resolved_at = NOW(),
             acknowledged_at = COALESCE(acknowledged_at, NOW())
         WHERE id = $1 AND status != 'RESOLVED'
         RETURNING id`,
        [id]
      )
      if (!row) return NextResponse.json({ error: 'Not found or already resolved' }, { status: 404 })
      return NextResponse.json({ ok: true, id, status: 'RESOLVED' })
    }

    return NextResponse.json({ error: 'Invalid body — provide status or agentTriggered' }, { status: 400 })
  } catch (error) {
    console.error('Error updating alert instance:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
