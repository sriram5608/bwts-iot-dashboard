import { NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'

export async function GET() {
  try {
    const [oldest, newest, countRow, latest, highRisk] = await Promise.all([
      queryOne<{ timestamp: Date }>(
        'SELECT timestamp FROM bwts_iot_telemetry ORDER BY timestamp ASC LIMIT 1'
      ),
      queryOne<{ timestamp: Date }>(
        'SELECT timestamp FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1'
      ),
      queryOne<{ count: string }>(
        'SELECT COUNT(*) AS count FROM bwts_iot_telemetry'
      ),
      queryOne(
        'SELECT * FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1'
      ),
      query(
        `SELECT * FROM bwts_iot_predictions
         WHERE "predictionsFailureProbability" >= 0.7
         ORDER BY timestamp DESC`
      )
    ])

    const l = latest as Record<string, unknown> | null
    const failedLamps: { lamp: number; runtime: unknown; efficiency: unknown }[] = []
    if (l) {
      for (let i = 1; i <= 16; i++) {
        const lampId = String(i).padStart(2, '0')
        if (l[`LAMP${lampId}STATUS`] === 'FAILED') {
          failedLamps.push({
            lamp: i,
            runtime: l[`LAMP${lampId}RUNTIME`],
            efficiency: l[`LAMP${lampId}EFFICIENCY`],
          })
        }
      }
    }

    const predictedFailures = highRisk.map((pred: Record<string, unknown>) => {
      return {
        component: pred.componentId,
        timestamp: pred.timestamp,
        failureProb: pred.predictionsFailureProbability,
        runtime: pred.currentStateRuntimeHours,
      }
    })

    return NextResponse.json({
      telemetry: {
        start: oldest?.timestamp,
        end: newest?.timestamp,
        count: parseInt(countRow?.count || '0', 10),
      },
      latest: {
        failedLampCount: l?.FAILEDLAMPCOUNT || 0,
        failedLamps,
      },
      predictions: { highRisk: predictedFailures }
    })
  } catch {
    return NextResponse.json({ error: 'Failed to check data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
