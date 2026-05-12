# BWTS Agent Demo — Pending Items

**Purpose**: Tracks remaining gaps and action items before the NBS demo is ready.  
**Last updated**: 2026-05-12

---

## Status Overview

| # | Item | Status | Owner |
|---|------|--------|-------|
| 1 | Manual Agent search tooling decision | ⏳ Pending decision | Sriram |
| 2 | Ballasting simulation physics correction | ⏳ To build | Dev |
| 3 | Deballasting simulation physics correction | ⏳ To build | Dev |
| 4 | 4 demo anomaly scenarios scripted | ⏳ To build | Dev |
| 5 | Maintenance records DB schema + mock data | ⏳ Awaiting manual schedule from Sriram | Dev |
| 6 | Predictions data reset (realistic lamp state mix) | ⏳ To do | Dev |
| 7 | Email report format / HTML template | ⏳ To design | Dev |
| 8 | Two-phase manual search workflow spec | ✅ Designed (see BWTS Agent md) | — |
| 9 | Casefile mock data | 🔜 Later phase | Sriram |

---

## Item Details

### 1. Manual Agent Search Tooling

**Problem**: The manual is 621 markdown pages across 2 parts. Keyword search alone will miss relevant sections (e.g., "UV intensity drop" vs "UVR low" vs "transmittance below threshold").

**Decision needed — pick one approach**:

| Option | How it works | Effort | Quality |
|--------|-------------|--------|---------|
| **Semantic search (embeddings)** | Embed all 621 pages, search by vector similarity | Medium — needs embedding pipeline | High — finds conceptually related sections |
| **Pre-built alarm index** | Extract all alarm codes + causes + page refs into a structured JSON | Low — one-time manual work | High for known alarms, misses edge cases |
| **Section-aware keyword search** | Search within specific chapters (e.g., only search Ch.6 + Troubleshooting for causes) | Low | Medium |

**Recommended**: Build the pre-built alarm index from the manual's alarm list (pages 217–241) as a JSON lookup, plus semantic search as a fallback. The alarm index gives fast, precise Phase 2 targeted queries. Semantic search handles novel queries.

---

### 2 & 3. Ballasting vs Deballasting Simulation Physics

**What needs to change per mode**:

| Parameter | Ballasting | Deballasting |
|-----------|-----------|--------------|
| Filter differential pressure | Active, relevant (0–1.5 bar typical) | Bypassed — should read 0 / not active |
| Flow direction | Intake → tanks | Tanks → discharge |
| Flow rate profile | Steady ramp-up, holds at target | Faster, gravity-assisted, variable |
| UV treatment | Required (IMO + USCG compliance) | Required for discharge compliance |
| TRO measurement | Not standard in PureBallast 3.1 ballasting | Applicable in some discharge modes |
| Filter backwash trigger | Active based on ΔP | Not applicable |
| CIP availability | Available | Available |

**Current gap**: The simulation does not model these differences. Switching modes currently changes only labels.

---

### 4. Demo Anomaly Scenarios

Four pre-scripted scenarios to be injected via the existing demo trigger button:

#### Scenario A — UV Intensity Gradual Degradation *(Priority 1)*
- **Mode**: Ballasting
- **What happens**: UV intensity drops from ~650 W/m² to 490 W/m² over a simulated 3-hour period
- **Root causes (dual)**: Lamp-13 at 3,254h runtime (above 3,000h threshold) + quartz sleeve fouling (no CIP in 47 days)
- **Threshold breached**: USCG minimum 530 W/m²
- **Data story**: Gradual degradation visible in trend — not a sudden spike
- **Manual sections**: Alarm list (p217–241), Troubleshooting UVR (p271), CIP procedure (p161–163)
- **Maintenance hook**: Last CIP recorded 47 days ago; manual recommends ≤30 days

#### Scenario B — Filter Differential Pressure Rising *(Priority 2)*
- **Mode**: Ballasting only
- **What happens**: Filter ΔP climbs from 0.3 bar to 1.2 bar over 40 minutes; auto-backwash triggers 3×; flow rate begins dropping
- **Root cause**: High turbidity intake water, filter clogging faster than backwash can clear
- **Threshold**: ΔP > 1.0 bar triggers warning; > 1.5 bar triggers alarm
- **Data story**: Turbidity spike in intake + ΔP correlation visible
- **Manual sections**: Filter troubleshooting (p275–276), backwash procedure

#### Scenario C — Single LPS Failure *(Priority 3)*
- **Mode**: Either
- **What happens**: Lamp Power Supply for Lamp cluster 9–12 shows power drop to 60%; corresponding UV intensity drop on that reactor section
- **Root cause**: LPS undervoltage / failing ballast unit
- **Threshold**: Lamp power < 80% triggers warning
- **Manual sections**: LPS parameters (p205–208), alarm code for LPS fault (p217–241)
- **Maintenance hook**: LPS units have a 7-year replacement schedule

