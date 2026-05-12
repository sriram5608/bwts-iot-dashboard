const fs = require('fs');
const path = require('path');

// Manual .env parser
const envPath = path.join(__dirname, '..', '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx < 0) continue;
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const { Pool } = require('pg');
const { Connector, AuthTypes } = require('@google-cloud/cloud-sql-connector');

async function main() {
  const saJson = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
  const sa = JSON.parse(saJson);
  const connector = new Connector({ authType: AuthTypes.SERVICE_ACCOUNT, serviceAccountKey: sa });
  const clientOpts = await connector.getOptions({ instanceConnectionName: process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME });
  const pool = new Pool({ ...clientOpts, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });

  const last = await pool.query('SELECT timestamp, "LAMP13RUNTIME", "LAMP15RUNTIME", "LAMP09RUNTIME", "LAMP13EFFICIENCY", "LAMP15EFFICIENCY", "UVRINTENSITY", "operationType" FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1');
  console.log('LAST ROW:', JSON.stringify(last.rows[0], null, 2));

  const range = await pool.query('SELECT MIN(timestamp) as first, MAX(timestamp) as last, COUNT(*) as total FROM bwts_iot_telemetry');
  console.log('RANGE:', JSON.stringify(range.rows[0], null, 2));

  const evt = await pool.query('SELECT timestamp, "eventType", "operationType" FROM bwts_iot_events ORDER BY timestamp DESC LIMIT 5');
  console.log('LAST EVENTS:', JSON.stringify(evt.rows, null, 2));

  await pool.end(); await connector.close();
}
main().catch(e => { console.error(e.message); process.exit(1); });
