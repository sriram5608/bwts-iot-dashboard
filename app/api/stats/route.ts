import { NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { buildTelemetrySelect } from '@/lib/telemetry-columns'

export async function GET() {
  try {
    const currentMonth = new Date().getMonth() + 1

    const [latestTelemetry, latestHealthRow, recentEvents, monthlyAvgRows] = await Promise.all([
      queryOne(`SELECT ${buildTelemetrySelect()} FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1`),

      queryOne(`SELECT timestamp, "overallScore" AS overall_score, "riskLevel" AS risk_level, month,
        "componentsUvHealth" AS uv_health,
        "componentsPowerEfficiency" AS power_efficiency,
        "componentsLampHealth" AS lamp_health,
        "componentsThermalHealth" AS thermal_health
        FROM bwts_iot_health_scores ORDER BY timestamp DESC LIMIT 1`),

      query<Record<string, unknown>>(
        `SELECT "eventType", description, timestamp
         FROM bwts_iot_events
         WHERE timestamp >= (SELECT MAX(timestamp) - INTERVAL '24 hours' FROM bwts_iot_events)
         ORDER BY timestamp DESC`
      ),

      query(
        `SELECT
          AVG("UVRINTENSITY") AS "avgUVIntensity",
          AVG("UVRPOWEROUTPUT") AS "avgPowerOutput",
          AVG("SYSFLOWRATE") AS "avgFlowRate"
        FROM bwts_iot_telemetry
        WHERE EXTRACT(MONTH FROM timestamp) = $1`,
        [currentMonth]
      )
    ])

    // Map camelCase event columns to snake_case for frontend
    const mappedEvents = recentEvents.map(e => ({
      event_type: e.eventType,
      description: e.description,
      timestamp: e.timestamp,
    }))

    const latestHealth = latestHealthRow ? {
      timestamp: latestHealthRow.timestamp,
      overall_score: latestHealthRow.overall_score,
      risk_level: latestHealthRow.risk_level,
      month: latestHealthRow.month,
      components: {
        uv_health: latestHealthRow.uv_health,
        power_efficiency: latestHealthRow.power_efficiency,
        lamp_health: latestHealthRow.lamp_health,
        thermal_health: latestHealthRow.thermal_health,
      },
    } : null

    return NextResponse.json({
      latestTelemetry,
      latestHealth,
      recentEvents: mappedEvents,
      monthlyAvg: monthlyAvgRows[0] || null
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
