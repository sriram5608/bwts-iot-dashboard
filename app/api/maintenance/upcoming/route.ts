import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Reference date matches the fill data context (2026-05-12)
const REF_DATE = '2026-05-12'

export interface MaintenanceTask {
  maintenance_type: string
  component_type: string
  next_due_date: string
  components: string       // comma-separated component IDs
  days_until: number       // negative = overdue
}

export async function GET() {
  try {
    const rows = await query<MaintenanceTask>(`
      SELECT
        maintenance_type,
        component_type,
        next_due_date::date::text AS next_due_date,
        STRING_AGG(component_id, ', ' ORDER BY component_id) AS components,
        (next_due_date::date - $1::date)::int AS days_until
      FROM bwts_maintenance_log
      WHERE next_due_date IS NOT NULL
        AND next_due_date >= ($1::date - INTERVAL '30 days')
        AND next_due_date <= ($1::date + INTERVAL '120 days')
      GROUP BY maintenance_type, component_type, next_due_date
      ORDER BY next_due_date ASC
      LIMIT 10
    `, [REF_DATE])

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching upcoming maintenance:', error)
    return NextResponse.json({ error: 'Failed to fetch maintenance data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
