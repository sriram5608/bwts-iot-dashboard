import { NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'

export async function GET() {
  try {
    const [sample, dateRange, progression, healthSample] = await Promise.all([
      queryOne(
        'SELECT * FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1'
      ),
      queryOne<{ min: Date; max: Date }>(
        'SELECT MIN(timestamp) AS min, MAX(timestamp) AS max FROM bwts_iot_telemetry'
      ),
      query(
        `SELECT timestamp, "LAMP01RUNTIME" AS "LAMP_01_RUNTIME", "LAMP01EFFICIENCY" AS "LAMP_01_EFFICIENCY", "LAMP01POWER" AS "LAMP_01_POWER", "UVRINTENSITY" AS "UVR_INTENSITY"
         FROM bwts_iot_telemetry ORDER BY "LAMP01RUNTIME" ASC LIMIT 10`
      ),
      queryOne(
        'SELECT * FROM bwts_iot_health_scores ORDER BY timestamp DESC LIMIT 1'
      )
    ])

    const s = sample as Record<string, unknown> | null
    const h = healthSample as Record<string, unknown> | null

    return NextResponse.json({
      sample: {
        LAMP_01_STATUS: s?.LAMP01STATUS,
        LAMP_01_POWER: s?.LAMP01POWER,
        LAMP_01_RUNTIME: s?.LAMP01RUNTIME,
        LAMP_01_EFFICIENCY: s?.LAMP01EFFICIENCY,
        UVR_INTENSITY: s?.UVRINTENSITY,
        UVR_POWER_OUTPUT: s?.UVRPOWEROUTPUT,
      },
      dataRange: dateRange,
      runtimeProgression: progression,
      healthStructure: {
        overall_score: h?.overallScore,
        componentsUvHealth: h?.componentsUvHealth,
        componentsPowerEfficiency: h?.componentsPowerEfficiency,
        componentsLampHealth: h?.componentsLampHealth,
        componentsThermalHealth: h?.componentsThermalHealth,
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
