/**
 * create_alert_instances_table.cjs
 * Creates bwts_alert_instances table — the bridge between the email trigger
 * and the agent SDK. Alerts are inserted here when emails fire; acknowledge/
 * resolve actions from the dashboard update status so the agent can skip
 * already-handled alerts.
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bwts_alert_instances (
      id              BIGSERIAL PRIMARY KEY,
      alert_type      TEXT        NOT NULL,
      severity        TEXT        NOT NULL,
      parameter       TEXT        NOT NULL,
      current_value   NUMERIC,
      threshold_value NUMERIC,
      unit            TEXT,
      deviation_pct   NUMERIC,
      detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status          TEXT        NOT NULL DEFAULT 'ACTIVE',
      acknowledged_at TIMESTAMPTZ,
      resolved_at     TIMESTAMPTZ,
      agent_triggered BOOLEAN     NOT NULL DEFAULT false,
      source          TEXT        NOT NULL DEFAULT 'DEMO',
      month           INT         NOT NULL
    )
  `);
  console.log('✓ bwts_alert_instances table created (or already exists)');

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_alert_instances_status
      ON bwts_alert_instances (status, detected_at DESC)
  `);
  console.log('✓ index on (status, detected_at) created');

  const count = await pool.query('SELECT COUNT(*) FROM bwts_alert_instances');
  console.log(`  Current rows: ${count.rows[0].count}`);

  await pool.end(); await connector.close();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
