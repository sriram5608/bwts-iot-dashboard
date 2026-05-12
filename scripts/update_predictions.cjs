/**
 * update_predictions.cjs
 * Updates bwts_iot_predictions to match fill data ending state (2026-05-12).
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

// Final state from fill_historical_data run
const LAMPS = [
  { id: 'LAMP-01', runtime: 3238.3, eff: 86.5,  rul: -238,  failProb: 0.62, type: 'UV_LAMP' },
  { id: 'LAMP-02', runtime: 3179.8, eff: 87.6,  rul: -180,  failProb: 0.58, type: 'UV_LAMP' },
  { id: 'LAMP-03', runtime: 1015.2, eff: 100,   rul: 1985,  failProb: 0.03, type: 'UV_LAMP' },
  { id: 'LAMP-04', runtime: 3423.3, eff: 76.08, rul: -423,  failProb: 0.72, type: 'UV_LAMP' },
  { id: 'LAMP-05', runtime: 3428.5, eff: 75.68, rul: -429,  failProb: 0.73, type: 'UV_LAMP' },
  { id: 'LAMP-06', runtime: 3320.8, eff: 83.99, rul: -321,  failProb: 0.65, type: 'UV_LAMP' },
  { id: 'LAMP-07', runtime: 3388.6, eff: 68.76, rul: -389,  failProb: 0.70, type: 'UV_LAMP' },
  { id: 'LAMP-08', runtime: 3021.3, eff: 90.8,  rul: -21,   failProb: 0.42, type: 'UV_LAMP' },
  { id: 'LAMP-09', runtime: 3482.7, eff: 69.7,  rul: -483,  failProb: 0.74, type: 'UV_LAMP' },
  { id: 'LAMP-10', runtime: 3286.0, eff: 85.5,  rul: -286,  failProb: 0.63, type: 'UV_LAMP' },
  { id: 'LAMP-11', runtime: 3348.0, eff: 82.3,  rul: -348,  failProb: 0.66, type: 'UV_LAMP' },
  { id: 'LAMP-12', runtime:  473.4, eff: 100,   rul: 2527,  failProb: 0.02, type: 'UV_LAMP' },
  { id: 'LAMP-13', runtime: 3566.0, eff: 59.92, rul: -566,  failProb: 0.82, type: 'UV_LAMP' },
  { id: 'LAMP-14', runtime: 2696.3, eff: 95.2,  rul:  304,  failProb: 0.18, type: 'UV_LAMP' },
  { id: 'LAMP-15', runtime: 3588.6, eff: 46.14, rul: -589,  failProb: 0.88, type: 'UV_LAMP' },
  { id: 'LAMP-16', runtime: 3305.5, eff: 85.1,  rul: -306,  failProb: 0.64, type: 'UV_LAMP' },
];

async function main() {
  const sa = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  const connector = new Connector({ authType: AuthTypes.SERVICE_ACCOUNT, serviceAccountKey: sa });
  const clientOpts = await connector.getOptions({ instanceConnectionName: process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME });
  const pool = new Pool({ ...clientOpts, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });

  const now = new Date('2026-05-12T09:00:00Z');

  // Delete and re-insert all predictions
  await pool.query('DELETE FROM bwts_iot_predictions');
  console.log('Deleted existing predictions');

  for (const lamp of LAMPS) {
    await pool.query(
      `INSERT INTO bwts_iot_predictions
         (timestamp, "componentId", "componentType", month,
          "predictionsRemainingUsefulLifeHours", "predictionsFailureProbability", "predictionsEfficiencyPercent",
          "currentStateRuntimeHours", "currentStateEfficiencyPercent")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [now, lamp.id, lamp.type, 5,
       lamp.rul, lamp.failProb, lamp.eff,
       lamp.runtime, lamp.eff]
    );
    const flag = lamp.rul < 0 ? ' ⚠ OVERDUE' : lamp.runtime > 2500 ? ' → WARNING' : '';
    console.log(`  ${lamp.id}: ${lamp.runtime}h | eff ${lamp.eff}% | fail ${(lamp.failProb*100).toFixed(0)}%${flag}`);
  }

  console.log('\nPredictions updated. Done.');
  await pool.end(); await connector.close();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
