import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export interface MaintenanceTask {
  id: number
  component_id: string
  component_type: string
  maintenance_type: string
  description: string
  completed_date: string        // when the job was last done
  due_date: string | null       // when this occurrence was originally scheduled
  next_due_date: string         // when the next job is due
  status: string                // 'COMPLETED' for historical records
  findings: string | null       // observations recorded during the job
  days_until: number            // negative = overdue
}

export async function GET() {
  try {
    // Get the latest completion record per (maintenance_type, component_id)
    // then filter to a useful display window: all overdue + up to 120 days ahead
    const rows = await query<MaintenanceTask>(`
      SELECT * FROM (
        SELECT DISTINCT ON (maintenance_type, component_id)
          id,
          component_id,
          component_type,
          maintenance_type,
          description,
          completed_date::date::text   AS completed_date,
          due_date::text               AS due_date,
          next_due_date::date::text    AS next_due_date,
          COALESCE(status, 'COMPLETED') AS status,
          findings,
          (next_due_date::date - CURRENT_DATE)::int AS days_until
        FROM bwts_maintenance_log
        WHERE next_due_date IS NOT NULL
        ORDER BY maintenance_type, component_id, completed_date DESC NULLS LAST
      ) latest
      WHERE next_due_date::date <= (CURRENT_DATE + INTERVAL '120 days')
      ORDER BY next_due_date ASC
      LIMIT 20
    `)

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching upcoming maintenance:', error)
    return NextResponse.json({ error: 'Failed to fetch maintenance data' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
