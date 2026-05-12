/**
 * fill_historical_data.cjs
 *
 * Generates and inserts historical BWTS telemetry for the gap period
 * Jan 20, 2026 → May 11, 2026 (13 voyage operations, 30-min intervals).
 *
 * Starting state is read from the last telemetry row (Jan 15 2026).
 * Operations alternate BALLAST / DEBALLAST. CIP done Mar 26 gives a
 * brief UV boost. UV declines from ~736 → ~520 W/m² over 312 operating hours.
 *
 * Inserts into: bwts_iot_telemetry, bwts_iot_events, bwts_iot_health_scores
 * Run once: node scripts/fill_historical_data.cjs
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── .env parser ────────────────────────────────────────────────────────────
const envLines = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n');
for (const line of envLines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const idx = t.indexOf('=');
  if (idx < 0) continue;
  const key = t.slice(0, idx).trim();
  let val = t.slice(idx + 1).trim();
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const { Pool }                    = require('pg');
const { Connector, AuthTypes }    = require('@google-cloud/cloud-sql-connector');

// ── Helpers ────────────────────────────────────────────────────────────────
const rnd  = (base, pct) => base * (1 + (Math.random() - 0.5) * 2 * pct);
const clmp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt2 = v => parseFloat(v.toFixed(2));
const fmt1 = v => parseFloat(v.toFixed(1));
const pad  = i => String(i).padStart(2, '0');

// ── Voyage schedule ────────────────────────────────────────────────────────
// Last DB row: Jan 15 2026, operationType = DEBALLAST → first new op = BALLAST
const OPERATIONS = [
  { start: '2026-01-20T06:00:00Z', mode: 'BALLAST',   durationH: 24, port: 'Port Hedland'  },
  { start: '2026-02-03T14:00:00Z', mode: 'DEBALLAST', durationH: 22, port: 'Yokohama'       },
  { start: '2026-02-11T08:00:00Z', mode: 'BALLAST',   durationH: 26, port: 'Kobe'           },
  { start: '2026-02-22T10:00:00Z', mode: 'DEBALLAST', durationH: 24, port: 'Busan'          },
  { start: '2026-03-01T16:00:00Z', mode: 'BALLAST',   durationH: 20, port: 'Fremantle'      },
  { start: '2026-03-14T08:00:00Z', mode: 'DEBALLAST', durationH: 26, port: 'Qingdao'        },
  { start: '2026-03-21T10:00:00Z', mode: 'BALLAST',   durationH: 24, port: 'Shanghai'       },
  // CIP done 2026-03-26 during port stay after op 7 — UV bumps +20 W/m² from op 8
  { start: '2026-04-01T06:00:00Z', mode: 'DEBALLAST', durationH: 22, port: 'Jebel Ali'     },
  { start: '2026-04-08T12:00:00Z', mode: 'BALLAST',   durationH: 28, port: 'Mundra'         },
  { start: '2026-04-18T08:00:00Z', mode: 'DEBALLAST', durationH: 24, port: 'Tianjin'        },
  { start: '2026-04-25T14:00:00Z', mode: 'BALLAST',   durationH: 22, port: 'Kaohsiung'      },
  { start: '2026-05-05T06:00:00Z', mode: 'DEBALLAST', durationH: 26, port: 'Ulsan'          },
  { start: '2026-05-10T10:00:00Z', mode: 'BALLAST',   durationH: 24, port: 'Singapore'      },
];

// After op 7 ends, CIP is performed on 2026-03-26 (during port stay).
// Boost +20 W/m² applied from op 8 start, decaying to 0 over 72 operating hours.
const CIP_BOOST_START_OP_IDX  = 7;   // op 8 (0-indexed = 7)
const CIP_BOOST_MAX_WM2       = 20;
const CIP_BOOST_DECAY_HOURS   = 72;

// Total operating hours in this batch: 24+22+26+24+20+26+24+22+28+24+22+26+24 = 312
const TOTAL_OP_HOURS = 312;

// UV decline: 736 (Jan 15) → ~520 (end of op 13)
// Rate = (736 - 520) / 312 ≈ 0.692; add a little extra for the CIP boost offset
const UV_START   = 736;
const UV_DECLINE = 0.72;  // W/m² per operating hour

// CIP counter at Jan 15: 47 days since 2026-03-26 means it hadn't happened yet on Jan 15.
// On Jan 15 the last CIP was some time before — based on the 30-day schedule,
// approximately Jan 26 previous (2025-12-27?). Use a plausible counter.
// For simplicity: Jan 15 value from existing data. CIP happens Mar 26 → counter resets.
// We track elapsed calendar hours since last CIP for each row.
const LAST_CIP_JAN15 = new Date('2025-12-27T08:00:00Z'); // ~19 days before Jan 15
const CIP_MAR26       = new Date('2026-03-26T12:00:00Z');

// ── Lamp data ──────────────────────────────────────────────────────────────
// Starting efficiencies and runtimes are read from the DB (last row Jan 15).
// These will be populated in main() before generation.
let lampRuntimes    = Array(16).fill(0);
let lampEfficiencies = Array(16).fill(90);

// Efficiency decline per operating hour (only for degraded lamps)
const EFF_DECLINE_RATE = [
  0, 0, 0, 0.002, 0.002, 0.001, 0.003, 0,    // LAMP-01 to 08 (minor)
  0.008,                                         // LAMP-09 (3170h → past 3000h, declining)
  0, 0, 0,                                       // LAMP-10, 11, 12
  0.015,                                          // LAMP-13 (3254h, critical)
  0,                                              // LAMP-14 (480h, new)
  0.022,                                          // LAMP-15 (3277h, most critical)
  0,                                              // LAMP-16
];

// Power bases — realistic W values (from simulator)
const LAMP_POWER_BASE = [420, 420, 421, 414, 416, 417, 413, 421, 410, 419, 418, 421, 402, 421, 395, 418];

async function main() {
  // ── DB connection ──────────────────────────────────────────────────────
  const saJson = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
  const sa = JSON.parse(saJson);
  const connector = new Connector({ authType: AuthTypes.SERVICE_ACCOUNT, serviceAccountKey: sa });
  const clientOpts = await connector.getOptions({ instanceConnectionName: process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME });
  const pool = new Pool({
    ...clientOpts,
    user:     process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  // ── Load starting lamp state from Jan 15 last row ──────────────────────
  console.log('Loading starting lamp state from Jan 15 last row...');
  const lampCols = [];
  for (let i = 1; i <= 16; i++) {
    lampCols.push(`"LAMP${pad(i)}RUNTIME" AS r${i}`);
    lampCols.push(`"LAMP${pad(i)}EFFICIENCY" AS e${i}`);
  }
  const lastRow = (await pool.query(`SELECT ${lampCols.join(',')} FROM bwts_iot_telemetry ORDER BY timestamp DESC LIMIT 1`)).rows[0];
  for (let i = 1; i <= 16; i++) {
    lampRuntimes[i - 1]     = parseFloat(lastRow[`r${i}`]);
    lampEfficiencies[i - 1] = parseFloat(lastRow[`e${i}`]);
  }
  console.log('Starting runtimes (LAMP-01 to 16):', lampRuntimes.map(v => v.toFixed(1)).join(', '));
  console.log('Starting efficiencies:', lampEfficiencies.map(v => v.toFixed(1)).join(', '));

  // ── Check for existing fill data ───────────────────────────────────────
  const existing = await pool.query("SELECT COUNT(*) AS cnt FROM bwts_iot_telemetry WHERE timestamp > '2026-01-15T10:00:00Z'");
  const existingCount = parseInt(existing.rows[0].cnt);
  if (existingCount > 0) {
    console.log(`\nWARNING: ${existingCount} rows already exist after Jan 15. Aborting to avoid duplicates.`);
    console.log('To re-run, first delete rows: DELETE FROM bwts_iot_telemetry WHERE timestamp > \'2026-01-15T10:00:00Z\'');
    await pool.end(); await connector.close(); return;
  }

  // ── State tracking ─────────────────────────────────────────────────────
  let cumulativeOpHours = 0;  // total operating hours across all operations
  let totalBallastVol   = 0;
  let totalDeballastVol = 0;
  let totalTelemetryRows = 0;
  let totalEvents        = 0;
  let totalHealthRows    = 0;

  const INTERVAL_MIN = 30;  // 30-minute telemetry interval

  for (let opIdx = 0; opIdx < OPERATIONS.length; opIdx++) {
    const op   = OPERATIONS[opIdx];
    const mode = op.mode;
    const isBallast = mode === 'BALLAST';
    const opStart   = new Date(op.start);
    const opEndMs   = opStart.getTime() + op.durationH * 3600 * 1000;
    const numRows   = Math.floor(op.durationH * 60 / INTERVAL_MIN);

    console.log(`\nOperation ${opIdx + 1}: ${mode} at ${op.port} (${op.durationH}h, ${numRows} rows)`);
    console.log(`  Start: ${op.start} | CumHours before: ${cumulativeOpHours.toFixed(1)}`);

    // ── Insert PROCESS_START event ─────────────────────────────────────
    await pool.query(
      `INSERT INTO bwts_iot_events (timestamp, "eventType", description, "dataOperationType", "dataLocation", month)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [opStart, 'PROCESS_START',
       `${mode} process started at ${op.port}`,
       mode, op.port, opStart.getMonth() + 1]
    );
    totalEvents++;

    // ── Generate telemetry rows for this operation ─────────────────────
    const rows = [];
    let opFilterPressure = isBallast ? 0.18 : 0.03;
    let backflushActive  = false;
    let backflushCount   = 0;
    let opBallastVol     = 0;
    let opDeballastVol   = 0;

    for (let r = 0; r < numRows; r++) {
      const ts           = new Date(opStart.getTime() + r * INTERVAL_MIN * 60 * 1000);
      const rowOpHours   = r * INTERVAL_MIN / 60;
      const cumH         = cumulativeOpHours + rowOpHours;

      // ── UV calculation ─────────────────────────────────────────────
      // Base decline
      let uvBase = UV_START - cumH * UV_DECLINE;
      // CIP boost: applied from op 8 onward, decays over 72 operating hours
      if (opIdx >= CIP_BOOST_START_OP_IDX) {
        const hoursSinceCipStart = cumH - (cumulativeOpHours > 0 ? cumulativeOpHours : 0);
        // cumulative hours at start of op 8
        const cumHAtOp8Start = OPERATIONS.slice(0, CIP_BOOST_START_OP_IDX)
          .reduce((acc, o) => acc + o.durationH, 0);
        const hoursSinceCip = cumH - cumHAtOp8Start;
        const cipDecayFactor = Math.max(0, 1 - hoursSinceCip / CIP_BOOST_DECAY_HOURS);
        uvBase += CIP_BOOST_MAX_WM2 * cipDecayFactor;
      }
      const uvIntensity = fmt2(clmp(rnd(uvBase, 0.02), 200, 750));

      // ── Lamp runtimes and efficiencies (at this point in time) ─────
      const curRuntimes     = lampRuntimes.map((rt, i) => fmt1(rt + cumH));
      const curEfficiencies = lampEfficiencies.map((eff, i) => {
        const degraded = Math.max(5, eff - EFF_DECLINE_RATE[i] * cumH);
        return fmt2(clmp(rnd(degraded, 0.005), 5, 100));
      });
      const avgEff = fmt2(curEfficiencies.reduce((a, b) => a + b, 0) / 16);
      const degradImpact = fmt2(Math.max(0, (100 - avgEff) * 0.5));
      const powerComp    = fmt2(Math.min(30, degradImpact * 1.2));

      // ── Filter — mode-specific ──────────────────────────────────────
      let fltMotor = 'STANDBY';
      let fltBackflushActive = false;
      let fltBackflushCount  = 0;
      if (isBallast) {
        if (backflushActive) {
          backflushCount++;
          opFilterPressure = Math.max(0.15, opFilterPressure - 0.10);
          if (backflushCount >= 3) { backflushActive = false; backflushCount = 0; opFilterPressure = 0.18; }
          fltMotor = 'BACKFLUSHING';
          fltBackflushActive = true;
        } else {
          opFilterPressure += 0.003;
          if (opFilterPressure >= 0.45) { backflushActive = true; backflushCount = 0; }
          fltMotor = 'NORMAL';
        }
        fltBackflushCount = backflushCount;
      } else {
        opFilterPressure = rnd(0.03, 0.15);
      }

      // ── Flow, pressure, temp ───────────────────────────────────────
      const baseFlow  = isBallast ? 850 : 950;
      const flowRate  = fmt1(rnd(baseFlow, 0.015));
      const pressure  = fmt2(rnd(isBallast ? 4.8 : 3.8, 0.02));
      const waterTemp = fmt2(rnd(isBallast ? 28.0 : 30.5, 0.01));

      if (isBallast) opBallastVol   += flowRate * (INTERVAL_MIN / 60);
      else           opDeballastVol += flowRate * (INTERVAL_MIN / 60);
      totalBallastVol   += isBallast ? flowRate * (INTERVAL_MIN / 60) : 0;
      totalDeballastVol += isBallast ? 0 : flowRate * (INTERVAL_MIN / 60);

      // ── CIP hours since last ────────────────────────────────────────
      const cipRef  = ts < CIP_MAR26 ? LAST_CIP_JAN15 : CIP_MAR26;
      const cipHrs  = Math.round((ts.getTime() - cipRef.getTime()) / 3600000);

      // ── Compliance ─────────────────────────────────────────────────
      const compliant    = uvIntensity >= 530 ? 'COMPLIANT' : 'NON_COMPLIANT';
      const processState = 'RUNNING';

      // ── Build row ──────────────────────────────────────────────────
      const row = {
        timestamp:     ts,
        systemId:      'BWTS-PB31-001',
        operationType: mode,
        location:      op.port,
        month:         ts.getMonth() + 1,
        UVRINTENSITY:          uvIntensity,
        UVRINTENSITYNORMALIZED: fmt2(uvIntensity / 720 * 100),
        UVRPOWEROUTPUT:        fmt2(rnd(87, 0.02)),
        UVRPOWERSETPOINT:      90,
        UVRWATERTEMP:          waterTemp,
        UVRLEVEL:              'OPERATIONAL',
        LDCAIRTEMP:            fmt2(rnd(36, 0.02)),
        LDCFANSPEED:           Math.round(rnd(1450, 0.01)),
        LDCFANSTATUS:          'RUNNING',
        LDCWATERALARM:         0,
        FLTDIFFPRESSURE:       fmt2(clmp(opFilterPressure, 0.01, 2.0)),
        FLTMOTORSTATUS:        fltMotor,
        FLTBACKFLUSHACTIVE:    fltBackflushActive ? 1 : 0,
        FLTBACKFLUSHCOUNT:     fltBackflushCount,
        SYSFLOWRATE:           flowRate,
        SYSPRESSURE:           pressure,
        SYSVALVEPOSITION:      fmt1(rnd(78, 0.03)),
        SYSTOTALBALLASTVOL:    fmt1(totalBallastVol),
        SYSTOTALDEBALLASTVOL:  fmt1(totalDeballastVol),
        SYSEXTERNALFEED:       0,
        CIPHOURSSINCELAST:     cipHrs,
        PLCCPUUSAGE:           fmt1(rnd(18, 0.1)),
        PLCRAMUSAGE:           fmt1(rnd(42, 0.05)),
        PLCCPUTEMP:            fmt1(rnd(51, 0.03)),
        PROCESSSTATE:          processState,
        COMPLIANCEMODE:        'USCG',
        WATERQUALITY:          'NORMAL',
        WATERQUALITYFACTOR:    fmt2(rnd(0.98, 0.01)),
        AVGLAMPEFFICIENCY:     avgEff,
        FAILEDLAMPCOUNT:       0,
        DEGRADATIONIMPACTPCT:  degradImpact,
        POWERCOMPENSATIONPCT:  powerComp,
      };

      for (let i = 0; i < 16; i++) {
        const id = pad(i + 1);
        row[`LAMP${id}STATUS`]     = 'OK';
        row[`LAMP${id}EFFICIENCY`] = curEfficiencies[i];
        row[`LAMP${id}RUNTIME`]    = curRuntimes[i];
        row[`LAMP${id}POWER`]      = fmt1(rnd(LAMP_POWER_BASE[i], 0.01));
      }

      rows.push(row);
    }

    // ── Batch INSERT telemetry ─────────────────────────────────────────
    const staticCols = [
      'timestamp', '"systemId"', '"operationType"', 'location', 'month',
      '"UVRINTENSITY"', '"UVRINTENSITYNORMALIZED"', '"UVRPOWEROUTPUT"', '"UVRPOWERSETPOINT"',
      '"UVRWATERTEMP"', '"UVRLEVEL"',
      '"LDCAIRTEMP"', '"LDCFANSPEED"', '"LDCFANSTATUS"', '"LDCWATERALARM"',
      '"FLTDIFFPRESSURE"', '"FLTMOTORSTATUS"', '"FLTBACKFLUSHACTIVE"', '"FLTBACKFLUSHCOUNT"',
      '"SYSFLOWRATE"', '"SYSPRESSURE"', '"SYSVALVEPOSITION"',
      '"SYSTOTALBALLASTVOL"', '"SYSTOTALDEBALLASTVOL"', '"SYSEXTERNALFEED"',
      '"CIPHOURSSINCELAST"',
      '"PLCCPUUSAGE"', '"PLCRAMUSAGE"', '"PLCCPUTEMP"',
      '"PROCESSSTATE"', '"COMPLIANCEMODE"', '"WATERQUALITY"', '"WATERQUALITYFACTOR"',
      '"AVGLAMPEFFICIENCY"', '"FAILEDLAMPCOUNT"', '"DEGRADATIONIMPACTPCT"', '"POWERCOMPENSATIONPCT"',
    ];
    const lampCols2 = [];
    for (let i = 1; i <= 16; i++) {
      const id = pad(i);
      lampCols2.push(`"LAMP${id}STATUS"`, `"LAMP${id}EFFICIENCY"`, `"LAMP${id}RUNTIME"`, `"LAMP${id}POWER"`);
    }
    const allCols = [...staticCols, ...lampCols2];

    // Keys matching allCols (unquoted, for row access)
    const allKeys = [
      'timestamp', 'systemId', 'operationType', 'location', 'month',
      'UVRINTENSITY', 'UVRINTENSITYNORMALIZED', 'UVRPOWEROUTPUT', 'UVRPOWERSETPOINT',
      'UVRWATERTEMP', 'UVRLEVEL',
      'LDCAIRTEMP', 'LDCFANSPEED', 'LDCFANSTATUS', 'LDCWATERALARM',
      'FLTDIFFPRESSURE', 'FLTMOTORSTATUS', 'FLTBACKFLUSHACTIVE', 'FLTBACKFLUSHCOUNT',
      'SYSFLOWRATE', 'SYSPRESSURE', 'SYSVALVEPOSITION',
      'SYSTOTALBALLASTVOL', 'SYSTOTALDEBALLASTVOL', 'SYSEXTERNALFEED',
      'CIPHOURSSINCELAST',
      'PLCCPUUSAGE', 'PLCRAMUSAGE', 'PLCCPUTEMP',
      'PROCESSSTATE', 'COMPLIANCEMODE', 'WATERQUALITY', 'WATERQUALITYFACTOR',
      'AVGLAMPEFFICIENCY', 'FAILEDLAMPCOUNT', 'DEGRADATIONIMPACTPCT', 'POWERCOMPENSATIONPCT',
    ];
    for (let i = 1; i <= 16; i++) {
      const id = pad(i);
      allKeys.push(`LAMP${id}STATUS`, `LAMP${id}EFFICIENCY`, `LAMP${id}RUNTIME`, `LAMP${id}POWER`);
    }

    const BATCH_SIZE = 50;
    for (let b = 0; b < rows.length; b += BATCH_SIZE) {
      const batch = rows.slice(b, b + BATCH_SIZE);
      const placeholders = batch.map((_, ri) =>
        '(' + allKeys.map((_, ci) => `$${ri * allKeys.length + ci + 1}`).join(', ') + ')'
      ).join(', ');
      const values = batch.flatMap(row => allKeys.map(k => row[k]));
      await pool.query(
        `INSERT INTO bwts_iot_telemetry (${allCols.join(', ')}) VALUES ${placeholders}`,
        values
      );
    }
    totalTelemetryRows += rows.length;
    console.log(`  Inserted ${rows.length} telemetry rows`);

    // ── Insert PROCESS_STOP event ──────────────────────────────────────
    const opEndTs = new Date(opEndMs);
    await pool.query(
      `INSERT INTO bwts_iot_events (timestamp, "eventType", description, "dataOperationType", "dataLocation", month)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [opEndTs, 'PROCESS_STOP',
       `${mode} process completed at ${op.port} — ${fmt1(isBallast ? opBallastVol : opDeballastVol)} m³ treated`,
       mode, op.port, opEndTs.getMonth() + 1]
    );
    totalEvents++;

    // ── Insert health score (at operation start) ───────────────────────
    const lastRow2  = rows[rows.length - 1];
    const uvH       = fmt2(Math.min(100, (lastRow2.UVRINTENSITY / 720) * 100));
    const lampH     = lastRow2.AVGLAMPEFFICIENCY;
    const thermalH  = fmt2(Math.max(0, 100 - Math.max(0, lastRow2.UVRWATERTEMP - 25) * 5));
    const powerE    = fmt2(Math.max(0, 100 - lastRow2.POWERCOMPENSATIONPCT * 2));
    const overall   = Math.round(uvH * 0.35 + lampH * 0.35 + thermalH * 0.15 + powerE * 0.15);
    const riskLv    = overall >= 80 ? 'LOW' : overall >= 60 ? 'MEDIUM' : overall >= 40 ? 'HIGH' : 'CRITICAL';

    await pool.query(
      `INSERT INTO bwts_iot_health_scores (timestamp, "overallScore", "riskLevel", month,
        "componentsUvHealth", "componentsPowerEfficiency", "componentsLampHealth", "componentsThermalHealth")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [opStart, overall, riskLv, opStart.getMonth() + 1, uvH, powerE, lampH, thermalH]
    );
    totalHealthRows++;

    // ── Advance cumulative hours ───────────────────────────────────────
    cumulativeOpHours += op.durationH;
    console.log(`  UV at end: ${lastRow2.UVRINTENSITY} W/m² | Health: ${overall} (${riskLv}) | CumHours: ${cumulativeOpHours}`);
  }

  // ── Insert CIP event for March 26 ─────────────────────────────────────
  await pool.query(
    `INSERT INTO bwts_iot_events (timestamp, "eventType", description, "dataOperationType", "dataLocation", month)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [CIP_MAR26, 'PROCESS_START',
     'CIP cycle completed — quartz sleeve cleaned, UV recovered +20 W/m²',
     'CIP', 'Shanghai', 3]
  );
  await pool.query(
    `INSERT INTO bwts_iot_events (timestamp, "eventType", description, "dataOperationType", "dataLocation", month)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [new Date(CIP_MAR26.getTime() + 1800000), 'PROCESS_STOP',
     'CIP cycle complete',
     'CIP', 'Shanghai', 3]
  );
  totalEvents += 2;

  // ── Final state report ─────────────────────────────────────────────────
  const finalLampRuntimes = lampRuntimes.map((rt, i) => fmt1(rt + cumulativeOpHours));
  const finalLampEfficiencies = lampEfficiencies.map((eff, i) =>
    fmt2(Math.max(5, eff - EFF_DECLINE_RATE[i] * cumulativeOpHours))
  );

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FILL DATA COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Telemetry rows inserted : ${totalTelemetryRows}`);
  console.log(`Events inserted         : ${totalEvents}`);
  console.log(`Health scores inserted  : ${totalHealthRows}`);
  console.log(`Total operating hours   : ${cumulativeOpHours}h`);
  console.log(`\nFinal lamp runtimes (LAMP-01 to 16):`);
  finalLampRuntimes.forEach((rt, i) => {
    const flag = rt > 3000 ? ' ⚠ PAST 3000h' : rt > 2500 ? ' → WARNING' : '';
    console.log(`  LAMP-${pad(i+1)}: ${rt}h (eff ${finalLampEfficiencies[i]}%)${flag}`);
  });
  console.log(`\nUpdate simulator LAMP_RUNTIME_BASE to:`);
  console.log(`[${finalLampRuntimes.join(', ')}]`);
  console.log(`\nUpdate simulator LAMP_EFFICIENCY_BASE to:`);
  console.log(`[${finalLampEfficiencies.join(', ')}]`);
  console.log(`\nUpdate UV base in simulator from 660 to: ~${fmt1(UV_START - cumulativeOpHours * UV_DECLINE + 10)} W/m² (live state today)`);

  await pool.end();
  await connector.close();
}

main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
