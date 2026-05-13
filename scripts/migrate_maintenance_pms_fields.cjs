'use strict';
/**
 * migrate_maintenance_pms_fields.cjs
 *
 * Adds proper PMS fields to bwts_maintenance_log:
 *   completed_date  — explicit job completion date (copied from timestamp)
 *   due_date        — when the job was originally scheduled (null for historical records)
 *   findings        — observations recorded during the job
 *   status          — COMPLETED for all existing rows
 *
 * Also fixes next_due_date:
 *   - Clears stale next_due_date on ALL non-latest rows (they're historical records)
 *   - Recalculates next_due_date on the latest row per (maintenance_type, component_id)
 *     using Alfa Laval PureBallast 3.1 service intervals from the manual
 *   - LAMP_REPLACEMENT is skipped — usage-based (3000h), dates already set correctly
 */

const fs = require('fs');
const path = require('path');

// Load .env
const envLines = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n');
for (const line of envLines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const idx = t.indexOf('=');
  if (idx < 0) continue;
  const key = t.slice(0, idx).trim();
  let val = t.slice(idx + 1).trim();
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"')))
    val = val.slice(1, -1);
  process.env[key] = val;
}

const { Pool } = require('pg');
const { Connector, AuthTypes } = require('@google-cloud/cloud-sql-connector');

// ── Service intervals from Alfa Laval PureBallast 3.1 manual ──────────────
// Returns interval in days, or null to skip (LAMP_REPLACEMENT = usage-based)
function getIntervalDays(maintenanceType, componentId) {
  if (maintenanceType === 'LAMP_REPLACEMENT') return null; // usage-based, skip
  const MAP = {
    'CIP_CYCLE':              30,   // Monthly
    'MONTHLY_TESTRUN':        30,   // Monthly
    'VALVE_OPERATION':        30,   // Monthly (anti-seizure check)
    'CIP_PH_CHECK':           90,   // Every 3 months
    'FILTER_INSPECTION':     365,   // Annual (more frequent in muddy-water ports)
    'ANNUAL_INSPECTION':     365,   // Annual
    'CIP_LIQUID_REPLACEMENT': 365,  // Annual (or when pH > 3)
    'SENSOR_REPLACEMENT':    365,   // Annual (USCG requirement for QT201-50)
    'SENSOR_CALIBRATION':    365,   // Annual (conservative; manual says 1–2 years)
  };
  // Flow meter calibration is a 2-year requirement per manual
  if (maintenanceType === 'SENSOR_CALIBRATION' && componentId === 'FLOW-METER') return 730;
  return MAP[maintenanceType] ?? null;
}

