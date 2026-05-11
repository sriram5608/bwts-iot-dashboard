import { NextRequest, NextResponse } from 'next/server'
import { queueAnomaly, setOperationType, type AnomalyType } from '@/lib/simulation/bwts-simulator'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, type, operationType } = body

    if (action === 'anomaly' && type) {
      queueAnomaly(type as AnomalyType)
      return NextResponse.json({ ok: true })
    }

    if (action === 'setOperation' && operationType) {
      setOperationType(operationType)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
