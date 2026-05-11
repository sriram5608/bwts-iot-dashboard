import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build lamp column selects - DB uses LAMP01RUNTIME (no underscores), alias to LAMP_01_RUNTIME for frontend
    const lampCols: string[] = []
    for (let i = 1; i <= 16; i++) {
      const id = String(i).padStart(2, '0')
      lampCols.push(`"LAMP${id}RUNTIME" AS "LAMP_${id}_RUNTIME"`)
      lampCols.push(`"LAMP${id}EFFICIENCY" AS "LAMP_${id}_EFFICIENCY"`)
      lampCols.push(`"LAMP${id}POWER" AS "LAMP_${id}_POWER"`)
    }

    const data = await query(
      `SELECT timestamp, "UVRINTENSITY" AS "UVR_INTENSITY", "UVRPOWEROUTPUT" AS "UVR_POWER_OUTPUT",
        ${lampCols.join(',\n        ')}
      FROM bwts_iot_telemetry
      WHERE ($1::timestamptz IS NULL OR timestamp >= $1)
        AND ($2::timestamptz IS NULL OR timestamp <= $2)
      ORDER BY timestamp ASC LIMIT 10000`,
      [startDate ? new Date(startDate) : null, endDate ? new Date(endDate) : null]
    )

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching runtime analysis data:', error)
    return NextResponse.json({ error: 'Failed to fetch runtime analysis data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