async function main() {
  const sa = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  const connector = new Connector({ authType: AuthTypes.SERVICE_ACCOUNT, serviceAccountKey: sa });
  const clientOpts = await connector.getOptions({
    instanceConnectionName: process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME,
  });
  const pool = new Pool({
    ...clientOpts,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  // ── STEP 1: Add new columns (idempotent) ─────────────────────────────────
  console.log('\n── STEP 1: Adding PMS columns...');
  await pool.query(`
    ALTER TABLE bwts_maintenance_log
      ADD COLUMN IF NOT EXISTS completed_date  timestamptz,
      ADD COLUMN IF NOT EXISTS due_date        date,
      ADD COLUMN IF NOT EXISTS findings        text,
      ADD COLUMN IF NOT EXISTS status          text DEFAULT 'COMPLETED'
  `);
  console.log('  ✓ Columns added (or already exist)');

  // ── STEP 2: Backfill completed_date from timestamp ───────────────────────
  console.log('\n── STEP 2: Backfilling completed_date from timestamp...');
  const r2 = await pool.query(`
    UPDATE bwts_maintenance_log
    SET completed_date = timestamp
    WHERE completed_date IS NULL
  `);
  console.log(`  ✓ ${r2.rowCount} rows updated`);

  // ── STEP 3: Set status = COMPLETED on all existing rows ──────────────────
  console.log('\n── STEP 3: Setting status = COMPLETED on all rows...');
  const r3 = await pool.query(`
    UPDATE bwts_maintenance_log SET status = 'COMPLETED' WHERE status IS NULL OR status != 'COMPLETED'
  `);
  console.log(`  ✓ ${r3.rowCount} rows updated`);

  // ── STEP 4: Clear next_due_date on all non-latest rows ───────────────────
  // Latest = highest completed_date per (maintenance_type, component_id)
  // Historical rows should not carry next_due_date — only the current record matters
  console.log('\n── STEP 4: Clearing next_due_date on historical (non-latest) rows...');
  const r4 = await pool.query(`
    UPDATE bwts_maintenance_log
    SET next_due_date = NULL
    WHERE id NOT IN (
      SELECT DISTINCT ON (maintenance_type, component_id) id
      FROM bwts_maintenance_log
      ORDER BY maintenance_type, component_id, completed_date DESC NULLS LAST
    )
    AND maintenance_type != 'LAMP_REPLACEMENT'
  `);
  console.log(`  ✓ ${r4.rowCount} historical rows cleared`);

  // ── STEP 5: Recalculate next_due_date on latest row per component/type ───
  console.log('\n── STEP 5: Setting next_due_date on latest rows using manual intervals...');

  // Get all latest rows (excluding LAMP_REPLACEMENT — already correctly set)
  const latestRows = await pool.query(`
    SELECT DISTINCT ON (maintenance_type, component_id)
      id, component_id, maintenance_type, completed_date, next_due_date
    FROM bwts_maintenance_log
    WHERE maintenance_type != 'LAMP_REPLACEMENT'
    ORDER BY maintenance_type, component_id, completed_date DESC NULLS LAST
  `);

  let updated = 0;
  let skipped = 0;
  for (const row of latestRows.rows) {
    const intervalDays = getIntervalDays(row.maintenance_type, row.component_id);
    if (!intervalDays) { skipped++; continue; }

    const completedAt = new Date(row.completed_date);
    const nextDue = new Date(completedAt);
    nextDue.setDate(nextDue.getDate() + intervalDays);
    const nextDueStr = nextDue.toISOString().slice(0, 10);

    await pool.query(
      `UPDATE bwts_maintenance_log SET next_due_date = $1 WHERE id = $2`,
      [nextDueStr, row.id]
    );
    console.log(`  → id=${row.id} | ${row.component_id} | ${row.maintenance_type} | completed=${row.completed_date?.toISOString?.().slice(0,10)} | +${intervalDays}d → next_due=${nextDueStr}`);
    updated++;
  }
  console.log(`  ✓ ${updated} latest rows updated, ${skipped} skipped`);

  // ── STEP 6: Verify final state ────────────────────────────────────────────
  console.log('\n── STEP 6: Verification — current state per component/type:\n');
  const verify = await pool.query(`
    SELECT DISTINCT ON (maintenance_type, component_id)
      component_id,
      maintenance_type,
      completed_date::date AS last_completed,
      next_due_date::date  AS next_due,
      status,
      (next_due_date::date - CURRENT_DATE)::int AS days_until
    FROM bwts_maintenance_log
    ORDER BY maintenance_type, component_id, completed_date DESC NULLS LAST
  `);

  const today = new Date().toISOString().slice(0, 10);
  console.log(`  Ref date: ${today}\n`);
  console.log(`  ${'Component'.padEnd(25)} ${'Type'.padEnd(25)} ${'Last Done'.padEnd(12)} ${'Next Due'.padEnd(12)} ${'Days'}`);
  console.log(`  ${'-'.repeat(90)}`);

  for (const r of verify.rows) {
    const days = r.days_until !== null
      ? (r.days_until > 0 ? `+${r.days_until}` : String(r.days_until))
      : 'N/A';
    const flag = r.days_until !== null && r.days_until < 0 ? ' ⚠ OVERDUE' : (r.days_until !== null && r.days_until <= 30 ? ' ↑ DUE SOON' : '');
    console.log(`  ${(r.component_id ?? '').padEnd(25)} ${(r.maintenance_type ?? '').padEnd(25)} ${(r.last_completed ?? '').toString().padEnd(12)} ${(r.next_due ?? 'NULL').toString().padEnd(12)} ${days}${flag}`);
  }

  await pool.end();
  await connector.close();
  console.log('\n✓ Migration complete.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
