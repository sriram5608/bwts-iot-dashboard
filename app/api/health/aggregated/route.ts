import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const interval = searchParams.get('interval') || 'day'
    const limitParam = searchParams.get('limit')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const pgInterval = interval === 'hour' ? 'hour' : 'day'

    let results

    if (startDateParam && endDateParam) {
      results = await query(
        `SELECT
          DATE_TRUNC($1, timestamp) AS timestamp,
          AVG("overallScore") AS overall_score,
          AVG("componentsUvHealth") AS uv_health,
          AVG("componentsLampHealth") AS lamp_health,
          AVG("componentsPowerEfficiency") AS power_efficiency,
          AVG("componentsThermalHealth") AS thermal_health,
          COUNT(*) AS "recordCount"
        FROM bwts_iot_health_scores
        WHERE timestamp BETWEEN $2 AND $3
        GROUP BY DATE_TRUNC($1, timestamp)
        ORDER BY timestamp ASC`,
        [pgInterval, new Date(startDateParam), new Date(endDateParam)]
      )
    } else {
      const docLimit = parseInt(limitParam || '1500', 10)
      const bucketLimit = parseInt(limitParam || '30', 10)
      results = await query(
        `SELECT
          DATE_TRUNC($1, timestamp) AS timestamp,
          AVG("overallScore") AS overall_score,
          AVG("componentsUvHealth") AS uv_health,
          AVG("componentsLampHealth") AS lamp_health,
          AVG("componentsPowerEfficiency") AS power_efficiency,
          AVG("componentsThermalHealth") AS thermal_health,
          COUNT(*) AS "recordCount"
        FROM (
          SELECT * FROM bwts_iot_health_scores ORDER BY timestamp DESC LIMIT $2
        ) sub
        GROUP BY DATE_TRUNC($1, timestamp)
        ORDER BY timestamp ASC
        LIMIT $3`,
        [pgInterval, docLimit, bucketLimit]
      )
    }

    // Reshape to match expected { timestamp, overall_score, components: {...} } shape
    const shaped = results.map((r: Record<string, unknown>) => ({
      timestamp: r.timestamp,
      overall_score: r.overall_score,
      components: {
        uv_health: r.uv_health,
        lamp_health: r.lamp_health,
        power_efficiency: r.power_efficiency,
        thermal_health: r.thermal_health,
      },
      recordCount: r.recordCount,
    }))

    return NextResponse.json(shaped)
  } catch (error) {
    console.error('Error fetching aggregated health data:', error)
    return NextResponse.json({ error: 'Failed to fetch aggregated health data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
