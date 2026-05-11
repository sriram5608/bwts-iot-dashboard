import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')

  try {
    const rows = await query<Record<string, unknown>>(
      'SELECT * FROM bwts_iot_predictions ORDER BY timestamp DESC LIMIT $1',
      [limit]
    )

    // Map flat camelCase DB columns to the nested shape the frontend expects
    const predictions = rows.map(row => ({
      timestamp: row.timestamp,
      component_id: row.componentId,
      component_type: row.componentType,
      predictions: {
        remaining_useful_life_hours: row.predictionsRemainingUsefulLifeHours,
        failure_probability: row.predictionsFailureProbability,
        efficiency_percent: row.predictionsEfficiencyPercent,
      },
      current_state: {
        runtime_hours: row.currentStateRuntimeHours,
        efficiency_percent: row.currentStateEfficiencyPercent,
        status: row.currentStateStatus,
      },
    }))

    return NextResponse.json(predictions)
  } catch (error) {
    console.error('Error fetching predictions:', error)
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
