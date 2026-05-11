import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const interval = searchParams.get('interval') || 'day'
    const hours = parseInt(searchParams.get('hours') || '720', 10)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    let startTime: Date
    let endTime: Date

    if (startDateParam && endDateParam) {
      startTime = new Date(startDateParam)
      endTime = new Date(endDateParam)
    } else {
      const latestRow = await queryOne<{ timestamp: Date }>(
        'SELECT timestamp FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1'
      )
      if (!latestRow) return NextResponse.json([])
      endTime = new Date(latestRow.timestamp)
      startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000)
    }

    const pgInterval = interval === 'hour' ? 'hour' : 'day'

    // Build lamp column selects - DB uses LAMP01EFFICIENCY (no underscores)
    const lampCols: string[] = []
    for (let i = 1; i <= 16; i++) {
      const id = String(i).padStart(2, '0')
      lampCols.push(`AVG("LAMP${id}EFFICIENCY") AS "LAMP_${id}_EFFICIENCY"`)
      lampCols.push(`AVG("LAMP${id}POWER") AS "LAMP_${id}_POWER"`)
      lampCols.push(`AVG("LAMP${id}RUNTIME") AS "LAMP_${id}_RUNTIME"`)
    }

    const results = await query(
      `SELECT
        DATE_TRUNC($1, timestamp) AS timestamp,
        AVG("UVRINTENSITY") AS "UVR_INTENSITY",
        AVG("UVRPOWEROUTPUT") AS "UVR_POWER_OUTPUT",
        AVG("UVRWATERTEMP") AS "UVR_WATER_TEMP",
        AVG("SYSFLOWRATE") AS "SYS_FLOW_RATE",
        AVG("SYSPRESSURE") AS "SYS_PRESSURE",
        AVG("AVGLAMPEFFICIENCY") AS "AVG_LAMP_EFFICIENCY",
        AVG("FAILEDLAMPCOUNT") AS "FAILED_LAMP_COUNT",
        ${lampCols.join(',\n        ')},
        COUNT(*) AS "recordCount"
      FROM bwts_iot_telemetry
      WHERE timestamp BETWEEN $2 AND $3
      GROUP BY DATE_TRUNC($1, timestamp)
      ORDER BY timestamp ASC`,
      [pgInterval, startTime, endTime]
    )

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching aggregated telemetry:', error)
    return NextResponse.json({ error: 'Failed to fetch aggregated telemetry data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
