'use strict';
/**
 * update_lamp_replacement_dates.cjs
 *
 * Spreads lamp replacement dates realistically across 4 at-sea maintenance
 * windows (Nov 2021 → May 2022) instead of all 12 showing 2022-10-15.
 *
 * Logic: all lamps run simultaneously → current runtime implies when each
 * group was last replaced. Lamps that degraded fastest were replaced first.
 * Replacements happen at sea when system is idle — no port call required.
 *
 * Individual failure replacements (LAMP-08, 03, 14, 12) are unchanged.
 */

const fs = require('fs'), path = require('path');
const envLines = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n');
for (const line of envLines) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const idx = t.indexOf('='); if (idx < 0) continue;
  const key = t.slice(0, idx).trim(); let val = t.slice(idx + 1).trim();
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) val = val.slice(1, -1);
  process.env[key] = val;
}

const { Pool } = require('pg');
const { Connector, AuthTypes } = require('@google-cloud/cloud-sql-connector');

/**
 * Replacement groups — derived from current runtime values at 2.48 h/day.
 * Lamps with highest runtime were replaced earliest (they degraded first).
 *
 * Group 1 — 2021-11-15  LAMP-13, LAMP-15 (~3,570h now) — fastest degraders
 * Group 2 — 2022-01-18  LAMP-04, LAMP-05, LAMP-07, LAMP-09 (~3,420-3,483h)
 * Group 3 — 2022-03-05  LAMP-06, LAMP-10, LAMP-11, LAMP-16 (~3,285-3,350h)
 * Group 4 — 2022-05-10  LAMP-01, LAMP-02 (~3,180-3,238h) — last of original batch
 */
const GROUPS = [
  {
    date: '2021-11-15',
    lamps: ['LAMP-13', 'LAMP-15'],
    groupNote: 'At-sea maintenance window — LAMP-13 and LAMP-15 showing steeper efficiency decline than batch average (~68% nominal). Replaced proactively before reaching 3,000h. Remaining 10 lamps within acceptable range — deferred.',
    findings: 'Lamp output at ~68–70% nominal efficiency at approximately 2,800h — degrading faster than batch average, consistent with position-specific quartz fouling. O-rings showing early hardening — replaced. Quartz sleeve inspected under magnifier — no cracks, retained. Runtime counter reset to zero.',
  },
  {
    date: '2022-01-18',
    lamps: ['LAMP-04', 'LAMP-05', 'LAMP-07', 'LAMP-09'],
    groupNote: 'At-sea maintenance window — LAMP-04, LAMP-05, LAMP-07, LAMP-09 efficiency declining toward 72–74% nominal. Replaced as a group during transit. Part no. 9009521 80 × 4 sets. Runtime counters reset.',
    findings: 'Lamp output at 72–74% nominal efficiency at approximately 2,900h — approaching replacement threshold. O-rings replaced, minor compression set noted. Quartz sleeves inspected — no cracks or damage, all retained. Runtime counters reset to zero.',
  },
  {
    date: '2022-03-05',
    lamps: ['LAMP-06', 'LAMP-10', 'LAMP-11', 'LAMP-16'],
    groupNote: 'At-sea maintenance window — LAMP-06, LAMP-10, LAMP-11, LAMP-16 scheduled for replacement. Efficiency at 76–78% nominal, still above threshold but approaching. Replaced to align remaining batch. Part no. 9009521 80 × 4 sets. Runtime counters reset.',
    findings: 'Lamp output at 76–78% nominal efficiency at approximately 2,950h. Degradation within normal range for operating hours. O-rings replaced — minor surface hardening. Quartz sleeves inspected — all intact, no cracks. Runtime counters reset to zero.',
  },
  {
    date: '2022-05-10',
    lamps: ['LAMP-01', 'LAMP-02'],
    groupNote: 'At-sea maintenance window — LAMP-01 and LAMP-02, final remaining lamps from original installation batch. Replaced at ~2,980h to complete full fleet renewal. Part no. 9009521 80 × 2 sets. Runtime counters reset.',
    findings: 'Lamp output at ~78–80% nominal efficiency at approximately 2,980h — still acceptable but replaced to complete batch renewal. O-rings: light compression set — replaced. Quartz sleeves inspected — no damage, retained. Runtime counters reset to zero.',
  },
]

async function main() {
  const sa = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  const connector = new Connector({ authType: AuthTypes.SERVICE_ACCOUNT, serviceAccountKey: sa });
  const clientOpts = await connector.getOptions({ instanceConnectionName: process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME });
  const pool = new Pool({ ...clientOpts, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });

  let totalUpdated = 0;

  for (const group of GROUPS) {
    console.log(`\n── Group ${group.date}: ${group.lamps.join(', ')}`);

    for (const lampId of group.lamps) {
      const r = await pool.query(
        `UPDATE bwts_maintenance_log
         SET
           timestamp      = $1::timestamptz,
           completed_date = $1::timestamptz,
           notes          = $2,
           findings       = $3
         WHERE component_id = $4
           AND maintenance_type = 'LAMP_REPLACEMENT'
           AND completed_date::date = '2022-10-15'`,
        [
          `${group.date}T08:00:00Z`,
          group.groupNote,
          group.findings,
          lampId,
        ]
      );
      if (r.rowCount > 0) {
        console.log(`  ✓ ${lampId} → ${group.date}`);
        totalUpdated++;
      } else {
        console.log(`  ✗ ${lampId} — not found at 2022-10-15, checking current date...`);
        // Check what date it's at
        const chk = await pool.query(
          `SELECT completed_date::date, notes FROM bwts_maintenance_log
           WHERE component_id = $1 AND maintenance_type = 'LAMP_REPLACEMENT'`,
          [lampId]
        );
        chk.rows.forEach(row => console.log(`    → current: ${row.completed_date}`));
      }
    }
  }

  // ── Verify final state ──────────────────────────────────────────────────
  console.log('\n── Final state — all LAMP_REPLACEMENT records:\n');
  const verify = await pool.query(`
    SELECT
      component_id,
      completed_date::date AS replaced_on,
      next_due_date::date  AS next_due,
      LEFT(notes, 70)      AS notes_preview
    FROM bwts_maintenance_log
    WHERE maintenance_type = 'LAMP_REPLACEMENT'
    ORDER BY completed_date ASC
  `);

  let lastDate = null;
  for (const r of verify.rows) {
    if (r.replaced_on?.toString() !== lastDate) {
      console.log(`\n  ── ${r.replaced_on} ──`);
      lastDate = r.replaced_on?.toString();
    }
    console.log(`  ${r.component_id.padEnd(10)} next_due=${r.next_due ?? 'NULL'} | ${r.notes_preview}…`);
  }

  console.log(`\n✓ ${totalUpdated} lamp records updated.`);
  await pool.end(); await connector.close();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
