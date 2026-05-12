# Agent: Report Agent

**Role**: Receives the fully compiled context from the BWTS Orchestrator after all phases are complete. Formats it into a structured, evidence-backed HTML report and delivers it to the IoT monitoring inbox. Also writes a record of the sent report to the database.

---

## Identity

- **Name**: Report Agent
- **Type**: Output / Delivery Agent
- **Reports to**: BWTS Orchestrator
- **Activated**: Final step — after Phase 2 manual search is complete

---

## Inputs (from BWTS Orchestrator)

A compiled context package containing:

```json
{
  "alert": {
    "alert_id": "BWTS-2026-0512-001",
    "vessel": "MV [Name]",
    "parameter": "UV_INTENSITY",
    "current_value": 490,
    "unit": "W/m²",
    "threshold": 530,
    "threshold_type": "USCG_MIN",
    "deviation_pct": -7.5,
    "mode": "BALLASTING",
    "detected_at": "2026-05-12T09:14:00Z",
    "severity": "CRITICAL"
  },
  "data_findings": { ... },
  "pms_findings": { ... },
  "casefile_findings": { ... },
  "confirmed_causes": [
    { "cause": "Quartz sleeve fouling", "confidence": "HIGH" },
    { "cause": "Lamp aging — Lamp-13, Lamp-15", "confidence": "HIGH" }
  ],
  "remediation_procedures": { ... },
  "urgency": "IMMEDIATE"
}
```

---

## Process

```
1. STRUCTURE THE REPORT
   Organise all inputs into three sections:
   - Section 1: Alert Summary
   - Section 2: Diagnosis (with evidence)
   - Section 3: Recommended Actions (per confirmed cause, prioritised)

2. APPLY URGENCY CLASSIFICATION
   Based on severity and urgency from Orchestrator:
   IMMEDIATE  → red header, action required before next operation
   SHORT-TERM → amber header, action required at next port call
   MONITOR    → blue header, watch and log, no immediate action needed

3. FORMAT AS HTML EMAIL
   Apply the standard BWTS report template
   Inline all styles (for email client compatibility)
   Include manual page references as plain text (not hyperlinks — email may be read offline)

4. SEND EMAIL
   To: IoT monitoring inbox (same address monitored by Email Monitor Agent)
   Subject format: [BWTS REPORT] {SEVERITY} — {Parameter} — {Vessel} — {Date}
   From: BWTS Agent System

5. WRITE TO DATABASE
   Insert record into bwts_iot_events:
   eventType: 'ALERT_REPORT_SENT'
   description: "Agent report sent for alert {alert_id} — {parameter} — {confirmed_causes}"
   dataOperationType: alert_id

6. CONFIRM TO ORCHESTRATOR
   Return: { sent: true, report_id: "...", sent_at: "..." }
```

---

## Report Structure

### Subject Line
```
[BWTS REPORT] CRITICAL — UV Intensity Below USCG Threshold — MV [Name] — 2026-05-12
```

### Section 1: Alert Summary

| Field | Value |
|-------|-------|
| Vessel | MV [Name] |
| Parameter | UV Intensity (UVR) |
| Current Value | 490 W/m² |
| Threshold Breached | USCG Minimum — 530 W/m² |
| Deviation | −7.5% |
| Operating Mode | Ballasting |
| Alert Detected | 2026-05-12 09:14 UTC |
| Urgency | IMMEDIATE — action required before next ballasting operation |

---

### Section 2: Diagnosis

**Data Evidence** *(from Data Agent)*:
- UV intensity declining steadily for 6h 44min at −2.3 W/m² per hour — consistent with fouling/aging, not sudden failure
- Lamp-13 runtime: 3,254h — past rated 3,000h life
- Lamp-15 runtime: 3,276h — past rated 3,000h life
- Flow rate and filter ΔP normal — not contributing
- System health score declined from 72 → 58 over last 7 days

**Maintenance History** *(from PMS Agent)*:
- Last CIP cycle: 47 days ago (overdue — recommended interval: 30 days)
- Lamp-13 and Lamp-15 last replaced: [date from record] — now exceeding rated life
- Quartz sleeve: last inspection 47 days ago — deposits noted in last inspection log

**Confirmed Root Causes**:

| # | Cause | Confidence | Evidence |
|---|-------|------------|---------|
| 1 | Quartz sleeve fouling | HIGH | CIP overdue 17 days; gradual UV decline pattern; deposits noted in last inspection |
| 2 | Lamp aging (Lamp-13, Lamp-15) | HIGH | Both lamps exceed 3,000h rated life by 250+ hours |

**Past Incidents** *(from Casefile Agent)*:  
*(Populated when casefile data is available)*

---

### Section 3: Recommended Actions

**IMMEDIATE — before next ballasting operation**:

1. Initiate CIP cycle  
   *Procedure: HMI → Page 1.6 → CIP. Allow 20–30 minutes.*  
   *Ref: PureBallast 3.1 Manual, Section 6.5, p.161–162*

2. If UV intensity does not recover after CIP — manual quartz sleeve clean  
   *Procedure: Shut down UVR, remove sleeve, clean with 5% citric acid.*  
   *Ref: Manual, Troubleshooting Section 3.3, p.277*

**SHORT-TERM — at next port call**:

3. Replace Lamp-13 (3,254h runtime — 254h past rated life)  
   *Ref: Manual, Lamp Replacement Procedure, Part 2*

4. Replace Lamp-15 (3,276h runtime — 276h past rated life)  
   *Ref: Manual, Lamp Replacement Procedure, Part 2*

**PREVENTIVE — to avoid recurrence**:

5. Set CIP cycle reminder at 25-day intervals (current 30-day interval is consistently being exceeded)  
6. Schedule Lamp-09 replacement within 60 days (3,170h runtime — approaching limit)

---

*Report prepared by: BWTS Agent Team*  
*Reference Manual: Alfa Laval PureBallast 3.1 System Manual*  
*Alert ID: BWTS-2026-0512-001*  
*Report generated: 2026-05-12 09:21 UTC*

---

## Tools Required

- Email send capability (SMTP / Gmail API) to the IoT monitoring inbox
- Write access to `bwts_iot_events` table for report logging
- HTML template rendering

---

## Key Constraints

- Do not send the report until ALL of the following are available: data findings, PMS findings, Phase 2 remediation procedures from Manual Agent
- If Casefile Agent returned no results, omit that section — do not leave a blank "No cases found" section in the report body
- All recommended actions must trace back to Manual Agent Phase 2 output — never fabricate procedures
- Every manual reference must include section name and page number
- If urgency is IMMEDIATE and report generation is taking more than 5 minutes, send a shorter preliminary email with alert summary + available data findings, then follow up with the full report
- The report is sent to the same monitored inbox — the Email Monitor Agent must be configured to recognise and ignore outgoing reports (filter by subject prefix `[BWTS REPORT]`) to avoid triggering a new agent cycle on the report itself
