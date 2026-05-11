import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')

  try {
    const healthScores = await query(
      `SELECT id, timestamp, "overallScore" AS overall_score, "riskLevel" AS risk_level, month,
        "componentsUvHealth", "componentsPowerEfficiency", "componentsLampHealth", "componentsThermalHealth"
      FROM bwts_iot_health_scores ORDER BY timestamp DESC LIMIT $1`,
      [limit]
    )
    return NextResponse.json(healthScores)
  } catch (error) {
    console.error('Error fetching health scores:', error)
    return NextResponse.json({ error: 'Failed to fetch health scores' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
