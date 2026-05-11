import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const type = searchParams.get('type') || null

  try {
    const rows = type
      ? await query<Record<string, unknown>>(
          'SELECT * FROM bwts_iot_events WHERE "eventType" = $1 ORDER BY timestamp DESC LIMIT $2',
          [type, limit]
        )
      : await query<Record<string, unknown>>(
          'SELECT * FROM bwts_iot_events ORDER BY timestamp DESC LIMIT $1',
          [limit]
        )

    // Map camelCase DB columns to snake_case expected by frontend
    const events = rows.map(row => ({
      timestamp: row.timestamp,
      event_type: row.eventType,
      description: row.description,
      data: {
        operation_type: row.dataOperationType,
        location: row.dataLocation,
        target_flow: row.dataTargetFlow,
      },
    }))

    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
