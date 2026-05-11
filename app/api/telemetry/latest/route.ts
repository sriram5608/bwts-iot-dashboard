import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { buildTelemetrySelect } from '@/lib/telemetry-columns'

export async function GET() {
  try {
    const latest = await queryOne(
      `SELECT ${buildTelemetrySelect()} FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1`
    )
    return NextResponse.json(latest)
  } catch (error) {
    console.error('Error fetching latest telemetry:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
