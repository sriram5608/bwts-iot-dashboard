import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { buildTelemetrySelect } from '@/lib/telemetry-columns'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const limit = parseInt(searchParams.get('limit') || '500', 10)

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const selectCols = buildTelemetrySelect()
    const [countRow, data] = await Promise.all([
      queryOne<{ total: string }>(
        'SELECT COUNT(*) AS total FROM bwts_iot_telemetry WHERE timestamp BETWEEN $1 AND $2',
        [new Date(startDate), new Date(endDate)]
      ),
      query(
        `SELECT ${selectCols} FROM bwts_iot_telemetry WHERE timestamp BETWEEN $1 AND $2 ORDER BY timestamp ASC LIMIT $3 OFFSET $4`,
        [new Date(startDate), new Date(endDate), limit, offset]
      )
    ])

    const total = parseInt(countRow?.total || '0', 10)
    return NextResponse.json({
      data,
      pagination: { offset, limit, total, hasMore: offset + limit < total }
    })
  } catch (error) {
    console.error('Error fetching chunked telemetry:', error)
    return NextResponse.json({ error: 'Failed to fetch chunked telemetry data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
