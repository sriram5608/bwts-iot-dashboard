import { NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { buildTelemetrySelect } from '@/lib/telemetry-columns'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const hours = parseInt(searchParams.get('hours') || '24')

  try {
    const latestRow = await queryOne<{ timestamp: Date }>(
      'SELECT timestamp FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1'
    )
    if (!latestRow) return NextResponse.json([])

    const latestTimestamp = new Date(latestRow.timestamp)
    const startTime = new Date(latestTimestamp.getTime() - hours * 60 * 60 * 1000)

    const selectCols = buildTelemetrySelect()
    const history = await query(
      `SELECT ${selectCols} FROM bwts_iot_telemetry WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp ASC`,
      [startTime, latestTimestamp]
    )
    return NextResponse.json(history)
  } catch (error) {
    console.error('Error fetching telemetry history:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
