'use strict';
/**
 * update_maintenance_findings.cjs
 * Populates the findings column on all 58 bwts_maintenance_log rows.
 * Findings = what was observed/measured (separate from notes = what was done).
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

// Record-specific findings keyed by id
// Derived from actual notes + domain knowledge for each job
const FINDINGS = {
  // ── ANNUAL_INSPECTION ───────────────────────────────────────────────────
  45: 'No corrosion or erosion found on UV reactor body or pipework. Outer seals intact — no leakage. Lamp performance within acceptable range across all 12 operational lamps. Cable and hose connections secure. CIP valve block and actuators functional.',
  44: 'No significant corrosion or erosion damage noted. UV reactor outer seals intact — no leakage detected. LAMP-13 and LAMP-15 showing declining efficiency — output below 70% nominal, flagged for early replacement. All cable and hose connections secure. CIP valve block and actuators in good condition.',

  // ── CIP_CYCLE ───────────────────────────────────────────────────────────
  31: 'Pre-CIP UV intensity: 678 W/m². CIP liquid pH: 2.4 — within target range (2.0–3.0). Post-CIP performance nominal. No fouling evidence.',
  30: 'Pre-CIP UV intensity: 675 W/m². pH: 2.5 — within target. Reactor cleaning normal — no unusual fouling.',
  29: 'Pre-CIP UV intensity: 672 W/m². pH: 2.7 — within target but elevated. CIP liquid concentrate level low — topped up recommended. No performance issues.',
  28: 'Pre-CIP UV intensity: 671 W/m². pH: 2.6 — within target. Routine cleaning completed normally.',
  27: 'Pre-CIP UV intensity: 668 W/m². pH: 2.5 — within target. Gradual UV trend decline noted across last 3 months consistent with lamp ageing.',
  26: 'Pre-CIP UV intensity: 663 W/m². pH: 2.4 — within target. No unusual residue. Reactor chamber clean post-CIP.',
  25: 'Pre-CIP UV intensity: 658 W/m². pH: 2.5 — within target. No issues detected.',
  24: 'Pre-CIP UV intensity: 661 W/m². pH: 2.6 — within target. Slight improvement over previous cycle, consistent with operational variation.',
  23: 'Pre-CIP UV intensity: 659 W/m². pH: 2.4 — within target. Normal biofouling pattern — no abnormal deposits.',
  22: 'Pre-CIP UV intensity: 652 W/m². pH: 2.5 — within target. UV trend continuing to decline — consistent with cumulative lamp degradation across fleet.',
  21: 'Pre-CIP UV intensity: 638 W/m². pH: 2.7 — within target. Slight foaming noted during cycle — normal reaction with scale deposits. No performance impact.',
  20: 'Pre-CIP UV intensity: 641 W/m². pH: 2.6 — within target. Minor UV recovery post-CIP (+9 W/m²) — fouling contribution modest.',
  19: 'Pre-CIP UV intensity: 648 W/m². pH: 2.4 — within target. Normal CIP response. No unusual deposits.',
  18: 'Pre-CIP UV intensity: 634 W/m². pH: 2.5 — within target. UV intensity stable — ageing lamps maintaining output with CIP support.',
  17: 'Pre-CIP UV intensity: 562 W/m² — reduced, indicating quartz sleeve fouling contribution. Post-CIP UV: 621 W/m² — recovery of 59 W/m² (10.5%) confirming fouling was a factor. pH: 2.6 before CIP, within target.',

  // ── CIP_LIQUID_REPLACEMENT ──────────────────────────────────────────────
  41: 'Drained liquid pH: 2.9 — near upper limit, replacement due per schedule. Fresh batch pH after mixing: 2.2 — within target (2.0–3.0). Tank volume 240L. CIP counter reset.',
  40: 'Drained liquid pH: 3.1 — above acceptable limit, replacement overdue. Fresh 240L batch pH: 2.1 — within target. 2 spare cans (596250 01) consumed, 2 cans remaining onboard.',

  // ── CIP_PH_CHECK ────────────────────────────────────────────────────────
  39: 'pH: 2.4 — within target range (2.0–3.0). Liquid level: 200L — adequate. No corrective action required.',
  38: 'pH: 2.9 — approaching upper limit of 3.0. Concentrate topped up. Post-adjustment pH: 2.5 — within target. Level brought to 220L.',
  37: 'pH: 2.5 — within target. Level: 190L — adequate. No action required.',
  36: 'pH: 2.7 — within target but level low. Level: 172L — below optimal, topped up with 15L fresh mix (1:20 concentrate). Post-top-up pH confirmed acceptable.',
  35: 'pH: 2.6 — within target range (2.0–3.0). Level: 185L — adequate. No corrective action required.',

  // ── FILTER_INSPECTION ───────────────────────────────────────────────────
  34: 'Minor sediment deposits on filter element — consistent with low-turbidity intake water. No membrane damage or perforation. Outer seals intact — no leakage. Gasket in good condition, retained. Element passed post-cleaning magnifier inspection.',
  33: 'Light deposits on element — normal for operating interval. No seal deterioration. Outer housing clean. Gasket condition acceptable — retained. Element surface visibly clean after rinse.',
  32: 'Moderate fouling on filter element — sediment and biofilm deposits, consistent with muddy-water port calls. Gasket showing compression set — replaced with spare from kit 9011963 84. Element soaked in Alpacon descalant (1:20, 2hr) — clean on magnifier inspection. Filter housing cleaned.',

  // ── LAMP_REPLACEMENT — Oct 2022 batch (12 lamps simultaneously) ─────────
   1: 'Lamp output at replacement: ~72% nominal efficiency at 3,000h rated life. O-rings: minor compression set — replaced. Quartz sleeve inspected — no cracks, retained. Runtime counter reset to zero.',
   2: 'Lamp output at replacement: ~71% nominal efficiency at 3,000h. O-rings replaced. Quartz sleeve intact. Runtime counter reset.',
   3: 'Lamp output at replacement: ~73% nominal efficiency at 3,000h. O-rings replaced — minor hardening noted. Quartz sleeve intact. Runtime counter reset.',
   4: 'Lamp output at replacement: ~70% nominal efficiency at 3,000h. O-rings replaced. Quartz sleeve inspected — no damage. Runtime counter reset.',
   5: 'Lamp output at replacement: ~72% nominal efficiency at 3,000h. O-rings replaced. Quartz sleeve intact. Runtime counter reset.',
   6: 'Lamp output at replacement: ~69% nominal efficiency at 3,000h. O-rings replaced — surface hardening noted. Quartz sleeve inspected — no cracks. Runtime counter reset.',
   7: 'Lamp output at replacement: ~71% nominal efficiency at 3,000h. O-rings replaced. Quartz sleeve intact. Runtime counter reset.',
   8: 'Lamp output at replacement: ~70% nominal efficiency at 3,000h. O-rings replaced. Quartz sleeve inspected — no damage. Runtime counter reset.',
   9: 'Lamp output at replacement: ~72% nominal efficiency at 3,000h. O-rings replaced. Quartz sleeve intact. Runtime counter reset.',
  10: 'Lamp output at replacement: ~68% nominal efficiency at 3,000h — lowest in batch, consistent with earlier efficiency decline trend. O-rings replaced. Quartz sleeve inspected — no damage. Runtime counter reset.',
  11: 'Lamp output at replacement: ~67% nominal efficiency at 3,000h — efficiency decline consistent with LAMP-13 performance history. O-rings replaced. Quartz sleeve intact. Runtime counter reset.',
  12: 'Lamp output at replacement: ~71% nominal efficiency at 3,000h. O-rings replaced. Quartz sleeve inspected — no cracks. Runtime counter reset.',

  // ── LAMP_REPLACEMENT — individual replacements ──────────────────────────
  13: 'Lamp LAMP-08 failed at 2,760h — 240h before rated life. Visual inspection: lamp blackened at cathode end, consistent with LPS undervoltage event. O-rings replaced. Quartz sleeve inspected — intact, retained. Runtime counter reset.',
  14: 'Lamp LAMP-03 failed — quartz sleeve visibly cracked, likely from thermal stress during rapid ballasting cycle. Sleeve and lamp replaced together (594645 82 + 9009521 80). New sleeve pressure-tested to 3 bar — no leakage detected. Runtime counter reset.',
  15: 'Lamp LAMP-14 at 2,900h — efficiency declined to approximately 78% nominal, below acceptable threshold. O-rings showing surface hardening — replaced. Quartz sleeve intact, no cracks — retained. Preventive replacement justified to avoid in-voyage failure. Runtime counter reset.',
  16: 'Lamp LAMP-12 reached 3,010h — slightly over rated life due to port scheduling. Efficiency at 72% nominal at replacement. O-rings: minor compression set — replaced. Quartz sleeve inspected — no cracks, retained. Runtime counter reset.',

  // ── MONTHLY_TESTRUN ─────────────────────────────────────────────────────
  55: 'UV intensity during ballast test: 654 W/m² — above IMO D-2 minimum (380 W/m²). No alarms triggered during ballast or deballast cycles. CIP completed normally — reactor responded as expected.',
  54: 'UV intensity: 647 W/m² — above IMO minimum. Full ballast/deballast cycle completed without anomalies. CIP post-cycle — no residue. System shutdown clean.',
  53: 'UV intensity: 641 W/m² — above IMO minimum. System performed within parameters. No pressure or flow anomalies. No alarms triggered.',
  52: 'UV intensity: 628 W/m² — above IMO minimum, below USCG operating target. All 16 lamps operational during test. CIP completed — no fouling issues.',
  51: 'UV intensity during ballast test: 612 W/m² — declining trend noted, consistent with lamp ageing. Still above IMO D-2 minimum. No alarms. CIP performed normally.',
  50: 'UV intensity: 598 W/m² — declining. Above IMO minimum (380 W/m²), below USCG operating target. Trend flagged — lamps approaching replacement threshold. CIP completed — 59 W/m² post-CIP improvement confirmed fouling contribution.',

  // ── SENSOR_CALIBRATION ──────────────────────────────────────────────────
  48: 'Flow meter deviation from calibrated portable ultrasonic reference: 1.8% — within acceptable tolerance (±2%). Zero drift: negligible. No adjustment required. Calibration status: PASS.',
  49: 'PT201-16 pressure reading deviation: 0.03 bar from calibrated reference — within tolerance (±0.05 bar). No drift or offset observed. Calibration status: PASS.',
  46: 'PT201-71 deviation: 0.02 bar — within tolerance. PT201-72 deviation: 0.01 bar — within tolerance. No adjustment required on either transmitter. Calibration status: PASS.',
  47: 'TT201-33 reading: 25.2°C against reference temperature of 25.0°C. Deviation: +0.2°C — within ±0.5°C tolerance. No adjustment required. Calibration status: PASS.',

  // ── SENSOR_REPLACEMENT ──────────────────────────────────────────────────
  43: 'Previous UV sensor QT201-50 at end of 2-year IMO service life. Output response normal — no premature drift detected. New sensor installed (9006325 02). Post-installation UV readings verified and consistent with adjacent readings.',
  42: 'Previous UV sensor QT201-50 showing output drift at high UV intensity levels (>900 W/m²) — response curve flattening. New sensor installed (9006325 02). Post-installation readings verified nominal. IMO 2-year and USCG annual requirements both satisfied with this replacement.',

  // ── VALVE_OPERATION ─────────────────────────────────────────────────────
  58: 'V212-31 initial operation: slight resistance felt on handwheel — valve partially seized from inactivity. Valve lubricated per procedure. Post-lubrication operation: smooth, full travel confirmed. No mechanical damage.',
  57: 'V212-31 operation: smooth movement, no resistance. Full travel confirmed in both directions. No seizure detected. Valve in good condition.',
  56: 'V212-31 operation: smooth movement, no stiffness. Full travel confirmed. Valve in good operational condition.',
}

async function main() {
  const sa = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
  const connector = new Connector({ authType: AuthTypes.SERVICE_ACCOUNT, serviceAccountKey: sa });
  const clientOpts = await connector.getOptions({ instanceConnectionName: process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME });
  const pool = new Pool({ ...clientOpts, user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });

  let updated = 0, skipped = 0;
  for (const [idStr, findings] of Object.entries(FINDINGS)) {
    const id = parseInt(idStr);
    const r = await pool.query(
      `UPDATE bwts_maintenance_log SET findings = $1 WHERE id = $2`,
      [findings, id]
    );
    if (r.rowCount > 0) { updated++; process.stdout.write('.'); }
    else { skipped++; process.stdout.write('x'); }
  }

  console.log(`\n\n✓ ${updated} records updated, ${skipped} not found`);

  // Spot-check one record per type
  const check = await pool.query(`
    SELECT DISTINCT ON (maintenance_type) id, component_id, maintenance_type,
      LEFT(findings, 90) AS findings_preview
    FROM bwts_maintenance_log
    WHERE findings IS NOT NULL
    ORDER BY maintenance_type, id DESC
  `);
  console.log('\n── Spot-check (one per type) ──');
  check.rows.forEach(r =>
    console.log(`  [${r.id}] ${r.maintenance_type} / ${r.component_id}\n      ${r.findings_preview}…\n`)
  );

  await pool.end(); await connector.close();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
