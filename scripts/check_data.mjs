import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

import pg from 'pg';
const { Pool } = pg;
import { CloudSQLConnector } from '@google-cloud/cloud-sql-connector';

const saJson = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
const sa = JSON.parse(saJson);
const connector = new CloudSQLConnector({ authType: 'SERVICE_ACCOUNT', serviceAccountKey: sa });
const clientOpts = await connector.getOptions({ instanceConnectionName: process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME });
const pool = new Pool({ ...clientOpts, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });

const last = await pool.query('SELECT timestamp, "LAMP13RUNTIME", "LAMP15RUNTIME", "LAMP09RUNTIME", "LAMP13EFFICIENCY", "LAMP15EFFICIENCY", "UVRINTENSITY", "OPERATIONTYPE" FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1');
console.log('LAST ROW:', JSON.stringify(last.rows[0], null, 2));

const range = await pool.query('SELECT MIN(timestamp) as first, MAX(timestamp) as last, COUNT(*) as total FROM bwts_iot_telemetry');
console.log('RANGE:', JSON.stringify(range.rows[0], null, 2));

const evt = await pool.query('SELECT timestamp, "eventType", "operationType" FROM bwts_iot_events ORDER BY timestamp DESC LIMIT 5');
console.log('LAST EVENTS:', JSON.stringify(evt.rows, null, 2));

await pool.end(); await connector.close();