#### Scenario D — CIP Failure *(Priority 4)*
- **Mode**: Either (typically triggered before deballasting)
- **What happens**: CIP cycle initiated but UV transmittance does not recover after completion; quartz sleeve still fouled after 2 cycle attempts
- **Root cause**: Severely fouled quartz sleeve requiring manual cleaning
- **Manual sections**: CIP process (p161–163), CIP troubleshooting (p277–279)

---

### 5. Maintenance Records

**DB schema recommendation** (separate table — do not overload `bwts_iot_events`):

```sql
CREATE TABLE bwts_maintenance_log (
  id              BIGSERIAL PRIMARY KEY,
  timestamp       TIMESTAMPTZ NOT NULL,
  component_id    TEXT NOT NULL,          -- e.g. 'LAMP-13', 'FILTER', 'LPS-UNIT-3', 'QUARTZ-SLEEVE'
  component_type  TEXT NOT NULL,          -- e.g. 'UV_LAMP', 'FILTER', 'LPS', 'CIP'
  maintenance_type TEXT NOT NULL,         -- e.g. 'LAMP_REPLACEMENT', 'FILTER_CLEAN', 'CIP_CYCLE', 'QUARTZ_CLEAN', 'ANNUAL_OVERHAUL'
  description     TEXT,
  performed_by    TEXT,                   -- e.g. 'Chief Engineer', 'Third Engineer'
  hours_at_service NUMERIC,              -- lamp runtime hours at time of service
  next_due_date   DATE,
  next_due_hours  NUMERIC,               -- next service due at this runtime hour
  notes           TEXT,
  month           INT
);
```

**Pending**: Sriram to provide maintenance schedule from Alfa Laval manual. Will use schedule to:
1. Create mock historical records (last 12–18 months of realistic service history)
2. Pre-populate `next_due_date` and `next_due_hours` for all components

---

### 6. Predictions Data Reset

**Current state**: All 16 lamps show RUL = 0 (all past 3,000h — system appears to be in complete failure).

**Target state for demo**: Realistic operational distribution —
- 2 lamps genuinely overdue (Lamp-13, Lamp-15 — matches Scenario A)
- 4–5 lamps in warning zone (2,500–3,000h)
- 9–10 lamps healthy (< 2,500h)
- Lamp-03 and Lamp-12 remain fresh (703h and 161h) — they were recently replaced in the scenario

One-time `UPDATE` query before the demo.

---

### 7. Email Report Format

**Three-section structure**:

```
Subject: [BWTS ALERT] UV Intensity Below USCG Threshold — MV [Vessel Name] — 2026-05-12 09:14 UTC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ALERT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameter: UV Intensity (UVR)
Current Value: 490 W/m²
Threshold Breached: USCG Minimum 530 W/m²
Deviation: -7.5%
Detected: 2026-05-12 09:14 UTC
Mode: Ballasting | Vessel: MV [Name]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. DIAGNOSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data analysis (last 72h):
  • UV intensity declining steadily since 06:30 UTC (-14% over 2h 44min)
  • Lamp-13 runtime: 3,254h [ABOVE 3,000h RATED LIFE]
  • Lamp-15 runtime: 3,276h [ABOVE 3,000h RATED LIFE]
  • No recent CIP cycle detected (last CIP: 47 days ago)

Probable causes (from PureBallast manual, p.271):
  1. Quartz sleeve fouling — consistent with overdue CIP + UV intensity gradual decline
  2. Lamp end-of-life — Lamp-13 and Lamp-15 exceed rated 3,000h

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. RECOMMENDED ACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Immediate (before next ballasting operation):
  □ Initiate CIP cycle (ref: Manual Section 6.5, p.161)
  □ Inspect quartz sleeve — manual clean if CIP insufficient (ref: Troubleshooting 3.3, p.277)

Short-term (next port call):
  □ Replace Lamp-13 and Lamp-15 (3,000h life exceeded)
  □ Schedule: PMS due date was [date from maintenance log]

Reference: PureBallast 3.1 System Manual — Alfa Laval
Prepared by: BWTS Agent Team | [timestamp]
```

---

## What Is NOT a Gap (Resolved Items)

- ✅ Email trigger mechanism: dedicated monitoring inbox, 24/7 agent, acceptable latency
- ✅ Parallel agent execution: handled natively by agent SDK
- ✅ Demo trigger button: exists, needs better scenarios (covered above)
- ✅ Alert Tab in micro-app: exists
- ✅ Agent workflow visibility: shown in agent SDK UI, not in micro-app
- ✅ Algorithm ownership: own algorithms used for now; NBS algorithms are a future integration option
- ✅ Casefile Agent: deferred to Phase 2 when NBS provides case data
