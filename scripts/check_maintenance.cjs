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

  // 1. Row count + column names
  const cols = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'bwts_maintenance_log' ORDER BY ordinal_position
  `);
  console.log('\n=== COLUMNS ===');
  cols.rows.forEach(c => console.log(`  ${c.column_name}  (${c.data_type})`));

  const cnt = await pool.query('SELECT COUNT(*) FROM bwts_maintenance_log');
  console.log(`\n=== TOTAL ROWS: ${cnt.rows[0].count} ===`);

  // 2. Breakdown by maintenance_type
  const types = await pool.query(`
    SELECT maintenance_type, COUNT(*) as cnt FROM bwts_maintenance_log
    GROUP BY maintenance_type ORDER BY cnt DESC
  `);
  console.log('\n=== BY TYPE ===');
  types.rows.forEach(r => console.log(`  ${r.maintenance_type}: ${r.cnt}`));

  // 3. Upcoming tasks (next_due_date in the future from 2026-05-12)
  const upcoming = await pool.query(`
    SELECT component_id, component_type, maintenance_type, next_due_date, next_due_hours, description
    FROM bwts_maintenance_log
    WHERE next_due_date >= '2026-05-12'
    ORDER BY next_due_date ASC
    LIMIT 20
  `);
  console.log('\n=== UPCOMING (next_due_date >= 2026-05-12) ===');
  upcoming.rows.forEach(r => console.log(
    `  ${r.next_due_date?.toISOString?.().slice(0,10) ?? r.next_due_date} | ${r.component_id} | ${r.maintenance_type} | ${r.description}`
  ));

  // 4. Most recent 5 rows
  const recent = await pool.query(`SELECT * FROM bwts_maintenance_log ORDER BY timestamp DESC LIMIT 5`);
  console.log('\n=== MOST RECENT 5 ROWS ===');
  recent.rows.forEach(r => console.log(JSON.stringify(r)));

  await pool.end(); await connector.close();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
