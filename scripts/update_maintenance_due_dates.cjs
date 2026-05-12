/**
 * update_maintenance_due_dates.cjs
 * Sets next_due_date on maintenance log records so the Predictive tab
 * can show real upcoming maintenance data.
 *
 * Context (2026-05-12):
 *   - LAMP-13 (3566h), LAMP-15 (3588h): past 3000h rated life → due at next port call ~May 27
 *   - LAMP-07 (3389h), LAMP-09 (3483h): past threshold → due next scheduled window ~Jul 15
 *   - Other lamps (01,02,04,05,06,08,10,11,16): past 3000h but moderate efficiency → Aug 15
 *   - CIP_CYCLE (last done Mar 26, recommended ≤30 days): overdue → was due Apr 25
 */
'use strict';
const fs = require('fs');
const path = require('path');
const envLines = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n');
for (const line of envLines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const idx = t.indexOf('=');
  if (idx < 0) continue;
  const key = t.slice(0, idx).trim();
  let val = t.slice(idx + 1).trim();
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) val = val.slice(1, -1);
  process.env[key] = val;
}
const { Pool } = require('pg');
const { Connector, AuthTypes } = require('@google-cloud/cloud-sql-connector');

async function main() {
  const sa = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  const connector = new Connector({ authType: AuthTypes.SERVICE_ACCOUNT, serviceAccountKey: sa });
  const clientOpts = await connector.getOptions({ instanceConnectionName: process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME });
  const pool = new Pool({ ...clientOpts, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });

  // LAMP-13 & LAMP-15: Critical — due at next port call (May 27, 15 days away)
  let r = await pool.query(
    `UPDATE bwts_maintenance_log SET next_due_date = '2026-05-27'
     WHERE component_id IN ('LAMP-13', 'LAMP-15') AND maintenance_type = 'LAMP_REPLACEMENT'`
  );
  console.log(`LAMP-13 & LAMP-15 next_due_date set: ${r.rowCount} rows`);

  // LAMP-07 & LAMP-09: High risk — due next scheduled window (Jul 15, 64 days away)
  r = await pool.query(
    `UPDATE bwts_maintenance_log SET next_due_date = '2026-07-15'
     WHERE component_id IN ('LAMP-07', 'LAMP-09') AND maintenance_type = 'LAMP_REPLACEMENT'`
  );
  console.log(`LAMP-07 & LAMP-09 next_due_date set: ${r.rowCount} rows`);

  // Other moderate lamps: schedule for Aug 15 dry dock (95 days away)
  r = await pool.query(
    `UPDATE bwts_maintenance_log SET next_due_date = '2026-08-15'
     WHERE component_id IN ('LAMP-01','LAMP-02','LAMP-04','LAMP-05','LAMP-06','LAMP-08','LAMP-10','LAMP-11','LAMP-16')
     AND maintenance_type = 'LAMP_REPLACEMENT'`
  );
  console.log(`Other lamps next_due_date set: ${r.rowCount} rows`);

  // CIP: was due April 25 (30 days after Mar 26 CIP) — mark as overdue
  r = await pool.query(
    `UPDATE bwts_maintenance_log SET next_due_date = '2026-04-25'
     WHERE maintenance_type = 'CIP_CYCLE' AND next_due_date IS NULL
     AND timestamp = (SELECT MAX(timestamp) FROM bwts_maintenance_log WHERE maintenance_type = 'CIP_CYCLE')`
  );
  console.log(`CIP_CYCLE next_due_date set (overdue Apr 25): ${r.rowCount} rows`);

  // Verify upcoming
  const upcoming = await pool.query(`
    SELECT component_id, maintenance_type, next_due_date,
      (next_due_date::date - '2026-05-12'::date) as days_from_today
    FROM bwts_maintenance_log
    WHERE next_due_date IS NOT NULL
    ORDER BY next_due_date ASC
  `);
  console.log('\n=== All tasks with next_due_date ===');
  upcoming.rows.forEach(r => console.log(
    `  ${r.next_due_date?.toISOString?.().slice(0,10) ?? r.next_due_date} | days: ${r.days_from_today > 0 ? '+' : ''}${r.days_from_today} | ${r.component_id} | ${r.maintenance_type}`
  ));

  await pool.end(); await connector.close();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
